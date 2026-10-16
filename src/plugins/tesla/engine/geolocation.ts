import { haversineDistance, MotionEstimator } from './reference/motion.mjs'
import type { FixResult, MotionFix, MotionSnapshot, ProcessingMode } from './types'

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
  private courseFix: MotionFix | null = null
  private course: { heading: number; receivedAt: number } | null = null
  private turnRate = 0

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
    if (result.accepted) this.updateCourse(fix, coords.heading)
    this.setStatus('active')
    this.onSample?.({ result, intervalMs: interval, accuracy: coords.accuracy, deviceSpeed: coords.speed, positionAgeMs: Date.now() - position.timestamp, signature: `${coords.latitude}|${coords.longitude}|${coords.speed ?? ''}`, channel })
  }

  private updateCourse(fix: MotionFix, deviceHeading: number | null) {
    const motion = this.estimator.snapshot(fix.receivedAt)
    if (motion.speedMps < 1.5 || (fix.accuracy ?? Infinity) > 50 || Date.now() - fix.timestamp > 3500) {
      this.courseFix = fix
      this.course = null
      this.turnRate = 0
      return
    }
    let heading = typeof deviceHeading === 'number' && Number.isFinite(deviceHeading) && deviceHeading >= 0 && deviceHeading < 360 ? deviceHeading : null
    const previous = this.courseFix
    if (heading === null && previous && fix.receivedAt - previous.receivedAt <= 5000) {
      const distance = haversineDistance(previous.latitude, previous.longitude, fix.latitude, fix.longitude)
      if (distance >= Math.max(6, .75 * ((previous.accuracy ?? 50) + (fix.accuracy ?? 50)))) {
        const rad = Math.PI / 180
        const lat1 = previous.latitude * rad, lat2 = fix.latitude * rad
        const longitude = (fix.longitude - previous.longitude) * rad
        heading = (Math.atan2(Math.sin(longitude) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(longitude)) / rad + 360) % 360
      }
    }
    if (heading === null) {
      if (!previous || fix.receivedAt - previous.receivedAt > 5000) this.courseFix = fix
      return
    }
    const dt = this.course ? (fix.receivedAt - this.course.receivedAt) / 1000 : 0
    if (this.course && dt < .25) return
    const change = this.course ? (heading - this.course.heading + 540) % 360 - 180 : 0
    const rate = dt > 0 && dt <= 3.5 ? change / dt : 0
    // Discard GPS course jumps and wrap 359 -> 0 along the shortest arc.
    this.turnRate = Math.abs(rate) <= 60 ? this.turnRate + (rate - this.turnRate) * (1 - Math.exp(-dt / .6)) : 0
    this.course = { heading, receivedAt: fix.receivedAt }
    this.courseFix = fix
  }

  snapshot(now: number): MotionSnapshot {
    const motion = this.estimator.snapshot(now)
    const current = motion.quality === 'fresh' && motion.speedMps >= 1.5 && this.course && now - this.course.receivedAt <= 2500
    return { ...motion, headingDeg: current ? this.course!.heading : null, turnRateDegS: current && Math.abs(this.turnRate) >= 1.5 ? this.turnRate : 0 }
  }

  stop() {
    this.active = false
    ++this.generation
    if (this.watchId !== null && typeof navigator !== 'undefined') navigator.geolocation?.clearWatch(this.watchId)
    this.watchId = null
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    this.pollBusy = false
    this.courseFix = this.course = null
    this.turnRate = 0
    this.setStatus('off')
  }

  private setStatus(status: string) {
    if (this.status === status) return
    this.status = status
    this.onStatus?.(status)
  }
}
