import type { TvTBindingConfig } from './types'

export class BindingManager {
  private bindings = new Map<string, {
    config: TvTBindingConfig
    object: any
    objPlus: any
    unsubscribe: () => void
  }>()
  private dataSources: Map<string, any>

  constructor(dataSources: Map<string, any>) {
    this.dataSources = dataSources
  }

  bind(bindingConfig: TvTBindingConfig, object: any, objPlus: any = null) {
    const current = this.bindings.get(bindingConfig.id)
    if (current && current.object === object && current.objPlus === objPlus &&
      current.config.handler === bindingConfig.handler && current.config.active === bindingConfig.active &&
      current.config.dataSourceId === bindingConfig.dataSourceId) return

    const dataSource = this.dataSources.get(bindingConfig.dataSourceId)
    if (!dataSource) {
      console.warn('DataSource not found:', bindingConfig.dataSourceId)
      return
    }

    const handlerFn = new Function(
      'data',
      'object',
      'objPlus',
      `return (${bindingConfig.handler})(data, object, objPlus)`
    )

    this.unbind(bindingConfig.id)
    const unsubscribe = dataSource.subscribe({
      active: bindingConfig.active,
      fun: (data: any) => {
        handlerFn(data, object, objPlus)
      }
    })

    this.bindings.set(bindingConfig.id, { config: { ...bindingConfig }, object, objPlus, unsubscribe })
  }

  unbind(id: string) {
    this.bindings.get(id)?.unsubscribe()
    this.bindings.delete(id)
  }

  clear() {
    this.bindings.forEach(binding => binding.unsubscribe())
    this.bindings.clear()
  }
}
