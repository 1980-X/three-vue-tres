/*
 * @Description: 
 * @Version: 1.668
 * @Autor: 地虎降天龙
 * @Date: 2024-09-12 16:47:13
 * @LastEditors: 地虎降天龙
 * @LastEditTime: 2024-09-12 16:58:34
 */
import { useLoop, useTres } from '@tresjs/core'
import { toRaw } from 'vue'
import { useFBO } from '../useFBO'

export function useDepthBuffer({ size = 256, frames = Infinity }: { size?: number; frames?: number } = {}) {
    const { sizes } = useTres()
    const target = useFBO({
        width: size || sizes.width.value * sizes.pixelRatio.value,
        height: size || sizes.height.value * sizes.pixelRatio.value,
        depth: true,
    })
    const { onBeforeRender } = useLoop()
    let count = 0

    onBeforeRender(({ renderer, scene, camera }) => {
        if (!target.value || !camera.value || count >= frames) return

        const previousTarget = renderer.getRenderTarget()
        try {
            renderer.setRenderTarget(toRaw(target.value))
            renderer.render(toRaw(scene.value), toRaw(camera.value))
            count++
        } finally {
            renderer.setRenderTarget(previousTarget)
        }
    })

    return target.value!.depthTexture!
}
