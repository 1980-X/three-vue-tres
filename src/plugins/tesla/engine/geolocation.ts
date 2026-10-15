import { MotionEstimator } from './reference/motion.mjs'
import type { FixResult, MotionFix, ProcessingMode } from './types'

export interface LocationSample {
  result: FixResult
  intervalMs: number | null
  accuracy: number | null
  deviceSpeed: number | null
  positionAgeMs: number
  signature: string
  channel: 'watch' | 'poll'
}

const geoMessages: Record<number, string> = {
  1: '定位权限被拒绝，请在浏览器中允许此页面访问位置。',
  2: '暂时无法取得位置，请将车辆停在开阔区域后重试。',
  3: '等待定位超时，请检查位置权限与信号后重试。',
}

/** The upstream estimator is retained; this adapter adds session-safe teardown. */
export class GeolocationService {
  readonly estimator = new MotionEstimator()
  status = 'off'
  onSample: ((sample: LocationSample) => void) | null = null
  onStatus: ((status: string) => void) | null = null
  onError: ((message: string, code: number) => void) | null = null
  private watchId: number | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private generation = 0
  private active = false
  private pollBusy = false
  private lastReceivedAt: number | null = null
  private pollMs = 0

  configure(mode: ProcessingMode, pollMs = 0) {
    this.estimator.opts = { ...this.estimator.defaults, mode }
    this.pollMs = pollMs
    if (this.active) this.startPolling(this.generation)
  }

  start(): boolean {
    this.stop()
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.setStatus('unsupported')
      this.onError?.('当前浏览器不支持定位。可以切换到桌面演示。', 0)
      return false
    }
    if (!globalThis.isSecureContext) {
      this.setStatus('insecure')
      this.onError?.('GPS 定位需要 HTTPS 地址；本机 localhost 也可用于开发。', 0)
      return false
    }
    this.active = true
    const generation = ++this.generation
    this.estimator.reset()
    this.lastReceivedAt = null
    this.setStatus('requesting')
    try {
      this.watchId = navigator.geolocation.watchPosition(
        position => { if (this.active && generation === this.generation) this.receive(position, 'watch') },
        error => {
          if (!this.active || generation !== this.generation) return
          if (error.code === 1) this.stop()
          this.setStatus(error.code === 1 ? 'denied' : error.code === 2 ? 'unavailable' : 'waiting')
          this.onError?.(geoMessages[error.code] || error.message, error.code)
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
      )
      this.startPolling(generation)
      return true
    } catch (error) {
      this.stop()
      this.setStatus('error')
      this.onError?.(error instanceof Error ? error.message : '定位启动失败。', 0)
      return false
    }
  }

  private startPolling(generation: number) {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    if (!this.pollMs) return
    this.pollTimer = setInterval(() => {
      if (!this.active || generation !== this.generation || this.pollBusy) return
      this.pollBusy = true
      navigator.geolocation.getCurrentPosition(
        position => {
          if (generation !== this.generation) return
          this.pollBusy = false
          if (this.active) this.receive(position, 'poll')
        },
        () => { if (generation === this.generation) this.pollBusy = false },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 2000 },
      )
    }, this.pollMs)
  }

  private receive(position: GeolocationPosition, channel: 'watch' | 'poll') {
    const now = performance.now()
    const interval = this.lastReceivedAt === null ? null : now - this.lastReceivedAt
    this.lastReceivedAt = now
    const coords = position.coords
    const fix: MotionFix = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, speed: coords.speed, timestamp: position.timestamp, receivedAt: now }
    const result = this.estimator.addFix(fix)
    this.setStatus('active')
    this.onSample?.({ result, intervalMs: interval, accuracy: coords.accuracy, deviceSpeed: coords.speed, positionAgeMs: Date.now() - position.timestamp, signature: `${coords.latitude}|${coords.longitude}|${coords.speed ?? ''}`, channel })
  }

  stop() {
    this.active = false
    ++this.generation
    if (this.watchId !== null && typeof navigator !== 'undefined') navigator.geolocation?.clearWatch(this.watchId)
    this.watchId = null
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    this.pollBusy = false
    this.setStatus('off')
  }

  private setStatus(status: string) {
    if (this.status === status) return
    this.status = status
    this.onStatus?.(status)
  }
}
