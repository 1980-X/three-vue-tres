import { toRaw, watch } from 'vue'
import { customizeHttp } from '../gApi/http'
import type { CreateComponentType } from '../packages/index.d'
import { useChartEditStore } from '../../stores/chartEditStore'
import { newFunctionHandle, intervalUnitHandle } from '../utils/global'

type Subscriber = { updateCallback: (data: any) => any; filter?: string }
type PondState = {
    callbacks: Map<string, Set<Subscriber>>
    disposers: Map<string, () => void>
    initialized: boolean
}
const pondStates = new WeakMap<object, PondState>()
const getPondState = (store: object) => {
    let state = pondStates.get(store)
    if (!state) {
        state = { callbacks: new Map(), disposers: new Map(), initialized: false }
        pondStates.set(store, state)
    }
    return state
}

const startPond = (store: ReturnType<typeof useChartEditStore>, id: string, state: PondState) => {
    if (state.disposers.has(id)) return
    const global = store.requestGlobalConfig
    const request = global.requestDataPond.find((item: any) => item.dataPondId === id)?.dataPondRequestConfig
    if (!request) {
        console.warn(`GoView: 数据池 ${id} 不存在`)
        return
    }

    let active = true
    const fetchData = async () => {
        try {
            const response = await customizeHttp(toRaw(request), toRaw(global))
            if (active && response != null) {
                state.callbacks.get(id)?.forEach(({ updateCallback, filter }) => {
                    updateCallback(newFunctionHandle(response.data, response, filter))
                })
            }
        } catch (error) {
            if (active) console.error('GoView: 数据池请求失败', error)
        }
    }
    // Header、Body 和 Params 的联动修改都需要触发更新。
    const stopWatch = watch(() => request.requestParams, fetchData, { immediate: true, deep: true })
    const time = request.requestInterval ?? global.requestInterval
    const unit = request.requestInterval != null ? request.requestIntervalUnit : global.requestIntervalUnit
    const timer = Number.isFinite(time) && time > 0 ? setInterval(fetchData, intervalUnitHandle(time, unit)) : undefined
    state.disposers.set(id, () => {
        active = false
        stopWatch()
        clearInterval(timer)
    })
}

export const useChartDataPondFetch = () => {
    const store = useChartEditStore()
    const state = getPondState(store)
    const addGlobalDataInterface = (
        target: CreateComponentType,
        _useStore: typeof useChartEditStore,
        updateCallback: (data: any) => any,
    ) => {
        const id = target.request.requestDataPondId as string
        const subscribers = state.callbacks.get(id) || new Set<Subscriber>()
        const subscriber = { updateCallback, filter: target.filter }
        subscribers.add(subscriber)
        state.callbacks.set(id, subscribers)
        if (state.initialized) startPond(store, id, state)
        return () => {
            subscribers.delete(subscriber)
            if (subscribers.size === 0) {
                state.disposers.get(id)?.()
                state.disposers.delete(id)
                state.callbacks.delete(id)
            }
        }
    }
    const clearMittDataPondMap = () => {
        state.disposers.forEach(dispose => dispose())
        state.disposers.clear()
        state.callbacks.clear()
        state.initialized = false
    }
    const initDataPond = (_useStore: typeof useChartEditStore) => {
        state.initialized = true
        state.callbacks.forEach((_callbacks, id) => startPond(store, id, state))
    }
    return { addGlobalDataInterface, clearMittDataPondMap, initDataPond }
}
