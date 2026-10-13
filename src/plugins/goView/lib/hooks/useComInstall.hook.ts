import { getCurrentInstance, ref, watch } from 'vue'
import { fetchChartComponent } from '../packages/index'

export const useComInstall = (store: any) => {
    const show = ref(false)
    const app = getCurrentInstance()!.appContext.app
    const install = (item: any) => {
        if (item.isGroup) {
            item.groupList.forEach(install)
            return
        }
        const { chartKey } = item.chartConfig
        if (!app.component(chartKey)) {
            const component = fetchChartComponent(item.chartConfig)
            if (component) app.component(chartKey, component)
            else console.warn(`GoView: 未找到组件 ${item.chartConfig.key}`)
        }
    }
    watch(() => store.componentList, (list) => {
        list.forEach(install)
        show.value = true
    }, { immediate: true, flush: 'sync' })
    return { show }
}
