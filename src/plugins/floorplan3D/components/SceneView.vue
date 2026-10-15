<template>
    <div ref="containerRef" class="scene-view" aria-label="三维户型预览" @pointerdown.capture="pointerDown" @pointermove="pointerMove" @pointerup="finishDrag" @pointercancel="cancelDrag" @lostpointercapture="cancelDrag">
        <div v-if="failure" class="scene-error"><strong>三维视图暂不可用</strong><span>{{ failure }}</span><span>仍可切换二维编辑、导入或导出方案。</span></div>
        <div v-else class="scene-caption">{{ editable ? '拖动家具调整位置 · 拖动空白旋转 · 滚轮缩放' : '拖动旋转 · 右键平移 · 滚轮缩放' }}</div>
    </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ACESFilmicToneMapping, Box3, BoxHelper, Color, DirectionalLight, HemisphereLight, PCFSoftShadowMap, PerspectiveCamera, Plane, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createModel, disposeModel } from '../common/model'
import { download } from '../common/export'
import { planBounds, snapFurniture } from '../common/plan'

const props = defineProps({
    plan: { type: Object, required: true }, selected: { type: Object, default: null },
    editable: Boolean, cutaway: Boolean, furnitureVisible: Boolean, snap: Boolean,
})
const emit = defineEmits(['select', 'move'])
const containerRef = ref(null)
const failure = ref('')
const scene = new Scene()
scene.background = new Color('#eeefe9')
const camera = new PerspectiveCamera(42, 1, 0.05, 2000)
const raycaster = new Raycaster()
const pointer = new Vector2()
const plane = new Plane(new Vector3(0, 1, 0), 0)
const intersection = new Vector3()
const selectionBox = new BoxHelper(undefined, '#477258')
selectionBox.visible = false
scene.add(selectionBox)
let renderer
let controls
let model
let resizeObserver
let animationFrame
let keyLight
let fillLight
let drag = null
let currentView = 'iso'

function selectObject() {
    selectionBox.visible = false
    if (!props.selected || !model) return
    const object = model.children.find((entry) => entry.userData.kind === props.selected.kind && entry.userData.id === props.selected.id)
    if (object) {
        selectionBox.setFromObject(object)
        selectionBox.visible = true
    }
}

function rebuild() {
    if (!renderer) return
    cancelDrag()
    if (model) {
        scene.remove(model)
        disposeModel(model)
    }
    model = createModel(props.plan, { cutaway: props.cutaway, furnitureVisible: props.furnitureVisible })
    scene.add(model)
    selectObject()
    const bounds = planBounds(props.plan)
    const center = new Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minY + bounds.maxY) / 2)
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
    keyLight.position.copy(center).add(new Vector3(-span * 0.4, span * 1.5, span * 0.65))
    keyLight.target.position.copy(center)
    Object.assign(keyLight.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.1, far: span * 5 })
    keyLight.shadow.camera.updateProjectionMatrix()
    fillLight.position.copy(center).add(new Vector3(span, span, -span))
}

function setView(view = currentView, room = null) {
    if (!controls || !model) return
    currentView = view
    let bounds = new Box3().setFromObject(model)
    if (room) {
        const frame = planBounds({ rooms: [room], walls: [], furniture: [] })
        bounds = new Box3(new Vector3(frame.minX, 0, frame.minY), new Vector3(frame.maxX, props.plan.wallHeight * 0.6, frame.maxY))
    }
    const center = bounds.getCenter(new Vector3())
    const radius = bounds.getSize(new Vector3()).length() / 2
    const verticalFov = camera.fov * Math.PI / 180
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
    const distance = Math.max(2, radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.08)
    const directions = { iso: [1, 1.35, 1.3], top: [0, 1, 0.001], front: [0, 0.55, 1] }
    const direction = new Vector3(...(directions[view] || directions.iso)).normalize()
    controls.target.copy(center)
    camera.position.copy(center).addScaledVector(direction, distance)
    controls.maxDistance = Math.max(distance * 4, 80)
    controls.update()
}

function updateRay(event) {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
}

function pointerDown(event) {
    if (drag || !props.editable || !renderer || !model || event.button !== 0 || event.target !== renderer.domElement) return
    updateRay(event)
    const hit = raycaster.intersectObject(model, true)[0]
    let object = hit?.object
    while (object && !object.userData.kind) object = object.parent
    emit('select', object ? { kind: object.userData.kind, id: object.userData.id } : null)
    if (object?.userData.kind !== 'furniture' || !raycaster.ray.intersectPlane(plane, intersection)) return
    drag = { object, id: object.userData.id, start: object.position.clone(), pointerId: event.pointerId, offset: object.position.clone().sub(intersection) }
    controls.enabled = false
    containerRef.value.setPointerCapture(event.pointerId)
    event.stopImmediatePropagation()
}

