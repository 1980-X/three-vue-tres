<!--
 * @Description: 
 * @Version: 1.668
 * @Autor: 地虎降天龙
 * @Date: 2024-05-27 11:22:46
 * @LastEditors: 地虎降天龙
 * @LastEditTime: 2025-09-04 15:51:35
-->
<template>
    <n-config-provider :theme="darkTheme" :hljs="hljsTheme" :locale="locale" :date-locale="dateLocale" :theme-overrides="overridesTheme">
        <div v-if="configError" role="alert">GoView 配置加载失败：{{ configError }}</div>
        <div
            v-else
            v-show="showAllComRef"
            :class="`go-preview ${chartEditStore.editCanvasConfig.previewScaleType}`"
            style="pointer-events: none"
            @mousedown="dragCanvas"
        >
            <template v-if="showEntity">
                <!-- 实体区域 -->
                <div ref="entityRef" class="go-preview-entity">
                    <!-- 缩放层 -->
                    <div ref="previewRef" class="go-preview-scale">
                        <!-- 展示层 -->
                        <div :style="previewRefStyle" v-if="showAllComRef && show">
                            <!-- 渲染层 -->
                            <preview-render-list :key="configRevision"></preview-render-list>
                            <!-- 遮罩层 -->
                            <div class="go-preview-top" :style="goPreviewMaskStyleTop"></div>
                            <div class="go-preview-mask" :style="goPreviewMaskStyle"></div>
                            <div class="go-preview-mask mask-right" :style="goPreviewMaskStyleRight"></div>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else>
                <div ref="previewRef" class="go-preview-scale">
                    <div :style="previewRefStyle" v-if="showAllComRef && show">
                        <!-- 渲染层 -->
                        <preview-render-list :key="configRevision"></preview-render-list>
                        <!-- 遮罩层 -->
                        <div class="go-preview-top" :style="goPreviewMaskStyleTop"></div>
                        <div class="go-preview-mask" :style="goPreviewMaskStyle"></div>
                        <div class="go-preview-mask mask-right" :style="goPreviewMaskStyleRight"></div>
                    </div>
                </div>
            </template>
        </div>
    </n-config-provider>
</template>

<script setup lang="ts">
import { computed, watch, ref, getCurrentInstance } from 'vue'
import { provideChartEditStore } from '../stores/chartEditStore'
import { getSessionStorageInfo, dragCanvas, getEditCanvasConfigStyle } from '../lib/utils'
import { useScale } from '../lib/hooks/useScale.hook'
import { useComInstall } from '../lib/hooks/useComInstall.hook'
import { getFilterStyle } from '../lib/utils/global'
import { PreviewScaleEnum } from 'PLS/goView/lib/enums/styleEnum'
import { PreviewRenderList } from '../components/PreviewRenderList'
import { NConfigProvider } from 'naive-ui'
import { useDarkThemeHook, useThemeOverridesHook, useCode, useLang, useInitVChartsTheme } from 'PLS/goView/lib/gHooks/'
// 暗黑主题
const darkTheme = useDarkThemeHook()
// 主题配置
const overridesTheme = useThemeOverridesHook()
// 代码主题
const hljsTheme = useCode()
// 全局语言
const { locale, dateLocale } = useLang()

const props = withDefaults(
    defineProps<{
        dataJson: any // 图表数据 goview配置文件
        showAllCom?: boolean // 是否 显示所有组件 可接入全局等待loading结果
        delay?: number // 延迟显示时间 单位毫秒 用于在three中读取完模型后 载入的延迟配置
        maskWidth?: number // 遮罩层宽度 默认500px
        maskRightWidth?: number // 右遮罩层宽度 默认-1时 使用maskWidth的宽度
        maskHeight?: number // 遮罩层高度 默认0px
        maskColor?: string // 遮罩层颜色 默认#000000
    }>(),
    {
        showAllCom: true,
        delay: 0,
        maskWidth: 500,
        maskRightWidth: -1,
        maskHeight: 0,
        maskColor: '#000000',
    },
)

import naive from 'naive-ui'
const app = getCurrentInstance()!.appContext.app
if (!app.component('NConfigProvider')) {
    app.use(naive)
}

const chartEditStore = provideChartEditStore()
const configRevision = ref(0)
const configError = ref('')
watch(() => props.dataJson, (data) => {
    try {
        getSessionStorageInfo(data, chartEditStore)
        configError.value = ''
        configRevision.value++
    } catch (error) {
        configError.value = error instanceof Error ? error.message : String(error)
    }
}, { immediate: true, deep: true })

const previewRefStyle = computed(() => {
    return {
        overflow: 'hidden',
        ...getEditCanvasConfigStyle(chartEditStore.editCanvasConfig),
        ...getFilterStyle(chartEditStore.editCanvasConfig),
    }
})
const showEntity = computed(() => {
    const type = chartEditStore.editCanvasConfig.previewScaleType
    return type === PreviewScaleEnum.SCROLL_Y || type === PreviewScaleEnum.SCROLL_X
})

// 处理全局的 vChart 主题
useInitVChartsTheme(chartEditStore)

const { entityRef, previewRef } = useScale(chartEditStore)
const { show } = useComInstall(chartEditStore)

const showAllComRef = ref(false)
watch(
    [() => props.showAllCom, () => props.delay],
    ([visible], _previous, onCleanup) => {
        showAllComRef.value = false
        if (!visible) return
        const timer = setTimeout(() => { showAllComRef.value = true }, Math.max(0, props.delay))
        onCleanup(() => clearTimeout(timer))
    },
    { immediate: true },
)

const goPreviewMaskStyle = computed(() => ({
    width: `${props.maskWidth}px`,
    background: `linear-gradient(
    to right,
    ${props.maskColor}90,
    ${props.maskColor}60 80%,
    rgba(0, 0, 0, 0)
  )`,
}))

const goPreviewMaskStyleRight = computed(() => ({
    width: `${props.maskRightWidth === -1 ? props.maskWidth : props.maskRightWidth}px`,
    background: `linear-gradient(
    to left,
    ${props.maskColor}90,
    ${props.maskColor}60 80%,
    rgba(0, 0, 0, 0)
  )`,
}))
const goPreviewMaskStyleTop = computed(() => ({
    height: `${props.maskHeight}px`,
    background: `linear-gradient(
    to bottom,
    ${props.maskColor}90,
    ${props.maskColor}60 80%,
    rgba(0, 0, 0, 0)
  )`,
}))
</script>

<style lang="scss" scoped>
@import '../lib/scss/style.scss';

@include go('preview') {
    position: relative;
    height: 100vh;
    width: 100vw;
    @include background-image('background-image');

    &.fit,
    &.full {
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;

        .go-preview-scale {
            transform-origin: center center;
        }
    }

    &.scrollY {
        overflow-x: hidden;

        .go-preview-scale {
            transform-origin: left top;
        }
    }

    &.scrollX {
        overflow-y: hidden;

        .go-preview-scale {
            transform-origin: left top;
        }
    }

    .go-preview-entity {
        overflow: hidden;
    }

    .go-preview-mask {
        height: 100%;
        &.mask-right {
            right: 0;
            position: absolute;
            top: 0;
        }
    }
    .go-preview-top {
        width: 100%;
        position: absolute;
    }
}
</style>
<style lang="less">
.go-preview {
    .chart-item {
        pointer-events: all;
    }
}
</style>
