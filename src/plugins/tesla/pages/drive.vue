<template>
    <main ref="container" class="tesla-drive" tabindex="0" aria-label="Model Y 三维试驾：方向键驾驶，拖动镜头，滚轮缩放；触屏左侧驾驶、右侧转动镜头，双指缩放。">
        <header class="drive-title"><span>TESLA</span><h1>Model Y <small>Performance</small></h1></header>
        <div v-if="phase !== 'running'" class="drive-loader">
            <p role="status" aria-live="polite">{{ phase === 'error' ? error : phase === 'ready' ? '准备就绪' : `场景加载中 ${Math.round(progress * 100)}%` }}</p>
            <progress v-if="phase === 'loading'" :value="progress" max="1" aria-label="场景加载进度" />
            <button v-if="phase === 'ready'" type="button" @click="drive?.start()">开始试驾</button>
            <button v-if="phase === 'error'" type="button" @click="mountScene">重新加载</button>
        </div>
        <template v-else>
            <div class="drive-hints" aria-hidden="true">
                <div v-for="(label, index) in ['方向键驾驶', '拖拽镜头', '滚轮缩放']" :key="label">
                    <i :style="{ backgroundImage: `url('${sharedBase}textures/icoCtrls.png')`, backgroundPosition: `${index * 50}% 50%` }" />{{ label }}
                </div>
            </div>
            <button class="drive-reset" type="button" @click="drive?.reset()">重置</button>
        </template>
        <svg v-if="joystick.visible" class="drive-joystick" :style="{ left: `${joystick.x}px`, top: `${joystick.y}px` }" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="42" /><circle :cx="60 + joystick.dx" :cy="60 + joystick.dy" r="28" />
        </svg>
    </main>
</template>

<script setup>
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import { createTeslaDrive } from '../lib/drive-scene.js'
import { resolvePluginBase } from '../lib/drive-assets.js'

const container = ref(null)
const phase = ref('loading')
const progress = ref(0)
const error = ref('')
const joystick = ref({ visible: false })
const sharedBase = resolvePluginBase('ff91Drive')
const fonts = new Set()
let drive = null
let mounted = false
let deactivated = false

function mountScene() {
    drive?.dispose()
    phase.value = 'loading'
    progress.value = 0
    error.value = ''
    joystick.value = { visible: false }
    const fail = (reason) => { phase.value = 'error'; error.value = reason.message }
    try {
        drive = createTeslaDrive(container.value, {
            onProgress: (value) => { progress.value = value },
            onReady: () => { phase.value = 'ready' },
            onStart: () => { phase.value = 'running' },
            onJoystick: (value) => { joystick.value = value },
            onError: fail,
        })
        if (deactivated) drive.pause()
    } catch (reason) { fail(reason) }
}

onMounted(() => {
    mounted = true
    mountScene()
    if (typeof FontFace === 'undefined' || !document.fonts) return
    for (const [weight, name] of [[300, 'light'], [700, 'bold']]) {
        new FontFace('TeslaDriveRoboto', `url("${sharedBase}fonts/roboto-${name}.ttf")`, { weight: String(weight), display: 'swap' }).load().then((font) => {
            if (mounted) { document.fonts.add(font); fonts.add(font) }
        }).catch(() => {})
    }
})
onActivated(() => { deactivated = false; drive?.resume() })
onDeactivated(() => { deactivated = true; drive?.pause(); joystick.value = { visible: false } })
onBeforeUnmount(() => {
    mounted = false
    drive?.dispose()
    for (const font of fonts) document.fonts.delete(font)
    fonts.clear()
})

defineExpose({
    start: () => drive?.start(), pause: () => drive?.pause(), resume: () => drive?.resume(),
    reset: () => drive?.reset(), setInput: (input) => drive?.setInput(input), getState: () => drive?.getState(),
})
</script>

<style scoped>
.tesla-drive { position: relative; width: 100%; height: 100%; min-height: 360px; overflow: hidden; isolation: isolate; background: #393533; color: #fff; font-family: TeslaDriveRoboto, Arial, sans-serif; font-weight: 300; touch-action: none; outline: none; }
.tesla-drive:focus-visible { outline: 1px solid #bd9989; outline-offset: -1px; }
.drive-title { position: absolute; z-index: 1; top: 28px; left: 32px; pointer-events: none; }
.drive-title > span { font-size: 11px; letter-spacing: 5px; }
.drive-title h1 { margin: 8px 0 0; color: inherit; font-size: 30px; font-weight: 300; }
.drive-title small { display: block; margin-top: 4px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; }
.drive-loader { position: absolute; z-index: 2; left: 50%; bottom: 12%; width: min(320px, 80%); transform: translateX(-50%); text-align: center; }
.drive-loader p { margin: 0 0 12px; font-size: 14px; }
.drive-loader progress { width: 160px; height: 4px; accent-color: #bd9989; }
.tesla-drive button { padding: 11px 24px; border: 1px solid #a5897a; border-radius: 3px; background: #393533db; color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
.tesla-drive button:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
.drive-hints { position: absolute; z-index: 1; left: 20px; bottom: 18px; display: flex; gap: 20px; pointer-events: none; }
.drive-hints > div { display: grid; justify-items: center; gap: 4px; color: #bbb; font-size: 10px; }
.drive-hints i { display: block; width: 35px; height: 35px; background-size: 300% 100%; }
.drive-reset { position: absolute; z-index: 2; right: 20px; bottom: 20px; }
.drive-joystick { position: absolute; z-index: 2; transform: translate(-60px, -60px); pointer-events: none; fill: none; stroke: #fff; stroke-width: 2; }
.drive-joystick circle + circle { stroke-width: 5; }
@media (pointer: coarse) { .drive-hints { display: none; } }
@media (max-width: 600px) { .drive-title { top: 20px; left: 20px; } .drive-title h1 { font-size: 24px; } }
</style>
