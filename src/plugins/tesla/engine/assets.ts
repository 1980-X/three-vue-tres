import type { EngineProfile } from './types'

const soundBase = 'https://opensource.cdn.icegl.cn/sound/tesla/'

export function resolveProfiles(profiles: EngineProfile[], assetBase: string): EngineProfile[] {
  const base = new URL(assetBase.endsWith('/') ? assetBase : `${assetBase}/`, document.baseURI)
  const visit = (value: unknown): unknown => {
    if (typeof value === 'string') {
      if (value.startsWith('sounds/')) return new URL(value.slice('sounds/'.length), soundBase).href
      if (value.startsWith('images/')) return new URL(value, base).href
    }
    if (Array.isArray(value)) return value.map(visit)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, visit(val)]))
    return value
  }
  return profiles.map(profile => visit(profile) as EngineProfile)
}
