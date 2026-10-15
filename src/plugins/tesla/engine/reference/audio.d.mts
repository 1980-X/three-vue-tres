import type { EngineFrame, EngineProfile, EngineSettings } from '../types'
export class AudioEngine extends EventTarget {
  constructor()
  ctx: AudioContext | null
  nodes: { analyser: AnalyserNode; master: GainNode } | null
  state: string
  readonly contextState: string
  start(profile: EngineProfile, settings: Partial<EngineSettings>, options?: { allowSuspended?: boolean }): Promise<void>
  switchProfile(profile: EngineProfile): Promise<boolean>
  applySettings(settings: Partial<EngineSettings>): void
  update(frame: EngineFrame): void
  level(): number
  resume(): Promise<boolean>
  stop(options?: { fadeS?: number }): Promise<void>
}
