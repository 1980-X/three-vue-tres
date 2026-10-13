import { ref, toRaw, watch } from 'vue'
import type VChart from 'vue-echarts'
import { customizeHttp } from '../gApi/http'
import { useChartDataPondFetch } from './useChartDataPondFetch.hook'
import { CreateComponentType, ChartFrameEnum } from '../packages/index.d'
import { useChartEditStore } from '../../stores/chartEditStore'
import { RequestDataTypeEnum } from '../enums/httpEnum'
import { newFunctionHandle, intervalUnitHandle } from '../utils/global'
import { setOption } from '../packages/public/chart'

export const useChartDataFetch = (
    targetComponent: CreateComponentType,
    useStore: typeof useChartEditStore,
    updateCallback?: (...args: any) => any,
) => {
    const vChartRef = ref<typeof VChart | null>(null)
    const store = useStore()
    const { addGlobalDataInterface } = useChartDataPondFetch()
    const update = (dataset: any) => {
        if (targetComponent.chartConfig.chartFrame === ChartFrameEnum.ECHARTS && vChartRef.value) {
            setOption(vChartRef.value, { dataset }, false)
        }
        updateCallback?.(dataset)
    }

    watch([() => targetComponent.request, () => store.requestGlobalConfig], ([request, global], _old, onCleanup) => {
        let active = true
        let timer: ReturnType<typeof setInterval> | undefined
        let unsubscribe: (() => void) | undefined
        onCleanup(() => {
            active = false
            clearInterval(timer)
            unsubscribe?.()
        })

        if (request.requestDataType === RequestDataTypeEnum.Pond) {
            unsubscribe = addGlobalDataInterface(targetComponent, useStore, (data: any) => {
                if (active) update(data)
            })
            return
        }
        if (request.requestDataType !== RequestDataTypeEnum.AJAX || !request.requestUrl?.trim()) return

        const fetchData = async () => {
            try {
                const response = await customizeHttp(toRaw(request), toRaw(global))
                if (active && response != null) {
                    update(newFunctionHandle(response.data, response, targetComponent.filter))
                }
            } catch (error) {
                if (active) console.error('GoView: 数据请求失败', error)
            }
        }
        void fetchData()
        const time = request.requestInterval ?? global.requestInterval
        const unit = request.requestInterval != null ? request.requestIntervalUnit : global.requestIntervalUnit
        if (Number.isFinite(time) && time > 0) timer = setInterval(fetchData, intervalUnitHandle(time, unit))
    }, { immediate: true, deep: true })

    return { vChartRef }
}
