import { ref, provide, watch } from 'vue'
import { usePreviewFitScale, usePreviewScrollYScale, usePreviewScrollXScale, usePreviewFullScale } from './usePreviewScale.hook'
import { PreviewScaleEnum } from '../enums/styleEnum'

export const SCALE_KEY = 'scale-value'

export const useScale = (store: any) => {
    const entityRef = ref<HTMLElement>()
    const previewRef = ref<HTMLElement>()
    const scaleRef = ref({ width: 1, height: 1 })
    provide(SCALE_KEY, scaleRef)

    watch([
        previewRef, entityRef,
        () => store.editCanvasConfig.width,
        () => store.editCanvasConfig.height,
        () => store.editCanvasConfig.previewScaleType,
    ], ([preview, entity, width, height, type], _old, onCleanup) => {
        if (!preview || width <= 0 || height <= 0) return
        const factories = {
            [PreviewScaleEnum.FIT]: usePreviewFitScale,
            [PreviewScaleEnum.SCROLL_Y]: usePreviewScrollYScale,
            [PreviewScaleEnum.SCROLL_X]: usePreviewScrollXScale,
            [PreviewScaleEnum.FULL]: usePreviewFullScale,
        }
        const factory = factories[type as keyof typeof factories] || usePreviewFitScale
        const { calcRate, windowResize, unWindowResize } = factory(width, height, preview, scale => {
            scaleRef.value = { ...scale }
            if (entity) {
                entity.style.width = `${width * scale.width}px`
                entity.style.height = `${height * scale.height}px`
            }
        })
        calcRate()
        windowResize()

        const onWheel = (event: WheelEvent) => {
            if (!event.ctrlKey || !preview.isConnected) return
            event.preventDefault()
            unWindowResize()
            const current = scaleRef.value.width
            const next = Math.min(5, Math.max(0.2, current + (event.deltaY < 0 ? 0.1 : -0.1)))
            preview.style.transform = `scale(${next})`
            scaleRef.value = { width: next, height: next }
        }
        const root = preview.closest('.go-preview')
        root?.addEventListener('wheel', onWheel as EventListener, { passive: false })
        onCleanup(() => {
            unWindowResize()
            root?.removeEventListener('wheel', onWheel as EventListener)
        })
    }, { immediate: true, flush: 'post' })

    return { entityRef, previewRef, scaleRef }
}
