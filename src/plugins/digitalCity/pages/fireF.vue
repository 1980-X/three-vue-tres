<!--
 * @Description:
 * @Version: 1.668
 * @Autor: 地虎降天龙
 * @Date: 2024-12-03 15:24:52
 * @LastEditors: 地虎降天龙
 * @LastEditTime: 2026-01-28 09:52:06
-->
<template>
    <pagesShow ref="pagesShowRef">
        <template v-slot:ability>
            <fireF :position="[0, 20, 10]" :scale="40" />
            <TresGroup :rotation="[0, 0, rotation]" :scale="[1, stretchY, 1]">
                <fireF :position="[posX, posY, posZ]" :scale="scale" :visible="visible" v-bind="lightConfig" />
            </TresGroup>
        </template>
    </pagesShow>
</template>

<script setup lang="ts">
import { ref, watch, reactive, onBeforeUnmount } from 'vue'
import pagesShow from '../components/pagesShow.vue'
import { fireF } from 'PLS/digitalCity'
import { Pane } from 'tweakpane'

const pagesShowRef = ref() as any
watch(
    () => pagesShowRef.value?.contextReady,
    (newVal: any) => {
        if (newVal) {
            pagesShowRef.value.context.context.camera.activeCamera.value.position.set(580, 360, 500)
        }
    }
)

const posX = ref(100)
const posY = ref(100)
const posZ = ref(100)
const scale = ref(100)
const rotation = ref(0)
const stretchY = ref(1)
const visible = ref(true)
const lightConfig = reactive({
    hasPointLight: true,
    flickerLightIntensity: 10,
    flickerLightIntensityFlux: 2,
    flickerLightColor: '#ffaa33',
    lightDistance: 0,
    lightDecay: 1,
    lightCastShadow: false,
})
const paneControl = new Pane()
paneControl.addBinding(posX, 'value', {
    label: 'x',
    min: -100.0,
    max: 100.0,
    step: 10,
})
paneControl.addBinding(posY, 'value', {
    label: 'y',
    min: -100.0,
    max: 100.0,
    step: 10,
})
paneControl.addBinding(posZ, 'value', {
    label: 'z',
    min: -100.0,
    max: 100.0,
    step: 10,
})
paneControl.addBinding(scale, 'value', {
    label: 'scale',
    min: 0.1,
    max: 100,
    step: 0.1,
})
paneControl.addBinding(rotation, 'value', { label: '父级旋转', min: -Math.PI, max: Math.PI, step: 0.01 })
paneControl.addBinding(stretchY, 'value', { label: '父级Y轴缩放', min: 0.1, max: 3, step: 0.1 })
paneControl.addBinding(visible, 'value', { label: '显示火焰' })
paneControl.addBinding(lightConfig, 'hasPointLight', {
    label: '启用点光源',
})
paneControl.addBinding(lightConfig, 'flickerLightIntensity', {
    label: 'intensity',
    min: 0.1,
    max: 10,
    step: 0.1,
})
paneControl.addBinding(lightConfig, 'flickerLightIntensityFlux', {
    label: '闪烁强度',
    min: 0.1,
    max: 20,
    step: 0.1,
})
paneControl.addBinding(lightConfig, 'flickerLightColor', {
    label: 'lightcolor',
})
paneControl.addBinding(lightConfig, 'lightDistance', { label: '光照距离', min: 0, max: 1000, step: 1 })
paneControl.addBinding(lightConfig, 'lightDecay', { label: '光照衰减', min: 0, max: 2, step: 0.1 })
paneControl.addBinding(lightConfig, 'lightCastShadow', { label: '光源阴影' })
onBeforeUnmount(() => paneControl.dispose())
</script>
