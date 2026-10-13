import { CreateComponentType } from '../packages/index.d'
import { useChartEditStore } from '../../stores/chartEditStore'

const findComponent = (list: any[], id: string): any => {
    for (const item of list) {
        if (item.id === id) return item
        const child = item.isGroup && findComponent(item.groupList || [], id)
        if (child) return child
    }
}

export const useChartInteract = (
    chartConfig: CreateComponentType,
    useStore: typeof useChartEditStore,
    param: Record<string, any>,
    interactEventOn: string,
) => {
    const store = useStore()
    const events = chartConfig.events?.interactEvents || []
    events.filter(item => item.interactOn === interactEventOn).forEach(item => {
        const pond = store.requestGlobalConfig.requestDataPond.find((pond: any) => pond.dataPondId === item.interactComponentId)
        const request = pond?.dataPondRequestConfig || findComponent(store.componentList, item.interactComponentId)?.request
        if (!request?.requestParams) return
        const { Params = {}, Header = {} } = request.requestParams
        Object.keys(item.interactFn || {}).forEach(key => {
            if (key in Params) Params[key] = param[item.interactFn[key]]
            if (key in Header) Header[key] = param[item.interactFn[key]]
        })
    })
}

// 保留移植版既有导出。
export const clearInteractEvent = (_chartConfig: CreateComponentType) => {}
