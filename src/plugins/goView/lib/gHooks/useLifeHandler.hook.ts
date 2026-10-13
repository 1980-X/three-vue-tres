import { CreateComponentType, CreateComponentGroupType } from 'PLS/goView/lib/packages/index.d'
import { EventLife } from 'PLS/goView/lib/enums/eventEnum'
import * as echarts from 'echarts'
import { useChartEditStore } from '../../stores/chartEditStore'

// 所有图表组件集合对象
const componentMaps = new WeakMap<object, Record<string, any>>()

// 项目提供的npm 包变量
export const npmPkgs = { echarts }

// 组件事件处理 hook
export const useLifeHandler = (chartConfig: CreateComponentType | CreateComponentGroupType) => {
  if (!chartConfig.events) return {}
  const store = useChartEditStore()
  const components = componentMaps.get(store) || {}
  componentMaps.set(store, components)

  // 处理基础事件
  const baseEvent: { [key: string]: any } = {}
  for (const key in chartConfig.events.baseEvent || {}) {
    const fnStr: string | undefined = (chartConfig.events.baseEvent as any)[key]
    // 动态绑定基础事件
    if (fnStr) {
      baseEvent[key] = generateBaseFunc(fnStr, components)
    }
  }

  // 生成生命周期事件
  const events = chartConfig.events.advancedEvents || {}
  const lifeEvents = {
    [EventLife.VNODE_BEFORE_MOUNT](e: any) {
      // 存储组件
      components[chartConfig.id] = e.component
      const fnStr = (events[EventLife.VNODE_BEFORE_MOUNT] || '').trim()
      generateFunc(fnStr, e, components)
    },
    [EventLife.VNODE_MOUNTED](e: any) {
      const fnStr = (events[EventLife.VNODE_MOUNTED] || '').trim()
      generateFunc(fnStr, e, components)
    },
    vnodeBeforeUnmount(e: any) {
      if (components[chartConfig.id] === e.component) delete components[chartConfig.id]
    }
  }
  return { ...baseEvent, ...lifeEvents }
}

/**
 * 生成基础函数
 * @param fnStr 用户方法体代码
 * @param event 鼠标事件
 */
 export function generateBaseFunc(fnStr: string, components: Record<string, any> = {}) {
  try {
    return new Function(`
      return (
        async function(components,mouseEvent){
          ${fnStr}
        }
      )`)().bind(undefined,components)
  } catch (error) {
    console.error(error)
  }
}

/**
 * 生成高级函数
 * @param fnStr 用户方法体代码
 * @param e 执行生命周期的动态组件实例
 */
function generateFunc(fnStr: string, e: any, components: Record<string, any>) {
  try {
    // npmPkgs 便于拷贝 echarts 示例时设置option 的formatter等相关内容
    Function(`
      "use strict";
      return (
        async function(e, components, node_modules){
          const {${Object.keys(npmPkgs).join()}} = node_modules;
          ${fnStr}
        }
      )`)().bind(e?.component)(e, components, npmPkgs).catch(console.error)
  } catch (error) {
    console.error(error)
  }
}
