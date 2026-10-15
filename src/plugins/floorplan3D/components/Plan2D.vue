<template>
    <div class="plan-canvas">
        <svg
            ref="svgRef" :viewBox="viewBox" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Microsoft YaHei, sans-serif"
            :class="{ drawing: tool !== 'select' }" aria-label="二维户型编辑区域"
            @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="finishDrag" @pointercancel="cancel"
            @lostpointercapture="cancel" @wheel.prevent="zoom($event.deltaY < 0 ? 1.12 : 1 / 1.12)" @contextmenu.prevent
        >
            <defs>
                <pattern :id="gridId" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
                    <path d="M .5 0 H 0 V .5" fill="none" stroke="#d4d7d0" stroke-width="0.012" />
                </pattern>
            </defs>
            <rect :x="frame.left" :y="frame.top" :width="frame.width" :height="frame.height" fill="#f4f3ee" />
            <rect v-if="grid" :x="frame.left" :y="frame.top" :width="frame.width" :height="frame.height" :fill="`url(#${gridId})`" />
            <g v-for="room in plan.rooms" :key="room.id" data-kind="room" :data-id="room.id">
                <polygon :points="room.points.map((point) => point.join(',')).join(' ')" :fill="SURFACES[room.surface].color" fill-opacity="0.45" />
                <polygon v-if="selected?.kind === 'room' && selected.id === room.id" :points="room.points.map((point) => point.join(',')).join(' ')" fill="#527962" fill-opacity="0.08" stroke="#527962" stroke-width="0.035" stroke-dasharray="0.1 0.07" data-export-ignore="true" />
            </g>
            <g v-for="wall in plan.walls" :key="wall.id" data-kind="wall" :data-id="wall.id" :transform="`translate(${wall.start.join(' ')}) rotate(${wallAngle(wall) * 180 / Math.PI})`">
                <line x1="0" y1="0" :x2="distance(wall.start, wall.end)" y2="0" :stroke="wall.bearing ? '#424e47' : '#8b9188'" :stroke-width="wall.thickness" />
                <line v-if="selected?.kind === 'wall' && selected.id === wall.id" x1="0" y1="0" :x2="distance(wall.start, wall.end)" y2="0" stroke="#527962" :stroke-width="wall.thickness + 0.04" data-export-ignore="true" />
                <g v-for="opening in wall.openings" :key="opening.id">
                    <rect :x="opening.offset - opening.width / 2" :y="-wall.thickness / 2 - 0.005" :width="opening.width" :height="wall.thickness + 0.01" fill="#f4f3ee" />
                    <template v-if="opening.type === 'window'">
                        <line :x1="opening.offset - opening.width / 2" :x2="opening.offset + opening.width / 2" :y1="-wall.thickness * 0.32" :y2="-wall.thickness * 0.32" stroke="#729ca3" stroke-width="0.035" />
                        <line :x1="opening.offset - opening.width / 2" :x2="opening.offset + opening.width / 2" :y1="wall.thickness * 0.32" :y2="wall.thickness * 0.32" stroke="#729ca3" stroke-width="0.035" />
                    </template>
                    <g v-else :transform="`translate(${opening.offset - opening.width / 2} 0)`" fill="none" stroke="#b59a76" stroke-width="0.025">
                        <g v-for="leaf in (opening.width > 1.5 ? 2 : 1)" :key="leaf" :transform="leaf === 1 ? '' : `translate(${opening.width} 0) scale(-1 1)`">
                            <path :d="`M ${doorLeafWidth(opening)} 0 A ${doorLeafWidth(opening)} ${doorLeafWidth(opening)} 0 0 1 0 ${doorLeafWidth(opening)}`" stroke-dasharray="0.06 0.04" />
                            <path :d="`M 0 0 V ${doorLeafWidth(opening)}`" />
                        </g>
                    </g>
                </g>
            </g>
            <g v-if="furnitureVisible">
                <g v-for="item in plan.furniture" :key="item.id" data-kind="furniture" :data-id="item.id" :transform="`translate(${item.x} ${item.y}) rotate(${item.rotation})`" class="furniture">
                    <rect :x="-item.width / 2" :y="-item.depth / 2" :width="item.width" :height="item.depth" :rx="Math.min(item.width, item.depth) * 0.08" :fill="item.color" stroke="#6e766c" stroke-width="0.018" :fill-opacity="item.type === 'rug' ? 0.45 : 0.92" />
                    <g v-if="item.type === 'bed'" fill="#f5f3ed" stroke="#85949a" stroke-width="0.012">
                        <rect :x="-item.width * 0.42" :y="-item.depth * 0.42" :width="item.width * 0.36" :height="item.depth * 0.18" rx="0.045" />
                        <rect :x="item.width * 0.06" :y="-item.depth * 0.42" :width="item.width * 0.36" :height="item.depth * 0.18" rx="0.045" />
                        <line :x1="-item.width / 2" :x2="item.width / 2" :y1="-item.depth * 0.14" :y2="-item.depth * 0.14" />
                    </g>
                    <g v-else-if="['sofa', 'armchair', 'chair'].includes(item.type)" fill="none" stroke="#566755" stroke-width="0.025">
                        <path :d="`M ${-item.width * 0.4} ${item.depth * 0.4} V ${-item.depth * 0.28} H ${item.width * 0.4} V ${item.depth * 0.4}`" />
                    </g>
                    <circle v-else-if="['plant', 'washer', 'toilet', 'lamp'].includes(item.type)" :r="Math.min(item.width, item.depth) * 0.3" fill="#ffffff30" stroke="#727e6e" stroke-width="0.018" />
                    <text v-if="item.width > 0.7 && item.depth > 0.55 && item.type !== 'rug'" x="0" :y="item.type === 'bed' ? item.depth * 0.17 : 0.065" text-anchor="middle" fill="#3c4a40" :font-size="Math.min(item.width / Math.max(item.name.length, 3) * 0.65, 0.16)" pointer-events="none">{{ item.name }}</text>
                    <g v-if="selected?.kind === 'furniture' && selected.id === item.id" fill="none" stroke="#376a4c" stroke-width="0.035" data-export-ignore="true">
                        <rect :x="-item.width / 2 - 0.05" :y="-item.depth / 2 - 0.05" :width="item.width + 0.1" :height="item.depth + 0.1" rx="0.06" stroke-dasharray="0.09 0.055" />
                        <path :d="`M 0 ${-item.depth / 2 - 0.05} v -.25 m -.08 .08 l .08 -.08 .08 .08`" />
                    </g>
                </g>
            </g>
            <g v-if="labels" pointer-events="none" text-anchor="middle">
                <g v-for="room in plan.rooms" :key="room.id" :transform="`translate(${roomCenter(room).join(' ')})`">
                    <rect x="-0.62" y="-0.27" width="1.24" height="0.58" rx="0.1" fill="#f7f6f0" fill-opacity="0.9" />
                    <text y="-0.015" font-size="0.18" font-weight="600" fill="#3e4c42">{{ room.name }}</text>
                    <text y="0.22" font-size="0.14" fill="#7e877d">{{ roomArea(room).toFixed(1) }} m²</text>
                </g>
            </g>
            <g v-if="dimensions" fill="none" stroke="#9ca59a" stroke-width="0.014" pointer-events="none">
                <path :d="`M ${bounds.minX} ${bounds.minY - 0.22} v -.4 m 0 .16 H ${bounds.maxX} m 0 -.16 v .4`" />
                <path :d="`M ${bounds.maxX + 0.22} ${bounds.minY} h .4 m -.16 0 V ${bounds.maxY} m -.24 0 h .4`" />
                <text :x="(bounds.minX + bounds.maxX) / 2" :y="bounds.minY - 0.55" text-anchor="middle" fill="#7e887b" stroke="none" font-size="0.16">{{ (bounds.maxX - bounds.minX).toFixed(2) }} m</text>
                <text :transform="`translate(${bounds.maxX + 0.68} ${(bounds.minY + bounds.maxY) / 2}) rotate(90)`" text-anchor="middle" fill="#7e887b" stroke="none" font-size="0.16">{{ (bounds.maxY - bounds.minY).toFixed(2) }} m</text>
            </g>
            <g v-if="drawingStart && drawingEnd" data-export-ignore="true" pointer-events="none">
                <line :x1="drawingStart[0]" :y1="drawingStart[1]" :x2="drawingEnd[0]" :y2="drawingEnd[1]" :stroke="tool === 'wall' ? '#54725f' : '#be824e'" :stroke-width="tool === 'wall' ? 0.14 : 0.025" stroke-dasharray="0.08 0.04" />
                <circle v-for="(point, index) in [drawingStart, drawingEnd]" :key="index" :cx="point[0]" :cy="point[1]" r="0.05" fill="#be824e" />
                <text :x="(drawingStart[0] + drawingEnd[0]) / 2" :y="(drawingStart[1] + drawingEnd[1]) / 2 - 0.15" text-anchor="middle" font-size="0.2" fill="#936137">{{ distance(drawingStart, drawingEnd).toFixed(2) }} m</text>
            </g>
        </svg>
        <div class="zoom-controls">
            <button aria-label="缩小" @click="zoom(1 / 1.2)">−</button>
            <button @click="scale = 1">{{ Math.round(scale * 100) }}%</button>
            <button aria-label="放大" @click="zoom(1.2)">+</button>
        </div>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { clamp, distance, planBounds, roomArea, roomCenter, snapFurniture, SURFACES, wallAngle } from '../common/plan'

