<template>
  <div ref="vChartRef"></div>
</template>

<script setup lang="ts">
import { ref, PropType, watch, onMounted, onBeforeUnmount, nextTick, toRaw } from 'vue'
import { VChart, type IVChart, type IInitOption } from '@visactor/vchart'
import { transformHandler } from './transformProps'
import { IOption } from 'PLS/goView/lib/packages/components/VChart/index.d'
import { registerChartsAndComponents } from './register'
import { useChartEditStore } from 'PLS/goView/stores/chartEditStore'

// VChart按需加载: 注册图表及组件
registerChartsAndComponents()

// 事件说明 v1.13.0 https://www.visactor.io/vchart/api/API/event
const event = [
  'mousedown',
  'mouseup',
  'mouseupoutside',
  'rightdown',
  'rightup',
  'rightupoutside',
  'click',
  'dblclick',
  'mousemove',
  'mouseover',
  'mouseout',
  'mouseenter',
  'mouseleave',
  'wheel',
  'touchstart',
  'touchend',
  'touchendoutside',
  'touchmove',
  'touchcancel',
  'tap',
  'dragstart',
  'dragend',
  'drag',
  'dragenter',
  'dragleave',
  'dragover',
  'drop',
  'pan',
  'panstart',
  'panend',
  'press',
  'pressup',
  'pressend',
  'pinch',
  'pinchstart',
  'pinchend',
  'swipe',
  'dimensionHover',
  'dimensionClick',
  'dataZoomChange',
  'scrollBarChange',
  'brushStart',
  'brushChange',
  'brushEnd',
  'brushClear',
  'drill',
  'legendItemClick',
  'legendItemHover',
  'legendItemUnHover',
  'legendFilter',
  'initialized',
  'rendered',
  'renderFinished',
  'animationFinished',
  'layoutStart',
  'layoutEnd',
  'afterResize'
]
const emit = defineEmits([
  'mousedown',
  'mouseup',
  'mouseupoutside',
  'rightdown',
  'rightup',
  'rightupoutside',
  'click',
  'dblclick',
  'mousemove',
  'mouseover',
  'mouseout',
  'mouseenter',
  'mouseleave',
  'wheel',
  'touchstart',
  'touchend',
  'touchendoutside',
  'touchmove',
  'touchcancel',
  'tap',
  'dragstart',
  'dragend',
  'drag',
  'dragenter',
  'dragleave',
  'dragover',
  'drop',
  'pan',
  'panstart',
  'panend',
  'press',
  'pressup',
  'pressend',
  'pinch',
  'pinchstart',
  'pinchend',
  'swipe',
  'dimensionHover',
  'dimensionClick',
  'dataZoomChange',
  'scrollBarChange',
  'brushStart',
  'brushChange',
  'brushEnd',
  'brushClear',
  'drill',
  'legendItemClick',
  'legendItemHover',
  'legendItemUnHover',
  'legendFilter',
  'initialized',
  'rendered',
  'renderFinished',
  'animationFinished',
  'layoutStart',
  'layoutEnd',
  'afterResize'
])

const props = defineProps({
  option: {
    type: Object as PropType<
      IOption & {
        dataset: any
      }
    >,
    required: true
  },
  initOptions: {
    type: Object as PropType<
      IInitOption & {
        deepWatch?: boolean | number
      }
    >,
    required: false,
    default: () => ({})
  }
})

const vChartRef = ref()
let chart: IVChart | undefined
let disposed = false
let updatePending = false
const store = useChartEditStore()
const scheduleUpdate = () => {
  if (updatePending) return
  updatePending = true
  nextTick(() => {
    updatePending = false
    if (!disposed) createOrUpdateChart(props.option)
  })
}

// 排除 data 监听
watch(
  () => {
    const { dataset, ...option } = props.option
    return option
  },
  scheduleUpdate,
  {
    deep: props.initOptions?.deepWatch ?? true
  }
)
watch(
  () => props.option.dataset,
  scheduleUpdate,
  {
    deep: false
  }
)
onMounted(scheduleUpdate)

// 更新
const createOrUpdateChart = (
  chartProps: IOption & {
    dataset: any
  }
) => {
  if (vChartRef.value && !chart) {
    const spec = transformHandler[chartProps.category || '']?.(chartProps)
    chart = new VChart(
      { ...spec, data: chartProps.dataset },
      {
        dom: vChartRef.value,
        theme: store.editCanvasConfig.vChartThemeName,
        ...props.initOptions
      }
    )
    event.forEach(eventName => {
      chart!.on(eventName as any, (data: any) => emit(eventName as any, data))
    })
    chart.renderSync()
    return true
  } else if (chart) {
    const spec = transformHandler[chartProps.category || '']?.(chartProps)
    chart.updateSpec({ ...spec, data: toRaw(chartProps.dataset), dataset: undefined }, false, undefined, {
      change: false,
      reMake: true,
      reAnimate: true
    })
    return true
  }
  return false
}

// 刷新
const refresh = () => {
  if (chart) {
    chart.renderSync()
  }
}

const release = () => {
  chart?.release()
  chart = undefined
}

// 卸载
onBeforeUnmount(() => {
  disposed = true
  release()
})

defineExpose({
  // 重刷新
  refresh,
  release
})
</script>