function pointerMove(event) {
    if (!drag || drag.pointerId !== event.pointerId) return
    const item = props.plan.furniture.find((entry) => entry.id === drag.id)
    if (!item) return cancelDrag()
    updateRay(event)
    if (!raycaster.ray.intersectPlane(plane, intersection)) return
    const position = intersection.clone().add(drag.offset)
    const next = snapFurniture(item, { x: position.x, y: position.z }, props.plan, props.snap && !event.altKey)
    drag.object.position.x = next.x
    drag.object.position.z = next.y
    selectionBox.setFromObject(drag.object)
}

function releaseDrag() {
    const pointerId = drag.pointerId
    drag = null
    controls.enabled = true
    if (containerRef.value?.hasPointerCapture(pointerId)) containerRef.value.releasePointerCapture(pointerId)
}

function finishDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return
    const next = { id: drag.id, x: drag.object.position.x, y: drag.object.position.z }
    releaseDrag()
    emit('move', next)
}

function cancelDrag() {
    if (!drag) return
    drag.object.position.copy(drag.start)
    selectionBox.setFromObject(drag.object)
    releaseDrag()
}

async function screenshot() {
    if (!renderer || failure.value) throw new Error('三维视图尚未准备就绪。')
    selectionBox.visible = false
    renderer.render(scene, camera)
    try {
        const blob = await new Promise((resolve) => renderer.domElement.toBlob(resolve, 'image/png'))
        if (!blob) throw new Error('截图失败，请重试。')
        download(blob, `${props.plan.name}-三维视图.png`)
    } finally {
        selectObject()
    }
}

onMounted(() => {
    try {
        renderer = new WebGLRenderer({ antialias: true, alpha: false })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = PCFSoftShadowMap
        renderer.toneMapping = ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.22
        containerRef.value.appendChild(renderer.domElement)
        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.minDistance = 1.5
        controls.maxPolarAngle = Math.PI / 2 - 0.015
        scene.add(new HemisphereLight('#ffffff', '#a5aa93', 2.6))
        keyLight = new DirectionalLight('#fff4dd', 3.2)
        keyLight.castShadow = true
        keyLight.shadow.mapSize.set(2048, 2048)
        keyLight.shadow.normalBias = 0.025
        keyLight.shadow.bias = -0.0003
        fillLight = new DirectionalLight('#d9e6ff', 1.1)
        scene.add(keyLight, keyLight.target, fillLight)
        const resize = () => {
            const width = Math.max(containerRef.value.clientWidth, 1)
            const height = Math.max(containerRef.value.clientHeight, 1)
            renderer.setSize(width, height)
            camera.aspect = width / height
            camera.updateProjectionMatrix()
        }
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(containerRef.value)
        resize()
        rebuild()
        setView()
        const render = () => {
            controls.update()
            renderer.render(scene, camera)
            animationFrame = requestAnimationFrame(render)
        }
        render()
    } catch (error) {
        failure.value = error.message || '浏览器无法创建 WebGL 渲染器。'
    }
})

watch([() => props.plan, () => props.cutaway, () => props.furnitureVisible], rebuild, { deep: true })
watch(() => props.selected, selectObject, { deep: true })

onBeforeUnmount(() => {
    cancelDrag()
    cancelAnimationFrame(animationFrame)
    resizeObserver?.disconnect()
    controls?.dispose()
    if (model) disposeModel(model)
    scene.traverse((object) => object.shadow?.dispose())
    selectionBox.dispose()
    renderer?.dispose()
    renderer?.forceContextLoss()
    renderer?.domElement.remove()
})

defineExpose({ setView, focusRoom: (room) => setView(currentView, room), screenshot, cancel: cancelDrag })
</script>

<style scoped>
.scene-view { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; background: #eeefe9; touch-action: none; }
.scene-view :deep(canvas) { display: block; width: 100%; height: 100%; outline: none; }
.scene-caption { position: absolute; left: 50%; bottom: 27px; transform: translateX(-50%); z-index: 1; color: #718073; background: #ffffffb8; border: 1px solid #e0e3d8; border-radius: 20px; padding: 7px 15px; font-size: 11px; white-space: nowrap; pointer-events: none; }
.scene-error { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; padding: 30px; color: #737f73; font-size: 13px; text-align: center; z-index: 2; background: #eeefe9; }
</style>
