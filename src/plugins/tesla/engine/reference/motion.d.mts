import type { FixResult, MotionFix, MotionSnapshot, MotionStats, ProcessingMode } from '../types'
export interface MotionOptions { mode?: ProcessingMode; [key: string]: unknown }
export const MOTION_DEFAULTS: Readonly<Record<string, unknown>>
export class MotionEstimator {
  constructor(options?: MotionOptions)
  opts: MotionOptions
  defaults: MotionOptions
  stats: MotionStats
  reset(): void
  addFix(fix: MotionFix): FixResult
  snapshot(now: number): MotionSnapshot
}
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number
