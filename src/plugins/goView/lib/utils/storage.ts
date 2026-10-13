/*
 * @Description:
 * @Version: 1.668
 * @Autor: 地虎降天龙
 * @Date: 2024-05-22 20:54:09
 * @LastEditors: 地虎降天龙
 * @LastEditTime: 2024-06-01 09:41:13
 */
import { cloneDeep, merge } from 'lodash'
import { useChartEditStore } from '../../stores/chartEditStore'
import { PublicConfigClass } from '../packages/public/publicConfig'

export const getSessionStorageInfo = (dataJson: any, chartEditStore = useChartEditStore()) => {
    if (!dataJson?.editCanvasConfig || !Array.isArray(dataJson.componentList)) {
        throw new TypeError('配置需要包含 editCanvasConfig 和 componentList')
    }
    const data = cloneDeep(dataJson)
    const normalizeComponent = (item: any): any => {
        if (!item?.attr || (!item.isGroup && !item.chartConfig?.key)) {
            throw new TypeError('组件缺少 attr 或 chartConfig.key')
        }
        const component = merge({}, new PublicConfigClass(), item)
        if (item.isGroup) component.groupList = (item.groupList || []).map(normalizeComponent)
        return component
    }
    const componentList = data.componentList.map(normalizeComponent)
    chartEditStore.$reset()
    chartEditStore.$patch({
        editCanvasConfig: merge({}, chartEditStore.editCanvasConfig, data.editCanvasConfig),
        requestGlobalConfig: merge({}, chartEditStore.requestGlobalConfig, data.requestGlobalConfig),
        componentList,
    })
    return data
}