const props = defineProps({
    plan: { type: Object, required: true }, selected: { type: Object, default: null }, tool: { type: String, default: 'select' },
    grid: Boolean, labels: Boolean, dimensions: Boolean, snap: Boolean, furnitureVisible: Boolean, editable: Boolean,
})
const emit = defineEmits(['select', 'move', 'commit', 'create-wall'])
const svgRef = ref(null)
const gridId = `floorplan-grid-${useId()}`
const scale = ref(1)
const panOffset = ref({ x: 0, y: 0 })
const bounds = computed(() => planBounds(props.plan))
const frame = computed(() => {
    const width = (bounds.value.maxX - bounds.value.minX + 1.8) / scale.value
    const height = (bounds.value.maxY - bounds.value.minY + 1.8) / scale.value
    return { left: (bounds.value.minX + bounds.value.maxX - width) / 2 + panOffset.value.x, top: (bounds.value.minY + bounds.value.maxY - height) / 2 + panOffset.value.y, width, height }
})
const viewBox = computed(() => `${frame.value.left} ${frame.value.top} ${frame.value.width} ${frame.value.height}`)
const drawingStart = ref(null)
const drawingEnd = ref(null)
let drawingComplete = false
let drag = null
let pan = null
const doorLeafWidth = (opening) => opening.width / (opening.width > 1.5 ? 2 : 1)

