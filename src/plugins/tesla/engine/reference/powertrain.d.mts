import type { EngineConfig, EngineFrame, MotionSnapshot, Pedals } from '../types'
export class VehicleModel {
  constructor(config?: Partial<EngineConfig['vehicle']>)
  resistance(speed: number): number
  maxDrive(speed: number): number
  acceleration(speed: number, throttle: number, brake: number, multiplier?: number): number
  estimatePedals(speed: number, acceleration: number): Pedals
}
export class PowertrainModel {
  constructor(config: EngineConfig)
  rpm: number
  gear: number
  vehicle: VehicleModel
  reset(): void
  adopt(speed: number, throttle?: number, brake?: number): void
  update(speed: number, acceleration: number, dt: number, pedals?: Pedals | null): EngineFrame
  rpmInGear(speed: number, gear: number): number
  upshiftPoint(throttle: number): number
}
export class DemoInput extends EventTarget {
  constructor()
  speed: number
  throttle: number
  brake: number
  phaseIndex: number
  mode: 'manual' | 'auto'
  status: string
  configure(config: EngineConfig): void
  start(): void
  stop(): void
  setMode(mode: 'manual' | 'auto'): void
  setGas(held: boolean): void
  setBrake(held: boolean): void
  setHoldThrottle(throttle: number): void
  setCruise(kmh: number): void
  tick(dt: number, previous?: EngineFrame | null): void
  snapshot(): MotionSnapshot
}
export const DEMO_PHASES: ReadonlyArray<Record<string, unknown>>
