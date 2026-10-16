import { haversineDistance, MotionEstimator } from './reference/motion.mjs'
import { TurnSensor } from './turn-sensor'
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
  private readonly turnSensor = new TurnSensor()
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
  private course: { heading: number; sampledAt: number; receivedAt: number; source: 'gps' | 'derived'; intervalS: number } | null = null
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
    this.turnSensor.start()
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
    if (motion.speedMps < .8 || fix.speed === 0 || (fix.accuracy ?? Infinity) > 65 || Date.now() - fix.timestamp > 3500) {
      this.courseFix = fix
      this.course = null
      this.turnRate = 0
      return
    }
    let heading = typeof deviceHeading === 'number' && Number.isFinite(deviceHeading) && deviceHeading >= 0 && deviceHeading < 360 ? deviceHeading : null
    let source: 'gps' | 'derived' = 'gps'
    let sampledAt = fix.timestamp
    const previous = this.courseFix
    if (heading === null && previous && fix.receivedAt - previous.receivedAt <= 8000 && Math.max(previous.accuracy ?? Infinity, fix.accuracy ?? Infinity) <= 35) {
      const distance = haversineDistance(previous.latitude, previous.longitude, fix.latitude, fix.longitude)
      if (distance >= Math.max(3, .5 * Math.hypot(previous.accuracy ?? 35, fix.accuracy ?? 35))) {
        const rad = Math.PI / 180
        const lat1 = previous.latitude * rad, lat2 = fix.latitude * rad
        const longitude = (fix.longitude - previous.longitude) * rad
        heading = (Math.atan2(Math.sin(longitude) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(longitude)) / rad + 360) % 360
        source = 'derived'
        // A segment bearing describes its midpoint, rather than the latest fix.
        sampledAt = (previous.timestamp + fix.timestamp) / 2
      }
    }
    if (heading === null) {
      if (!previous || fix.receivedAt - previous.receivedAt > 8000) this.courseFix = fix
      return
    }
    const dt = this.course ? (sampledAt - this.course.sampledAt) / 1000 : 0
    if (this.course && dt < .2) return
    const change = this.course ? (heading - this.course.heading + 540) % 360 - 180 : 0
    const rate = this.course?.source === source && dt > 0 && dt <= 8 ? change / dt : 0
    // Discard GPS course jumps and wrap 359 -> 0 along the shortest arc.
    if (Math.abs(rate) > 60) { this.turnRate = 0; return }
    this.turnRate = this.course?.source === source && dt <= 8 ? this.turnRate + (rate - this.turnRate) * (1 - Math.exp(-dt / .45)) : 0
    this.course = { heading, sampledAt, receivedAt: fix.receivedAt, source, intervalS: dt }
    this.courseFix = fix
  }

  enableTurnSensor() {
    return this.active ? this.turnSensor.enable() : Promise.resolve()
  }

  snapshot(now: number): MotionSnapshot {
    const motion = this.estimator.snapshot(now)
    const moving = motion.quality === 'fresh' && motion.speedMps >= .8 && motion.rawSpeedMps !== 0
    const course = this.course
    const age = course ? (now - course.receivedAt) / 1000 : Infinity
    const current = moving && course && age <= Math.min(6, Math.max(3.5, course.intervalS * 1.5))
    const gpsRate = current ? this.turnRate * Math.exp(-Math.max(0, age - Math.max(.8, course.intervalS)) / .8) : 0
    const sensorRate = moving ? this.turnSensor.sample(now) : null
    const rate = sensorRate ?? gpsRate
    return { ...motion, headingDeg: current ? course.heading : null, turnRateDegS: Math.abs(rate) >= .6 ? rate : 0, turnSource: sensorRate !== null ? 'sensor' : current ? course.source : null, turnSensorStatus: this.turnSensor.status(now) }
  }

  stop() {
    this.active = false
    ++this.generation
    if (this.watchId !== null && typeof navigator !== 'undefined') navigator.geolocation?.clearWatch(this.watchId)
    this.watchId = null
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    this.pollBusy = false
    this.turnSensor.stop()
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