function getPoint(event) {
    const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(svgRef.value.getScreenCTM().inverse())
    return [position.x, position.y]
}

function drawingPoint(event) {
    const point = getPoint(event).map((coordinate) => props.snap ? Math.round(coordinate * 20) / 20 : coordinate)
    if (event.shiftKey && drawingStart.value && !drawingComplete) {
        if (Math.abs(point[0] - drawingStart.value[0]) > Math.abs(point[1] - drawingStart.value[1])) point[1] = drawingStart.value[1]
        else point[0] = drawingStart.value[0]
    }
    return point.map((coordinate) => clamp(coordinate, -100, 100))
}

function pointerDown(event) {
    if (drag || pan) return
    if ([1, 2].includes(event.button)) {
        event.preventDefault()
        pan = { ...panOffset.value, matrix: svgRef.value.getScreenCTM().inverse(), point: getPoint(event), pointerId: event.pointerId }
        svgRef.value.setPointerCapture(event.pointerId)
        return
    }
    if (!props.editable || event.button !== 0) return
    if (props.tool !== 'select') {
        const point = drawingPoint(event)
        if (!drawingStart.value || drawingComplete) {
            drawingStart.value = point
            drawingEnd.value = point
            drawingComplete = false
        } else {
            drawingEnd.value = point
            if (props.tool === 'wall' && distance(drawingStart.value, point) >= 0.3) {
                emit('create-wall', { start: [...drawingStart.value], end: [...point] })
                drawingStart.value = null
                drawingEnd.value = null
            } else drawingComplete = true
        }
        return
    }
    const target = event.target.closest('[data-kind]')
    if (!target) {
        emit('select', null)
        return
    }
    const selection = { kind: target.dataset.kind, id: target.dataset.id }
    emit('select', selection)
    if (selection.kind !== 'furniture') return
    const item = props.plan.furniture.find((entry) => entry.id === selection.id)
    drag = { id: item.id, point: getPoint(event), x: item.x, y: item.y, pointerId: event.pointerId }
    svgRef.value.setPointerCapture(event.pointerId)
}

