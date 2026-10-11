import { DataRuntime } from './DataRuntime'
import { createComponentBindingApi } from './componentBindingApi'
import { useSeek } from 'PLS/basic'
import { nextTick, onBeforeUnmount, unref } from 'vue'
import type { TvTBindingConfig, TvTDataSourceConfig } from './types'

export const useWebDataRuntime = () => {
	const runtime = new DataRuntime()
	const componentInstances = new Map<string, any>()
	let scene: any = null
	let bindings: TvTBindingConfig[] = []
	let refreshQueued = false

	const refreshBindings = () => {
		// 同一轮组件加载只查找一次场景，等节点实际挂载后再绑定。
		if (refreshQueued) return
		refreshQueued = true
		nextTick(() => {
			refreshQueued = false
			if (!scene) return
			bindings.forEach(binding => {
				const target = useSeek().seek(scene, 'uuid', binding.objectId)
				if (target) {
					runtime.bind(binding, target, componentInstances.get(binding.objectId)?.bindingApi ?? null)
				} else {
					runtime.unbind(binding.id)
				}
			})
		})
	}

	const setScene = (context: any) => {
		scene = unref(context.scene)
		refreshBindings()
	}
	const setComponentInstance = (uuid: string, instance: any, properties: Record<string, any>) => {
		const current = componentInstances.get(uuid)
		if (!instance) {
			componentInstances.delete(uuid)
		} else if (current?.instance !== instance || current.properties !== properties) {
			componentInstances.set(uuid, {
				instance,
				properties,
				bindingApi: createComponentBindingApi(instance, properties),
			})
		}
		refreshBindings()
	}
	const initializeDataSources = (dataSources: TvTDataSourceConfig[]) => {
		dataSources.forEach(ds => runtime.registerDataSource(ds))
	}
	const bindScenes = (configs: TvTBindingConfig[]) => {
		bindings = configs
		refreshBindings()
	}

	onBeforeUnmount(() => {
		scene = null
		bindings = []
		componentInstances.clear()
		runtime.destroy()
	})

	return { runtime, initializeDataSources, bindScenes, setScene, setComponentInstance, refreshBindings }
}
