import { AudioEngine } from './reference/audio.mjs'
import { DemoInput, PowertrainModel } from './reference/powertrain.mjs'
import { GeolocationService } from './geolocation'
import { getVehicleModel } from './vehicles'
import { emptyFrame, emptyMotion, emptyStats } from './types'
import type { EngineProfile, EngineSettings, EngineState, InputMode, MotionSnapshot } from './types'

const defaultStorageKey = 'tvt:tesla:engine:v1'
const defaults: EngineSettings = { modelId: 'modely', volume: 55, intensity: 60, shiftSounds: true, processingMode: 'smooth', pollMs: 0 }
const bounded = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback

function readPreferences(storageKey: string): { profileId?: number; mode?: InputMode; settings: EngineSettings } {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '{}')
    return {
      profileId: typeof value.profileId === 'number' ? value.profileId : undefined,
      mode: value.mode === 'demo' ? 'demo' : 'gps',
      settings: { modelId: getVehicleModel(value.settings?.modelId).id, volume: bounded(value.settings?.volume, 55), intensity: bounded(value.settings?.intensity, 60), shiftSounds: value.settings?.shiftSounds !== false, processingMode: value.settings?.processingMode === 'adaptive' ? 'adaptive' : 'smooth', pollMs: value.settings?.pollMs === 250 ? 250 : 0 },
    }
  } catch { return { settings: { ...defaults } } }
}

export class EngineController {
  readonly audio: AudioEngine
  readonly gps: GeolocationService
  readonly demo = new DemoInput()
  readonly profiles: EngineProfile[]
  state: EngineState
  private model: PowertrainModel
  private listeners = new Set<(state: EngineState) => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private operation = 0
  private lastTick = 0
  private startedAt = 0
  private logId = 0
  private mutedForLoss = false
  private demoSteering = 0
  private waveBytes = new Uint8Array(512)
  private wakeLock: WakeLockSentinel | null = null
  private disposed = false
  private readonly storageKey: string

  constructor(profiles: EngineProfile[], dependencies: { audio?: AudioEngine; gps?: GeolocationService; storageKey?: string } = {}) {
    if (!profiles.length) throw new Error('至少需要一个有效音色。')
    this.profiles = profiles
    this.storageKey = dependencies.storageKey || defaultStorageKey
    const stored = readPreferences(this.storageKey)
    const profile = profiles.find(p => p.id === stored.profileId) || profiles[0]!
    this.model = new PowertrainModel(profile.config)
    this.audio = dependencies.audio || new AudioEngine()
    this.gps = dependencies.gps || new GeolocationService()
    this.state = { status: 'off', mode: stored.mode || 'gps', demoMode: 'manual', profileId: profile.id, settings: stored.settings, motion: emptyMotion(), engine: emptyFrame(), stats: emptyStats(), gpsStatus: 'off', intervalMs: null, contextState: 'none', audioBlocked: false, progress: 0, level: 0, waveform: Array(64).fill(0), maxSpeedKmh: 0, elapsedS: 0, demoPhase: 0, error: '', notice: '', logs: [] }
    this.audio.addEventListener('progress', this.onProgress)
    this.audio.addEventListener('contextstate', this.onContext)
    this.gps.onStatus = status => { this.state.gpsStatus = status; this.publish() }
    this.gps.onSample = sample => {
      this.state.intervalMs = sample.intervalMs
      if (!sample.result.accepted && sample.result.reason !== 'duplicate') this.log(`已过滤定位样本：${reasonLabel(sample.result.reason)}`, 'warn')
      if (sample.result.accepted && this.state.error && this.state.gpsStatus === 'active') this.state.error = ''
    }
    this.gps.onError = (message, code) => {
      this.state.error = message
      this.log(message, 'warn')
      if (code === 1 || code === 0) {
        const failedStatus = this.state.gpsStatus
        void this.stop('error')
        this.state.gpsStatus = failedStatus
      }
      this.publish()
    }
  }

  get profile() { return this.profiles.find(p => p.id === this.state.profileId)! }
  get busy() { return this.state.status === 'starting' || this.state.status === 'switching' }

