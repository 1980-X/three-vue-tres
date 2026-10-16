<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useEngine } from '../composables/engineContext'
import { createTeslaDrive } from '../lib/drive-scene.js'
import UiIcon from '../components/UiIcon.vue'
import type { InputMode, PageName } from '../engine/types'

const emit = defineEmits<{ navigate: [page: PageName] }>()
const { state, controller, profiles } = useEngine()
const profile = computed(() => profiles.find(item => item.id === state.value.profileId)!)
const container = ref<HTMLElement | null>(null)
const phase = ref('loading')
const progress = ref(0)
const error = ref('')
const inputMode = ref<InputMode>('gps')
const changingMode = ref(false)
const cameraView = ref<'exterior' | 'interior'>('exterior')
const sensorStatus = computed(() => state.value.motion.turnSensorStatus || 'off')
const sensorLabel = computed(() => ({ off: '启用转向感应', permission: '启用转向感应', requesting: '等待感应授权', waiting: '等待感应数据', active: '转向感应已连接', denied: '感应未授权', unsupported: '仅 GPS 转向', insecure: '感应需要 HTTPS', unavailable: '无感应数据' })[sensorStatus.value])
const sensorHint = computed(() => sensorStatus.value === 'denied' ? '请在浏览器中允许方向感应；当前继续使用 GPS 转向。' : ['unsupported', 'unavailable'].includes(sensorStatus.value) ? '当前设备未提供方向感应数据，继续使用 GPS 转向。' : '将手机固定放置，使用方向感应辅助识别左右转弯；点击可启用或重新连接。')
const turnLabel = computed(() => {
    const motion = state.value.motion
    if (motion.quality !== 'fresh') return '等待有效 GPS 信号'
    if (motion.speedMps < .8 || motion.rawSpeedMps === 0) return '等待车辆行驶'
    if (!motion.turnSource) return '等待行驶方向 · 可启用转向感应辅助识别'
    const source = { gps: 'GPS 航向', derived: '行驶轨迹', sensor: '转向感应' }[motion.turnSource]
    const rate = motion.turnRateDegS || 0
    return `${source} · ${rate > 0 ? '右转' : rate < 0 ? '左转' : '直行'}`
})
const heldKeys = new Set<string>()
const driveKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space']
let drive: ReturnType<typeof createTeslaDrive> | null = null
let disposed = false
let generation = 0

watch([state, profile], () => drive?.setTelemetry(state.value, profile.value))
watch(cameraView, view => drive?.setCameraView(view))
watch(() => state.value.settings.modelId, () => { if (container.value) mountScene() })

function mountScene() {
    drive?.dispose()
    drive = null
    phase.value = 'loading'
    progress.value = 0
    error.value = ''
    const fail = (reason: Error) => { phase.value = 'error'; error.value = reason.message }
    try {
        drive = createTeslaDrive(container.value, {
            telemetry: true,
            modelId: state.value.settings.modelId,
            onProgress: (value: number) => { progress.value = value },
            onStart: () => { phase.value = 'running' },
            onError: fail,
        })
        drive.setTelemetry(state.value, profile.value)
        drive.setCameraView(cameraView.value)
    } catch (reason) { fail(reason instanceof Error ? reason : new Error(String(reason))) }
}

async function automaticStart() {
    if (disposed || document.hidden || changingMode.value || controller.busy || state.value.status === 'running') return
    const token = ++generation
    if (state.value.mode !== inputMode.value) await controller.setMode(inputMode.value)
    if (disposed || token !== generation || document.hidden) return
    await startSession()
}

function startSession(automatic = true) {
    if (inputMode.value === 'demo') {
        controller.setDemoMode('manual')
        controller.setHoldThrottle(0)
    }
    const starting = controller.start({ automatic, monitoring: true })
    syncKeyboard()
    return starting
}

async function toggleInputMode() {
    if (disposed || changingMode.value) return
    changingMode.value = true
    const token = ++generation
    const next = inputMode.value === 'gps' ? 'demo' : 'gps'
    releaseKeyboard()
    try {
        // Cancel in-flight GPS/audio startup before choosing the other source.
        await controller.stop()
        if (disposed || token !== generation || document.hidden) return
        await controller.setMode(next)
        if (disposed || token !== generation || document.hidden) return
        inputMode.value = next
        void startSession()
        container.value?.focus({ preventScroll: true })
    } finally { changingMode.value = false }
}

