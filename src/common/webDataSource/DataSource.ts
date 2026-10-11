import type { TvTDataSourceConfig } from './types'

export class DataSource {
  constructor(public config: TvTDataSourceConfig) {}

  private timer: any = null
  private listeners: any[] = []
  private hasFetched = false
  private lastData: any
  private fetching = false
  private stopped = false

  start() {
    this.stopped = false
    const interval = this.config.interval ?? 5000

    // interval = 0 → 只执行一次
    if (interval === 0) {
      this.fetch()
      return
    }

    // 先执行一次
    this.fetch()

    this.timer = setInterval(() => {
      this.fetch()
    }, interval)
  }

  stop() {
    this.stopped = true
    this.listeners = []
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  subscribe(cb: any) {
    this.listeners.push(cb)
    if (this.config.interval === 0) {
      if (this.hasFetched) {
        this.notify(cb, this.lastData)
      } else {
        this.fetch()
      }
    }
    return () => {
      cb.active = false
      this.listeners = this.listeners.filter(listener => listener !== cb)
    }
  }

  private notify(cb: any, data: any) {
    if (this.stopped || cb.active === false) return
    try {
      cb.fun(data)
    } catch (err) {
      console.error('[DataBinding Error]', err)
    }
  }

  private async fetch() {
    if (this.stopped || this.fetching || !this.listeners.some(cb => cb.active !== false)) return
    this.fetching = true
    try {
      const res = await fetch(this.config.url, {
        method: this.config.method || 'GET',
        headers: this.config.headers,
        body: this.config.body
          ? JSON.stringify(this.config.body)
          : undefined
      })

      const data = await res.json()
      if (this.stopped) return
      this.hasFetched = true
      this.lastData = data

      this.listeners.forEach(cb => this.notify(cb, data))
    } catch (err) {
      console.error('[DataSource Error]', err)
    } finally {
      this.fetching = false
    }
  }
}
