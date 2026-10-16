<template>
    <div ref="container" class="ff91-drive" tabindex="0" :aria-label="text.instructions">
        <div class="ff91-loader" :class="{ visible: phase !== 'running' }">
            <h1>FF 91 VR Test Ride</h1>
            <div v-if="phase === 'loading'" class="ff91-progress" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="text.loading">
                <span :style="{ width: `${progress * 100}%` }" />
            </div>
            <p role="status" aria-live="polite">{{ phase === 'error' ? errorMessage : phase === 'ready' ? text.begin : text.loading }}</p>
            <button v-if="phase === 'ready'" class="ff91-begin" type="button" :aria-label="text.begin" @click="start">{{ text.begin }}</button>
            <template v-if="phase === 'error'">
                <button class="ff91-retry" type="button" @click="mountExperience">{{ text.retry }}</button>
                <a class="ff91-gallery" href="https://www.ff.com/us/ff-91" target="_blank" rel="noopener noreferrer">GO TO FF 91 GALLERY</a>
            </template>
        </div>
        <div v-if="showControls && phase === 'running'" class="ff91-hints" aria-hidden="true">
            <div v-for="(label, index) in text.hints" :key="index" class="ff91-hint">
                <div class="ff91-hint-icon" :style="{ backgroundImage: `url('${base}textures/icoCtrls.png')`, backgroundPosition: `${index * 50}% 50%` }" />
                <span>{{ label }}</span>
            </div>
        </div>
        <svg v-if="joystick.visible" class="ff91-joystick" :style="{ left: `${joystick.x}px`, top: `${joystick.y}px` }" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="42" class="outer" />
            <path d="M49 11 60 2 71 11 M11 49 2 60 11 71 M71 107 60 118 49 107 M107 71 118 60 107 49" />
            <circle :cx="60 + joystick.dx" :cy="60 + joystick.dy" r="30" class="inner" />
        </svg>
    </div>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { createFF91Experience } from '../lib/experience.js'
import { resolveAssetBase } from '../lib/assets.js'

const props = defineProps({
    assetBase: { type: String, default: '' },
    autoStart: { type: Boolean, default: false },
    showControls: { type: Boolean, default: true },
    pixelRatio: { type: Number, default: 1 },
    locale: { type: String, default: 'en' },
    paused: { type: Boolean, default: false },
    gyroscope: { type: Boolean, default: true },
})
const emit = defineEmits(['ready', 'progress', 'start', 'error', 'dispose'])
const container = ref(null)
const phase = ref('loading')
const progress = ref(0)
const errorMessage = ref('')
const joystick = ref({ visible: false, x: 0, y: 0, dx: 0, dy: 0 })
const base = ref('')
const text = computed(() => props.locale === 'zh' ? {
    loading: '加载中…', begin: '点击画面或按 Enter 开始', retry: '重新加载',
    hints: ['方向控制', '拖拽镜头', '滑动缩放'],
    instructions: 'FF 91 交互试驾。点击或按 Enter 开始；方向键驾驶，拖动镜头，滚轮缩放。触屏左侧驾驶、右侧转动镜头，双指缩放。',
} : {
    loading: 'Loading assets...', begin: 'Tap screen to begin.', retry: 'Try again',
    hints: ['Car controls', 'Drag camera', 'Scroll zoom'],
    instructions: 'FF 91 test ride. Click or press Enter to begin. Arrow keys drive, drag to orbit, scroll to zoom. On touch screens, drag the left half to drive, the right half to orbit, and pinch to zoom.',
})
let experience = null
let mounted = false
let deactivated = false
let generation = 0
const fonts = new Set()

function disposeInstance() {
    experience?.dispose()
    experience = null
    for (const font of fonts) document.fonts.delete(font)
    fonts.clear()
    joystick.value = { visible: false, x: 0, y: 0, dx: 0, dy: 0 }
}

