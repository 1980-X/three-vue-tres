import { GeolocationService } from './geolocation'
import { emptyMotion, emptyStats } from './types'
import type { EngineLog, MotionSnapshot, MotionStats, ProcessingMode } from './types'

export interface Capability { id: string; label: string; detail: string; available: boolean; required: boolean }
export interface DiagnosticResult { label: string; detail: string; status: 'ok' | 'warn' | 'bad' }
export interface DiagnosticState {
  step: number; running: boolean; audioHeard: boolean | null; audioPlaying: boolean
  progress: number; remaining: number; error: string; locationOk: boolean
  motion: MotionSnapshot; stats: MotionStats; intervals: number[]
  bestAccuracy: number | null; elapsed: number; watchUnique: number; pollUnique: number
  pollAdditional: number; medianAgeMs: number | null; lastEpoch: number | null
  audioState: string; sampleRate: number | null; baseLatency: number | null
  capabilities: Capability[]; results: DiagnosticResult[]; logs: EngineLog[]
}

export function detectCapabilities(): Capability[] {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  return [
    { id: 'secure', label: '安全连接', detail: 'HTTPS / localhost', available: !!globalThis.isSecureContext, required: true },
    { id: 'geo', label: '浏览器定位', detail: 'Geolocation API', available: !!nav?.geolocation, required: true },
    { id: 'audio', label: '实时音频', detail: 'Web Audio API', available: typeof window !== 'undefined' && !!(window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext), required: true },
    { id: 'permissions', label: '权限状态查询', detail: 'Permissions API · 可选', available: !!nav?.permissions, required: false },
    { id: 'wake', label: '屏幕常亮', detail: 'Screen Wake Lock · 可选', available: !!nav?.wakeLock, required: false },
    { id: 'lifecycle', label: '页面状态监听', detail: 'Page Visibility', available: typeof document !== 'undefined' && 'visibilityState' in document, required: false },
  ]
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

export function evaluateDiagnostic(state: Pick<DiagnosticState, 'capabilities' | 'audioHeard' | 'locationOk' | 'bestAccuracy' | 'stats' | 'intervals'>): DiagnosticResult[] {
  const results: DiagnosticResult[] = []
  const requiredOk = state.capabilities.filter(c => c.required).every(c => c.available)
  results.push({ label: '浏览器', status: requiredOk ? 'ok' : 'bad', detail: requiredOk ? '具备定位和实时音频的基础能力。' : '缺少基础能力，请查看第一步中的检测项。' })
  results.push({ label: '声音输出', status: state.audioHeard === true ? 'ok' : state.audioHeard === false ? 'bad' : 'warn', detail: state.audioHeard === true ? '已确认听到两声提示音。' : state.audioHeard === false ? '未听到提示音，请检查媒体音量与音源。' : '声音测试尚未确认。' })
  results.push({ label: '定位', status: state.locationOk ? 'ok' : 'bad', detail: state.locationOk ? '已收到浏览器位置数据。' : '尚未收到位置数据，请在实车开阔区域重试。' })
  if (!state.locationOk) return results
  const inaccurate = state.bestAccuracy !== null && state.bestAccuracy > 50
  if (inaccurate) results.push({ label: '位置精度', status: state.stats.accepted === 0 ? 'bad' : 'warn', detail: `最佳精度 ±${Math.round(state.bestAccuracy!)} m，${state.stats.accepted === 0 ? '不足以可靠估算速度。' : '部分样本可用，建议在开阔区域重测。'}` })
  const interval = median(state.intervals)
  if (!inaccurate || state.stats.accepted > 0) {
    const sparse = state.intervals.length < 4 || interval === null || interval > 3000
    results.push({ label: '更新频率', status: sparse || interval! > 1500 ? 'warn' : 'ok', detail: sparse ? '有效观察窗口内的位置更新较少，声浪响应可能延迟。' : `更新间隔中位数 ${(interval! / 1000).toFixed(2)} s${interval! > 1500 ? '，响应会有一定延迟。' : '，适合进行实车联动测试。'}` })
    if (!state.stats.withSpeed) results.push({ label: '速度来源', status: 'warn', detail: '设备未提供速度，将由位置差估算，响应会稍慢。' })
  }
  return results
}

export class DiagnosticsController {
  readonly gps = new GeolocationService()
  state: DiagnosticState
  private listeners = new Set<(state: DiagnosticState) => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private timeout: ReturnType<typeof setTimeout> | null = null
  private watchPositions = new Set<string>()
  private pollPositions = new Set<string>()
  private ages: number[] = []
  private pollBusy = false
  private generation = 0
  private startedAt = 0
  private logId = 0
  private audio: AudioContext | null = null
  private audioTimer: ReturnType<typeof setTimeout> | null = null
  private audioGeneration = 0
  private disposed = false

  constructor() {
    this.state = { step: 0, running: false, audioHeard: null, audioPlaying: false, progress: 0, remaining: 15, error: '', locationOk: false, motion: emptyMotion(), stats: emptyStats(), intervals: [], bestAccuracy: null, elapsed: 0, watchUnique: 0, pollUnique: 0, pollAdditional: 0, medianAgeMs: null, lastEpoch: null, audioState: 'none', sampleRate: null, baseLatency: null, capabilities: detectCapabilities(), results: [], logs: [] }
    this.gps.onSample = sample => {
      this.state.locationOk = true
      this.state.lastEpoch = Date.now()
      if (sample.accuracy !== null && Number.isFinite(sample.accuracy)) this.state.bestAccuracy = this.state.bestAccuracy === null ? sample.accuracy : Math.min(this.state.bestAccuracy, sample.accuracy)
      if (this.state.step === 2 && this.state.running) { this.beginSignal(); return }
      if (this.state.step === 3 && this.state.running) {
        if (sample.intervalMs !== null) this.state.intervals.push(sample.intervalMs)
        this.watchPositions.add(sample.signature)
        this.state.watchUnique = this.watchPositions.size
      }
      if (!sample.result.accepted && sample.result.reason !== 'duplicate') this.log(`样本过滤：${sample.result.reason}`, 'warn')
      this.publish()
    }
    this.gps.onStatus = status => { if (status === 'active') this.state.error = ''; this.publish() }
    this.gps.onError = (message, code) => {
      this.state.error = message
      this.log(message, 'warn')
      if (code === 1 || code === 0) { this.state.running = false; this.clearTimers() }
      this.publish()
    }
  }

  subscribe(listener: (state: DiagnosticState) => void) {
    this.listeners.add(listener)
    listener({ ...this.state })
    return () => { this.listeners.delete(listener) }
  }

  private publish() {
    if (this.disposed) return
    this.state.stats = { ...this.gps.estimator.stats, reasons: { ...this.gps.estimator.stats.reasons } }
    this.state.motion = this.gps.estimator.snapshot(performance.now())
    const snapshot = { ...this.state, intervals: [...this.state.intervals] }
    this.listeners.forEach(fn => fn(snapshot))
  }

  private log(message: string, level: EngineLog['level'] = 'info') {
    this.state.logs = [...this.state.logs.slice(-59), { id: ++this.logId, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), level, message }]
  }

  next() { this.state.step = Math.min(2, this.state.step + 1); this.publish() }
  confirmAudio(heard: boolean) { this.state.audioHeard = heard; if (heard) this.state.step = 2; this.publish() }

  async playSound() {
    if (this.state.audioPlaying) return
    const generation = ++this.audioGeneration
    this.state.audioPlaying = true
    this.state.error = ''
    this.publish()
    try {
      const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Context) throw new Error('当前浏览器不支持实时音频。')
      if (this.audio) await this.audio.close()
      if (this.disposed || generation !== this.audioGeneration) return
      const ctx = new Context()
      this.audio = ctx
      await ctx.resume()
      if (this.disposed || generation !== this.audioGeneration) { if (ctx.state !== 'closed') await ctx.close(); return }
      if (ctx.state !== 'running') throw new Error('浏览器音频未启动，请再次点击试听。')
      const now = ctx.currentTime
      ;[660, 880].forEach((frequency, index) => {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain()
        oscillator.frequency.value = frequency
        const start = now + 0.05 + index * 0.32
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.16, start + 0.015)
        gain.gain.setValueAtTime(0.16, start + 0.12)
        gain.gain.linearRampToValueAtTime(0, start + 0.18)
        oscillator.connect(gain).connect(ctx.destination)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
        oscillator.start(start); oscillator.stop(start + 0.2)
      })
      this.state.audioPlaying = true
      this.state.audioState = ctx.state
      this.state.sampleRate = ctx.sampleRate
      this.state.baseLatency = ctx.baseLatency ?? null
      this.log('已播放两声提示音，请确认实际扬声器输出。')
      this.publish()
      this.audioTimer = setTimeout(() => { this.state.audioPlaying = false; this.publish() }, 750)
    } catch (error) {
      if (this.disposed || generation !== this.audioGeneration) return
      this.state.error = error instanceof Error ? error.message : String(error)
      this.state.audioPlaying = false
      this.publish()
    }
  }

  startLocation(mode: ProcessingMode) {
    this.clearTimers()
    ++this.generation
    this.state.step = 2
    this.state.running = true
    this.state.locationOk = false
    this.state.error = ''
    this.state.bestAccuracy = null
    this.state.intervals = []
    this.state.progress = 0
    this.state.remaining = 15
    this.gps.configure(mode, 0)
    if (!this.gps.start()) { this.state.running = false; this.publish(); return }
    this.log('等待位置授权与首个定位样本。')
    this.timeout = setTimeout(() => {
      if (this.state.step !== 2) return
      this.gps.stop()
      this.state.running = false
      this.state.error = '25 秒内未收到位置数据。可以重试，或先使用桌面演示。'
      this.publish()
    }, 25_000)
    this.publish()
  }

  private beginSignal() {
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = null
    this.state.step = 3
    this.startedAt = performance.now()
    this.watchPositions.clear(); this.pollPositions.clear(); this.ages = []
    this.state.watchUnique = this.state.pollUnique = this.state.pollAdditional = 0
    this.state.medianAgeMs = null
    const generation = this.generation
    this.log('开始 15 秒信号测量，同时比较监听与 250 ms 补充查询。')
    this.pollTimer = setInterval(() => {
      if (this.pollBusy || generation !== this.generation) return
      this.pollBusy = true
      navigator.geolocation.getCurrentPosition(position => {
        if (generation !== this.generation || !this.state.running) return
        this.pollBusy = false
        const c = position.coords
        this.pollPositions.add(`${c.latitude}|${c.longitude}|${c.speed ?? ''}`)
        const age = Date.now() - position.timestamp
        if (age > -5000 && age < 60_000) this.ages.push(age)
      }, () => { if (generation === this.generation) this.pollBusy = false }, { enableHighAccuracy: true, maximumAge: 0, timeout: 2000 })
    }, 250)
    this.timer = setInterval(() => {
      this.state.elapsed = (performance.now() - this.startedAt) / 1000
      this.state.progress = Math.min(100, this.state.elapsed / 15 * 100)
      this.state.remaining = Math.max(0, Math.ceil(15 - this.state.elapsed))
      this.state.pollUnique = this.pollPositions.size
      this.state.pollAdditional = [...this.pollPositions].filter(key => !this.watchPositions.has(key)).length
      this.state.medianAgeMs = median(this.ages)
      if (this.state.elapsed >= 15) this.finish()
      else this.publish()
    }, 250)
    this.publish()
  }

  finish() {
    this.clearTimers()
    ++this.generation
    this.gps.stop()
    this.state.running = false
    this.state.step = 4
    this.state.stats = { ...this.gps.estimator.stats }
    this.state.results = evaluateDiagnostic(this.state)
    this.log('诊断完成。结果仅保存在当前页面。')
    this.publish()
  }

  pause() {
    if (!this.state.running) return
    this.clearTimers()
    ++this.generation
    this.gps.stop()
    this.state.running = false
    this.state.step = 2
    this.state.error = '页面切入后台，诊断已暂停。请返回后重新测试定位。'
    this.publish()
  }

  reset() {
    this.clearTimers(); ++this.generation; this.gps.stop(); this.gps.estimator.reset()
    ++this.audioGeneration
    if (this.audioTimer) clearTimeout(this.audioTimer)
    if (this.audio && this.audio.state !== 'closed') void this.audio.close()
    this.audio = null
    this.state = { ...this.state, step: 0, running: false, progress: 0, remaining: 15, error: '', locationOk: false, audioHeard: null, audioPlaying: false, audioState: 'none', sampleRate: null, baseLatency: null, intervals: [], stats: emptyStats(), results: [], bestAccuracy: null, elapsed: 0, watchUnique: 0, pollUnique: 0, pollAdditional: 0, medianAgeMs: null, lastEpoch: null, logs: [] }
    this.publish()
  }

  report() {
    return { schemaVersion: 1, generatedAt: new Date().toISOString(), capabilities: this.state.capabilities, audio: { heard: this.state.audioHeard, sampleRate: this.state.sampleRate, baseLatency: this.state.baseLatency }, location: { received: this.state.stats.received, accepted: this.state.stats.accepted, rejected: this.state.stats.rejected, reasons: this.state.stats.reasons, deviceSpeed: this.state.stats.withSpeed > 0, bestAccuracyM: this.state.bestAccuracy, medianIntervalMs: median(this.state.intervals), watchUnique: this.state.watchUnique, pollUnique: this.state.pollUnique, pollAdditional: this.state.pollAdditional, medianAgeMs: this.state.medianAgeMs }, results: this.state.results }
  }

  private clearTimers() {
    if (this.timer) clearInterval(this.timer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.timeout) clearTimeout(this.timeout)
    this.timer = this.pollTimer = this.timeout = null
    this.pollBusy = false
  }

  dispose() {
    this.clearTimers(); ++this.generation; this.gps.stop()
    ++this.audioGeneration
    if (this.audioTimer) clearTimeout(this.audioTimer)
    if (this.audio && this.audio.state !== 'closed') void this.audio.close()
    this.listeners.clear(); this.disposed = true
  }
}
