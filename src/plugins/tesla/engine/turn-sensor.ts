import type { TurnSensorStatus } from './types'

type OrientationAPI = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

/** Relative orientation supplies short-term yaw without depending on compass north. */
export class TurnSensor {
  private permission: 'granted' | 'denied' | null = null
  private requesting = false
  private listening = false
  private generation = 0
  private startedAt = 0
  private sampleAt: number | null = null
  private previous: { heading: number; at: number; axis: 'top' | 'normal' } | null = null
  private rate = 0

  private get api(): OrientationAPI | null {
    return typeof window === 'undefined' ? null : (window.DeviceOrientationEvent as OrientationAPI) || null
  }

  start() {
    this.stop()
    if (globalThis.isSecureContext && this.api && (!this.api.requestPermission || this.permission === 'granted')) this.listen()
  }

  /** Call directly from a click so browsers requiring a gesture can prompt. */
  async enable() {
    const api = this.api
    if (!api || !globalThis.isSecureContext || this.requesting) return
    const token = this.generation
    this.requesting = true
    try {
      const permission = api.requestPermission && this.permission !== 'granted' ? await api.requestPermission() : 'granted'
      if (token !== this.generation) return
      this.permission = permission
      if (permission === 'granted') { this.stop(); this.listen() }
    } catch {
      if (token === this.generation) this.permission = 'denied'
    } finally {
      if (token === this.generation) this.requesting = false
    }
  }

  status(now: number): TurnSensorStatus {
    if (!this.api) return 'unsupported'
    if (!globalThis.isSecureContext) return 'insecure'
    if (this.requesting) return 'requesting'
    if (this.permission === 'denied') return 'denied'
    if (this.api.requestPermission && this.permission !== 'granted') return 'permission'
    if (!this.listening) return 'off'
    if (this.sampleAt !== null && now - this.sampleAt < 800) return 'active'
    return now - this.startedAt < 3000 ? 'waiting' : 'unavailable'
  }

  sample(now: number): number | null {
    if (this.sampleAt === null || now - this.sampleAt >= 800) return null
    return Math.abs(this.rate) >= .6 ? this.rate : 0
  }

  private listen() {
    this.listening = true
    this.startedAt = performance.now()
    window.addEventListener('deviceorientation', this.onOrientation)
  }

  private onOrientation = (event: DeviceOrientationEvent) => {
    if (![event.alpha, event.beta, event.gamma].every(value => typeof value === 'number' && Number.isFinite(value))) return
    const rad = Math.PI / 180
    const a = event.alpha! * rad, b = event.beta! * rad, c = event.gamma! * rad
    // Project a device axis onto the horizontal plane, supporting flat, upright
    // and landscape mounts. The screen normal avoids the upright Euler singularity.
    let axis = this.previous?.axis ?? (Math.abs(Math.cos(b)) > .5 ? 'top' : 'normal')
    const project = (normal: boolean): [number, number] => normal
      ? [Math.cos(a) * Math.sin(c) + Math.sin(a) * Math.sin(b) * Math.cos(c), Math.sin(a) * Math.sin(c) - Math.cos(a) * Math.sin(b) * Math.cos(c)]
      : [-Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b)]
    let point = project(axis === 'normal')
    if (Math.hypot(...point) < .35) {
      axis = axis === 'top' ? 'normal' : 'top'
      point = project(axis === 'normal')
    }
    const now = performance.now()
    const heading = Math.atan2(point[0], point[1]) / rad
    const previous = this.previous
    const dt = previous ? (now - previous.at) / 1000 : 0
    if (previous && dt < .015) return
    this.previous = { heading, at: now, axis }
    if (!previous || axis !== previous.axis || dt > .5) { this.rate = 0; this.sampleAt = null; return }
    const rate = ((heading - previous.heading + 540) % 360 - 180) / dt
    if (Math.abs(rate) > 65) { this.rate = 0; this.sampleAt = null; return }
    this.rate += (rate - this.rate) * (1 - Math.exp(-dt / .2))
    this.sampleAt = now
  }

  stop() {
    ++this.generation
    if (this.listening) window.removeEventListener('deviceorientation', this.onOrientation)
    this.listening = this.requesting = false
    this.previous = this.sampleAt = null
    this.rate = 0
  }
}
