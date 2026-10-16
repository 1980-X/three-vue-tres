import type { VehicleModelId } from './vehicles'

export type InputMode = 'gps' | 'demo'
export type MotionQuality = 'none' | 'fresh' | 'stale' | 'lost' | 'demo'
export type ProcessingMode = 'smooth' | 'adaptive'
export type PageName = 'dashboard' | 'diagnostics' | 'tesla' | 'tesla3d'

export interface EngineSettings {
  modelId: VehicleModelId
  volume: number
  intensity: number
  shiftSounds: boolean
  processingMode: ProcessingMode
  pollMs: number
}

export interface SoundLayer {
  id: string
  rpm: number
  load: 'idle' | 'on' | 'off'
  gain?: number
  file?: string
}

export interface EngineConfig {
  engine: { idleRpm: number; redlineRpm: number; limiterRpm?: number; cylinders: number }
  gearbox: {
    ratios: number[]; finalDrive: number; tireCircumferenceM: number
    upshiftRpm: number; downshiftRpm: number; shiftTimeMs?: number
    cruiseUpshiftRpm?: number; launchRpm?: number
  }
  vehicle: { massKg: number; powerKw: number; topSpeedKmh: number }
  source: 'synth' | 'samples'
  layers: SoundLayer[]
  mix?: Record<string, number>
  synth?: Record<string, unknown>
  shiftSound?: { file: string; gain?: number }
  afterfire?: Record<string, unknown>
  [key: string]: unknown
}

export interface EngineProfile {
  id: number
  slug: string
  name: string
  displayName?: string
  description?: string
  tagline?: string
  image: string
  config: EngineConfig
  categories?: string[]
  sourceMetadata?: Record<string, unknown>
  [key: string]: unknown
}

export interface MotionFix {
  latitude: number; longitude: number; accuracy: number | null
  speed: number | null; timestamp: number; receivedAt: number
}

export interface MotionSnapshot {
  speedMps: number
  accelMps2: number
  rawSpeedMps: number | null
  source: 'gps' | 'derived' | 'demo' | null
  quality: MotionQuality
  ageS: number | null
  accuracyM: number | null
  throttle?: number
  brake?: number
  /** Manual demo wheel input: -1 right, +1 left. */
  steering?: number
  /** GPS course in degrees; clockwise turn rate, estimated only while moving. */
  headingDeg?: number | null
  turnRateDegS?: number
}

export interface MotionStats {
  received: number; accepted: number; rejected: number
  withSpeed: number; retimed: number; reasons: Record<string, number>
}

export interface FixResult { accepted: boolean; reason: string; retimed?: boolean }
export interface Pedals { throttle: number; brake: number }
export interface EngineFrame extends Pedals {
  rpm: number; gear: number; gearLabel: string; load: number
  shifting: boolean; shiftDir: 'up' | 'down' | null
  shiftEvent: 'up' | 'down' | null; limiter: boolean
}

export interface EngineLog { id: number; time: string; level: 'info' | 'warn' | 'error'; message: string }
export interface EngineState {
  status: 'off' | 'starting' | 'running' | 'switching' | 'paused' | 'error'
  mode: InputMode
  demoMode: 'manual' | 'auto'
  profileId: number
  settings: EngineSettings
  motion: MotionSnapshot
  engine: EngineFrame
  stats: MotionStats
  gpsStatus: string
  intervalMs: number | null
  contextState: string
  audioBlocked: boolean
  progress: number
  level: number
  waveform: number[]
  maxSpeedKmh: number
  elapsedS: number
  demoPhase: number
  error: string
  notice: string
  logs: EngineLog[]
}

export const emptyMotion = (): MotionSnapshot => ({ speedMps: 0, accelMps2: 0, rawSpeedMps: null, source: null, quality: 'none', ageS: null, accuracyM: null })
export const emptyFrame = (): EngineFrame => ({ rpm: 0, gear: 1, gearLabel: 'N', load: 0, throttle: 0, brake: 0, shifting: false, shiftDir: null, shiftEvent: null, limiter: false })
export const emptyStats = (): MotionStats => ({ received: 0, accepted: 0, rejected: 0, withSpeed: 0, retimed: 0, reasons: {} })