function mountExperience() {
    if (!mounted) return
    const current = ++generation
    disposeInstance()
    phase.value = 'loading'
    progress.value = 0
    errorMessage.value = ''
    const fail = (error) => {
        if (current !== generation) return
        phase.value = 'error'
        errorMessage.value = error.message
        emit('error', error)
    }
    try {
        base.value = resolveAssetBase(props.assetBase)
        experience = createFF91Experience(container.value, {
            assetBase: base.value, autoStart: props.autoStart, pixelRatio: props.pixelRatio, gyroscope: props.gyroscope,
            onProgress: (value) => { if (current === generation) { progress.value = value; emit('progress', value) } },
            onReady: (api) => { if (current === generation) { progress.value = 1; phase.value = 'ready'; emit('ready', api) } },
            onStart: () => { if (current === generation) { phase.value = 'running'; emit('start') } },
            onJoystick: (value) => { if (current === generation) joystick.value = value },
            onError: fail,
        })
        if (props.paused || deactivated) experience.pause()
        experience.ready.catch(() => {})
        if (typeof FontFace !== 'undefined' && document.fonts) {
            for (const [weight, name] of [[300, 'light'], [700, 'bold']]) {
                new FontFace('FF91Roboto', `url("${base.value}fonts/roboto-${name}.ttf")`, { weight: String(weight), display: 'swap' }).load().then((font) => {
                    if (mounted && current === generation) { document.fonts.add(font); fonts.add(font) }
                }).catch(() => {})
            }
        }
    } catch (error) { fail(error) }
}

const start = () => experience?.start()
const pause = () => experience?.pause()
const resume = () => experience?.resume()
const reset = () => experience?.reset()
const setInput = (input) => experience?.setInput(input)
const setLights = (lights) => experience?.setLights(lights)
const getState = () => experience?.getState() || { status: phase.value }
defineExpose({ start, pause, resume, reset, setInput, setLights, getState })

onMounted(() => { mounted = true; mountExperience() })
onActivated(() => { deactivated = false; if (!props.paused) experience?.resume() })
onDeactivated(() => { deactivated = true; experience?.pause() })
onBeforeUnmount(() => { mounted = false; generation++; disposeInstance(); emit('dispose') })
watch(() => [props.assetBase, props.pixelRatio, props.autoStart, props.gyroscope], mountExperience)
watch(() => props.paused, (value) => { if (value || deactivated) experience?.pause(); else experience?.resume() })
</script>

<style scoped>
.ff91-drive { position: relative; width: 100%; height: 100%; min-height: 240px; overflow: hidden; isolation: isolate; container-type: inline-size; background: #393533; color: #fff; font-family: FF91Roboto, Roboto, Arial, sans-serif; font-weight: 300; touch-action: none; outline: none; }
.ff91-drive:focus-visible { outline: 1px solid #99604c; outline-offset: -1px; }
.ff91-loader { position: absolute; z-index: 2; width: 300px; left: 50%; top: 50%; margin: -35px 0 0 50px; background: rgba(57,53,51,.7); opacity: 0; transform: translateY(10px); transition: opacity .5s, transform .5s; pointer-events: none; user-select: none; }
.ff91-loader.visible { opacity: 1; transform: translateY(0); }
.ff91-loader h1 { margin: 0; color: inherit; font-size: 26px; line-height: normal; font-weight: 300; }
.ff91-loader p { margin: 0; padding-top: 5px; font-size: 16px; line-height: normal; }
.ff91-progress { width: 100px; height: 3px; margin: 5px 0 0 1px; border: 1px solid #99604c; }
.ff91-progress span { display: block; height: 100%; background: #99604c; }
.ff91-begin { position: absolute; inset: 0; opacity: 0; cursor: pointer; pointer-events: auto; }
.ff91-begin:focus-visible { opacity: 1; color: #fff; border: 1px solid #99604c; background: #393533; }
.ff91-retry,.ff91-gallery { display: inline-block; margin: 15px 12px 0 0; padding: 12px 18px; border: 0; color: #fff; background: #99604c; font: 700 12px FF91Roboto, sans-serif; text-decoration: none; cursor: pointer; pointer-events: auto; }
.ff91-hints { position: absolute; z-index: 1; left: 10px; bottom: 10px; display: flex; gap: 20px; color: #999; pointer-events: none; }
.ff91-hint { width: 70px; height: 45px; text-align: center; }
.ff91-hint-icon { display: inline-block; width: 35px; height: 35px; background-size: 300% 100%; background-repeat: no-repeat; }
.ff91-hint span { display: block; font-size: 6px; line-height: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; }
.ff91-joystick { position: absolute; z-index: 2; overflow: visible; transform: translate(-60px,-60px); pointer-events: none; fill: none; stroke: #fff; }
.ff91-joystick path { stroke: #888; stroke-width: 2; }
.ff91-joystick .outer { stroke-width: 2; }
.ff91-joystick .inner { stroke-width: 6; }
@media (pointer: coarse) { .ff91-hints { display: none; } }
@container (max-width: 600px) { .ff91-loader { margin: 70px 0 0 -110px; width: 220px; } }
@media (max-width: 600px) { .ff91-loader { margin: 70px 0 0 -110px; width: 220px; } }
@media (prefers-reduced-motion: reduce) { .ff91-loader { transition: none; } }
</style>