  subscribe(listener: (state: EngineState) => void) {
    this.listeners.add(listener)
    listener({ ...this.state })
    return () => { this.listeners.delete(listener) }
  }

  private publish() {
    if (this.disposed) return
    const snapshot = { ...this.state, settings: { ...this.state.settings }, engine: { ...this.state.engine }, motion: { ...this.state.motion }, stats: { ...this.state.stats, reasons: { ...this.state.stats.reasons } } }
    this.listeners.forEach(listener => listener(snapshot))
  }

  log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    const entry = { id: ++this.logId, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), level, message }
    this.state.logs = [...this.state.logs.slice(-59), entry]
  }

  private persist() {
    try { localStorage.setItem(this.storageKey, JSON.stringify({ profileId: this.state.profileId, mode: this.state.mode, settings: this.state.settings })) } catch { /* Storage is optional in embedded browsers. */ }
  }

  applySettings(patch: Partial<EngineSettings>) {
    this.state.settings = { ...this.state.settings, ...patch }
    this.state.settings.modelId = getVehicleModel(this.state.settings.modelId).id
    this.state.settings.volume = bounded(this.state.settings.volume, 55)
    this.state.settings.intensity = bounded(this.state.settings.intensity, 60)
    this.audio.applySettings({ ...this.state.settings, volume: this.mutedForLoss ? 0 : this.state.settings.volume })
    this.gps.configure(this.state.settings.processingMode, this.state.settings.pollMs)
    this.persist()
    this.publish()
  }

  async setMode(mode: InputMode) {
    if (mode === this.state.mode || this.busy) return
    await this.stop()
    this.state.mode = mode
    this.state.error = ''
    this.state.notice = ''
    this.persist()
    this.publish()
  }

  async selectProfile(id: number) {
    const next = this.profiles.find(profile => profile.id === id)
    if (!next || next.id === this.state.profileId || this.busy) return
    const token = this.operation
    const wasRunning = this.state.status === 'running'
    if (wasRunning) {
      this.state.status = 'switching'
      this.state.progress = 0
      this.publish()
      try {
        const changed = await this.audio.switchProfile(next)
        if (token !== this.operation || !changed) return
      } catch (error) {
        if (token !== this.operation) return
        this.state.status = 'running'
        this.state.error = friendlyError(error)
        this.log(this.state.error, 'error')
        this.publish()
        return
      }
    }
    if (token !== this.operation) return
    this.state.profileId = id
    this.model = new PowertrainModel(next.config)
    if (wasRunning) {
      this.model.adopt(this.state.motion.speedMps, this.state.engine.throttle, this.state.engine.brake)
      this.state.status = 'running'
    }
    this.demo.configure(next.config)
    this.state.error = ''
    this.state.progress = wasRunning ? 100 : 0
    this.log(`已选择 ${next.name}`)
    this.persist()
    this.publish()
  }

  async start(options: { automatic?: boolean; monitoring?: boolean } = {}) {
    if (this.disposed || this.busy || this.state.status === 'running') return
    const token = ++this.operation
    this.state.error = ''
    this.state.notice = ''
    this.state.status = 'starting'
    this.state.progress = 0
    this.state.motion = emptyMotion()
    this.state.stats = emptyStats()
    this.state.intervalMs = null
    this.state.maxSpeedKmh = 0
    this.state.elapsedS = 0
    this.model.reset()
    this.mutedForLoss = false
    this.state.audioBlocked = false
    this.publish()
    if (this.state.mode === 'gps') {
      this.gps.configure(this.state.settings.processingMode, this.state.settings.pollMs)
      if (!this.gps.start()) { this.state.status = 'error'; this.publish(); return }
    } else {
      this.demo.configure(this.profile.config)
      this.demo.start()
      this.demo.setMode(this.state.demoMode)
    }
    if (options.monitoring) this.startMonitoring()
    try {
      await this.audio.start(this.profile, { ...this.state.settings, volume: this.mutedForLoss ? 0 : this.state.settings.volume }, { allowSuspended: !!options.automatic })
      if (token !== this.operation || this.disposed || this.audio.state !== 'running') return
      if (this.audio.contextState !== 'running' && !options.automatic) throw new Error('浏览器暂未开启音频，请再次点击启动。')
      this.state.status = 'running'
      this.state.contextState = this.audio.contextState
      this.state.audioBlocked = this.audio.contextState !== 'running'
      this.state.progress = 100
      this.startMonitoring()
      this.log(this.state.audioBlocked ? '位置与仪表已启动，等待点击启用声浪。' : `${this.state.mode === 'gps' ? 'GPS 驾驶' : '桌面演示'}已启动 · ${this.profile.name}`)
      this.persist()
      this.publish()
      void this.requestWakeLock(token)
    } catch (error) {
      if (token !== this.operation) return
      this.state.error = friendlyError(error)
      this.log(this.state.error, 'error')
      if (options.monitoring) {
        // A failed/blocked audio download must not stop live vehicle telemetry.
        this.state.status = 'running'
        this.state.audioBlocked = true
        this.state.contextState = this.audio.contextState
        this.publish()
        void this.requestWakeLock(token)
      } else await this.stop('error')
    }
  }

  private startMonitoring() {
    if (this.timer) return
    this.lastTick = this.startedAt = performance.now()
    this.timer = setInterval(() => this.tick(performance.now()), 50)
    this.tick(this.lastTick + .01)
  }

  /** 20 Hz control update. Web Audio schedules the actual audio independently. */
  tick(now: number) {
    if (this.state.status !== 'running' && this.state.status !== 'switching' && this.state.status !== 'starting') return
    const dt = Math.min(0.25, Math.max(0, (now - this.lastTick) / 1000))
    this.lastTick = now
    let motion: MotionSnapshot
    if (this.state.mode === 'demo') {
      this.demo.tick(dt, this.state.engine)
      motion = { ...this.demo.snapshot(), steering: this.demoSteering }
      this.state.demoPhase = this.demo.phaseIndex
    } else motion = this.gps.snapshot(now)
    this.state.motion = motion
    const stale = motion.quality === 'stale' || motion.quality === 'lost'
    const decay = stale ? Math.max(0, 1 - ((motion.ageS ?? 0) - 3.5) / 4.5) : 1
    const pedals = this.state.mode === 'demo' ? { throttle: motion.throttle ?? 0, brake: motion.brake ?? 0 } : stale ? { throttle: 0, brake: 0 } : null
    this.state.engine = this.model.update(motion.speedMps * decay, motion.accelMps2 * decay, dt, pedals)
    if (this.audio.contextState === 'running') this.audio.update(this.state.engine)
    const muted = this.state.mode === 'gps' && (motion.quality === 'none' || motion.quality === 'lost')
    if (muted !== this.mutedForLoss) {
      this.mutedForLoss = muted
      this.audio.applySettings({ volume: muted ? 0 : this.state.settings.volume })
      this.log(muted ? motion.quality === 'none' ? '等待首次定位，声浪待机。' : '定位已中断，声浪已淡出。' : '定位已恢复，声浪继续跟随速度。', muted ? 'warn' : 'info')
    }
    this.state.level = this.audio.level()
    if (this.audio.nodes) {
      this.audio.nodes.analyser.getByteTimeDomainData(this.waveBytes)
      this.state.waveform = Array.from({ length: 64 }, (_, i) => (this.waveBytes[i * 8]! - 128) / 128)
    }
    this.state.contextState = this.audio.contextState
    this.state.audioBlocked = this.audio.contextState !== 'running'
    this.state.stats = { ...this.gps.estimator.stats }
    this.state.elapsedS = (now - this.startedAt) / 1000
    this.state.maxSpeedKmh = Math.max(this.state.maxSpeedKmh, motion.speedMps * 3.6)
    this.publish()
  }

  setDemoMode(mode: 'manual' | 'auto') {
    this.state.demoMode = mode
    this.demoSteering = 0
    this.demo.setMode(mode)
    this.publish()
  }
  setGas(held: boolean) { this.demo.setGas(held) }
  setBrake(held: boolean) { this.demo.setBrake(held) }
  setSteering(value: number) { this.demoSteering = this.state.mode === 'demo' && this.state.demoMode === 'manual' && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0 }
  releasePedals() { this.demo.setGas(false); this.demo.setBrake(false); this.demoSteering = 0 }
  setHoldThrottle(percent: number) { this.demo.setHoldThrottle(percent / 100) }
  setCruise(kmh: number) { this.demo.setCruise(kmh) }

  async resumeSound() {
    const token = this.operation
    try {
      if (this.state.status === 'running' && this.audio.state !== 'running') {
        if (this.audio.state === 'loading') return false
        await this.audio.start(this.profile, { ...this.state.settings, volume: this.mutedForLoss ? 0 : this.state.settings.volume })
        if (token !== this.operation || this.disposed) return false
      }
      const resumed = await this.audio.resume()
      if (token !== this.operation || this.disposed) return false
      this.state.audioBlocked = !resumed
      this.state.contextState = this.audio.contextState
      if (resumed) { this.state.error = ''; this.log('声浪已启用。') }
      else this.state.error = '浏览器仍未开启音频，请再次点击。'
      this.publish()
      return resumed
    } catch (error) {
      if (token !== this.operation || this.disposed) return false
      this.state.error = friendlyError(error)
      this.state.audioBlocked = true
      this.publish()
      return false
    }
  }

  async stop(status: EngineState['status'] = 'off') {
    ++this.operation
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.gps.stop()
    this.demo.stop()
    this.releasePedals()
    const hadActivity = this.state.status === 'running' || this.busy
    this.state.status = status
    this.state.engine = emptyFrame()
    this.state.motion = emptyMotion()
    this.state.level = 0
    this.state.waveform = Array(64).fill(0)
    this.state.progress = 0
    this.state.contextState = 'none'
    this.state.audioBlocked = false
    if (hadActivity) this.log(status === 'paused' ? '页面已隐藏，引擎暂停。返回后可重新启动。' : '引擎已停止。')
    this.publish()
    void this.wakeLock?.release().catch(() => {})
    this.wakeLock = null
    await this.audio.stop({ fadeS: 0.25 })
  }

  pauseForVisibility() {
    if (this.state.status === 'running' || this.busy) {
      this.state.notice = '页面切入后台，引擎已暂停。返回页面后点击启动即可继续。'
      void this.stop('paused')
    }
  }

  private async requestWakeLock(token: number) {
    try {
      if (!navigator.wakeLock) return
      const lock = await navigator.wakeLock.request('screen')
      if (token !== this.operation || this.disposed) { void lock.release(); return }
      this.wakeLock = lock
    } catch { /* Optional: never prevent playback on a browser without wake lock. */ }
  }

  private onProgress = (event: Event) => {
    const { loaded, total } = (event as CustomEvent<{ loaded: number; total: number }>).detail
    if (this.busy) { this.state.progress = Math.round(100 * loaded / Math.max(1, total)); this.publish() }
  }
  private onContext = (event: Event) => {
    this.state.contextState = (event as CustomEvent<{ state: string }>).detail.state || 'none'
    if (this.state.status === 'running' || this.state.status === 'switching') this.state.audioBlocked = this.state.contextState !== 'running'
    this.publish()
  }

  dispose() {
    void this.stop()
    this.audio.removeEventListener('progress', this.onProgress)
    this.audio.removeEventListener('contextstate', this.onContext)
    this.gps.onSample = this.gps.onStatus = this.gps.onError = null
    this.listeners.clear()
    this.disposed = true
  }
}

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('Sounddatei')) return '音频资源加载失败，请检查资源文件和网络后重试。'
  if (message.includes('Web Audio')) return '当前浏览器不支持 Web Audio，无法播放声浪。'
  return message
}

export function reasonLabel(reason: string): string {
  return ({ 'invalid-position': '无效坐标', 'invalid-time': '无效时间', duplicate: '重复样本', 'out-of-order': '时间乱序', inaccurate: '位置精度不足', 'implausible-speed': '速度超出合理范围', 'implausible-jump': '速度跳变', spike: '瞬时尖峰' } as Record<string, string>)[reason] || reason
}