function pointerMove(event) {
    if (pan && event.pointerId === pan.pointerId) {
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(pan.matrix)
        panOffset.value = { x: pan.x - point.x + pan.point[0], y: pan.y - point.y + pan.point[1] }
    } else if (drag && event.pointerId === drag.pointerId) {
        const item = props.plan.furniture.find((entry) => entry.id === drag.id)
        if (!item) return cancel()
        const point = getPoint(event)
        const next = snapFurniture(item, { x: drag.x + point[0] - drag.point[0], y: drag.y + point[1] - drag.point[1] }, props.plan, props.snap && !event.altKey)
        emit('move', { id: item.id, ...next })
    } else if (drawingStart.value && !drawingComplete) drawingEnd.value = drawingPoint(event)
}

function releaseDrag() {
    const pointerId = drag.pointerId
    drag = null
    if (svgRef.value?.hasPointerCapture(pointerId)) svgRef.value.releasePointerCapture(pointerId)
}

function finishDrag(event) {
    if (pan?.pointerId === event.pointerId) {
        pan = null
        if (svgRef.value.hasPointerCapture(event.pointerId)) svgRef.value.releasePointerCapture(event.pointerId)
        return
    }
    if (!drag || drag.pointerId !== event.pointerId) return
    releaseDrag()
    emit('commit')
}

function cancel() {
    if (pan) {
        const pointerId = pan.pointerId
        panOffset.value = { x: pan.x, y: pan.y }
        pan = null
        if (svgRef.value?.hasPointerCapture(pointerId)) svgRef.value.releasePointerCapture(pointerId)
    }
    if (drag) {
        emit('move', { id: drag.id, x: drag.x, y: drag.y })
        releaseDrag()
    }
    drawingStart.value = null
    drawingEnd.value = null
    drawingComplete = false
}

function zoom(factor) {
    scale.value = clamp(scale.value * factor, 0.65, 3)
}

watch(() => props.tool, cancel)
onBeforeUnmount(cancel)
defineExpose({
    getSVG: () => svgRef.value,
    fit: () => {
        scale.value = 1
        panOffset.value = { x: 0, y: 0 }
    },
    cancel,
})
</script>

<style scoped>
.plan-canvas { position: relative; width: 100%; height: 100%; min-height: 0; background: #f4f3ee; }
svg { display: block; width: 100%; height: 100%; touch-action: none; user-select: none; }
svg.drawing { cursor: crosshair; }
.furniture { cursor: grab; }
.furniture:active { cursor: grabbing; }
.zoom-controls { position: absolute; bottom: 22px; right: 24px; display: flex; padding: 4px; gap: 2px; border: 1px solid #e0e3d9; border-radius: 10px; background: #fffffff0; box-shadow: 0 3px 14px #374a3e0a; }
button { border: 0; border-radius: 6px; background: transparent; color: #526153; padding: 7px 11px; cursor: pointer; font: inherit; font-size: 12px; }
button:hover { background: #eef1e9; }
</style>
