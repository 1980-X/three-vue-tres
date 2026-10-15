import { inject, provide, shallowRef, onBeforeUnmount } from 'vue'
import type { InjectionKey } from 'vue'
import { EngineController } from '../engine/controller'
import { resolveProfiles } from '../engine/assets'
import rawProfiles from '../data/profiles.json'
import type { EngineProfile } from '../engine/types'

export function createEngineContext(assetBase: string, storageKey?: string) {
  const profiles = resolveProfiles(rawProfiles as unknown as EngineProfile[], assetBase)
  const controller = new EngineController(profiles, { storageKey })
  const state = shallowRef({ ...controller.state })
  const unsubscribe = controller.subscribe(next => { state.value = next })
  onBeforeUnmount(() => { unsubscribe(); controller.dispose() })
  const context = { controller, state, profiles }
  provide(engineKey, context)
  return context
}

type EngineContext = ReturnType<typeof createEngineContext>
const engineKey: InjectionKey<EngineContext> = Symbol('ev-engine')
export function useEngine() {
  const context = inject(engineKey)
  if (!context) throw new Error('Engine context is missing')
  return context
}