function syncKeyboard() {
    if (changingMode.value || inputMode.value !== 'demo' || state.value.mode !== 'demo') return
    const has = (...codes: string[]) => codes.some(code => heldKeys.has(code))
    controller.setGas(has('ArrowUp', 'KeyW'))
    controller.setBrake(has('ArrowDown', 'KeyS', 'Space'))
    controller.setSteering(Number(has('ArrowLeft', 'KeyA')) - Number(has('ArrowRight', 'KeyD')))
}
function releaseKeyboard() { heldKeys.clear(); controller.releasePedals() }
function keydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.code === 'Escape') { event.preventDefault(); emit('navigate', 'dashboard'); return }
    const target = event.target as HTMLElement
    if (target.isContentEditable || target.closest('button, a, input, select, textarea')) return
    if (inputMode.value === 'demo' && driveKeys.includes(event.code)) {
        event.preventDefault()
        if (changingMode.value || document.hidden) return
        heldKeys.add(event.code)
        syncKeyboard()
        if (!event.repeat) activateSound()
    } else if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault()
        activateSound()
    }
}
function keyup(event: KeyboardEvent) {
    if (!heldKeys.delete(event.code)) return
    event.preventDefault()
    syncKeyboard()
}
function activateSound(event?: Event) {
    const target = event?.target
    if (disposed || changingMode.value || target instanceof Element && target.closest('button')) return
    if (state.value.audioBlocked || controller.busy) void controller.resumeSound()
    else if (state.value.status !== 'running') void startSession(false)
}
function enableTurnSensor() {
    if (!disposed && !changingMode.value && inputMode.value === 'gps') void controller.gps.enableTurnSensor()
}
function visibility() { if (document.hidden) releaseKeyboard(); else void automaticStart() }
onMounted(() => {
    mountScene()
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pageshow', visibility)
    window.addEventListener('blur', releaseKeyboard)
    void automaticStart()
})
onBeforeUnmount(() => {
    disposed = true
    ++generation
    releaseKeyboard()
    drive?.dispose()
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('pageshow', visibility)
    window.removeEventListener('blur', releaseKeyboard)
})
</script>

<template>
    <section ref="container" class="tesla-live-drive" tabindex="0" aria-label="Tesla 三维车机。顶部切换 GPS 或键盘模拟、车内外视角，并可启用转向感应；方向键或 WASD 驾驶，空格刹车，Esc 返回设置。"
        @pointerdown="activateSound" @keydown="keydown" @keyup="keyup" @focusout="releaseKeyboard">
        <header class="tesla-live-toolbar" aria-label="三维车机控制" @pointerdown.stop>
            <button type="button" :class="{ active: inputMode === 'demo' }" :disabled="changingMode" title="键盘模拟与 GPS 输入互斥" @click="toggleInputMode">
                <UiIcon :name="inputMode === 'demo' ? 'gps' : 'play'" :size="16" />{{ changingMode ? '切换中' : inputMode === 'demo' ? '使用 GPS' : '键盘模拟' }}
            </button>
            <button v-if="inputMode === 'gps'" type="button" :class="{ active: sensorStatus === 'active' }" :disabled="changingMode || ['requesting', 'unsupported', 'insecure'].includes(sensorStatus)" :title="sensorHint" @click="enableTurnSensor">
                <UiIcon name="activity" :size="16" />{{ sensorLabel }}
            </button>
            <button type="button" :title="cameraView === 'exterior' ? '当前车外视角' : '当前车内视角'" @click="cameraView = cameraView === 'exterior' ? 'interior' : 'exterior'">
                <UiIcon name="car" :size="16" />{{ cameraView === 'exterior' ? '车内视角' : '车外视角' }}
            </button>
            <button type="button" @click="emit('navigate', 'dashboard')"><UiIcon name="settings" :size="16" />设置</button>
        </header>
        <p v-if="inputMode === 'demo'" class="tesla-live-keyboard-help">键盘模拟 · ↑ / W 加速 · ↓ / S / 空格 刹车 · ← / A 左转 · → / D 右转</p>
        <p v-else class="tesla-live-keyboard-help">{{ turnLabel }}</p>
        <div v-if="phase !== 'running'" class="tesla-live-loading" role="status" aria-live="polite">
            <p>{{ phase === 'error' ? error : `车辆加载中 ${Math.round(progress * 100)}%` }}</p>
            <progress v-if="phase === 'loading'" :value="progress" max="1" aria-label="车辆加载进度" />
            <button v-else type="button" @click.stop="mountScene">重新加载</button>
        </div>
    </section>
</template>

<style scoped>
.tesla-live-drive { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; isolation: isolate; background: #14030b; touch-action: none; outline: none; }
.tesla-live-drive:focus-visible { outline: 1px solid #ff5278; outline-offset: -1px; }
.tesla-live-toolbar { position: absolute; z-index: 2; top: 16px; right: 16px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; max-width: calc(100% - 32px); }
.tesla-live-toolbar button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; padding: 0 12px; border: 1px solid #a52e4b; border-radius: 5px; background: #260510e6; color: #ffe6ed; font: inherit; font-size: 12px; cursor: pointer; }
.tesla-live-toolbar button.active { border-color: #ff809d; background: #541027e6; }
.tesla-live-toolbar button:focus-visible { outline: 2px solid #ff809d; outline-offset: 2px; }
.tesla-live-toolbar button:disabled { opacity: .6; cursor: default; }
.tesla-live-keyboard-help { position: absolute; z-index: 1; left: 16px; bottom: 12px; max-width: calc(100% - 32px); margin: 0; padding: 7px 10px; border-radius: 4px; background: #260510d9; color: #ffe6ed; font-size: 12px; line-height: 1.7; pointer-events: none; }
.tesla-live-loading { position: absolute; z-index: 1; left: 50%; bottom: 12%; width: min(420px, 85%); transform: translateX(-50%); color: #ffe6ed; text-align: center; }
.tesla-live-loading p { margin-bottom: 14px; }
.tesla-live-loading progress { width: 180px; height: 4px; accent-color: #ff5278; }
.tesla-live-loading button { padding: 10px 24px; border: 1px solid #ff5278; border-radius: 4px; background: #260510; color: inherit; cursor: pointer; }
</style>
