<template>
    <div ref="rootRef" class="floorplan-studio" :class="{ presentation }" tabindex="0" @keydown="handleKey" @pointerdown.capture="focusWorkspace">
        <header class="studio-header">
            <div class="brand">
                <span class="brand-mark">⌂</span>
                <div><span class="eyebrow">TvT.js / SPACES</span><strong>{{ presentation ? '空间方案展示' : '户型设计工坊' }}</strong></div>
            </div>
            <input v-if="!presentation" class="project-name" aria-label="方案名称" :value="plan.name" maxlength="100" @change="updatePlan('name', $event.target.value)" />
            <span v-else class="project-name viewer-title">{{ plan.name }}</span>
            <div class="header-actions">
                <button v-if="!presentation" :disabled="!canUndo" title="撤销 Ctrl+Z" @click="undo">↶</button>
                <button v-if="!presentation" :disabled="!canRedo" title="重做 Ctrl+Shift+Z" @click="redo">↷</button>
                <button @click="fileInput.click()">导入方案</button>
                <button :disabled="!!busy" @click="performExport('json')">导出 JSON</button>
                <button :disabled="!!busy" @click="performExport('png')">导出 PNG</button>
                <button v-if="!presentation" @click="openPresentation">独立展示 ↗</button>
                <button class="primary" :disabled="!!busy" @click="performExport('glb')">{{ busy === 'glb' ? '正在生成…' : '导出 GLB ↓' }}</button>
            </div>
            <input ref="fileInput" class="file-input" type="file" accept=".json,application/json" @change="importFile" />
        </header>

        <div class="studio-body">
            <aside v-if="!presentation" class="library-panel side-panel" :class="{ 'mobile-open': mobilePanel === 'library' }">
                <div class="panel-heading"><div><span class="eyebrow">COLLECTION</span><h2>为空间添一点灵感</h2></div><span class="small-count">{{ CATALOG.length }}</span></div>
                <input v-model="search" type="search" class="search-input" placeholder="搜索家具、家电…" aria-label="搜索家具" />
                <div class="category-list"><button v-for="category in categories" :key="category" :class="{ active: selectedCategory === category }" @click="selectedCategory = category">{{ category }}</button></div>
                <div class="furniture-library">
                    <button v-for="item in filteredCatalog" :key="item.type" class="furniture-card" draggable="true" @dragstart="startLibraryDrag($event, item.type)" @click="addFurniture(item.type)">
                        <span class="furniture-symbol" :style="{ color: item.color }">{{ item.symbol }}</span><strong>{{ item.name }}</strong><small>{{ item.width.toFixed(2) }} × {{ item.depth.toFixed(2) }} m</small><span class="add-icon">+</span>
                    </button>
                    <p v-if="!filteredCatalog.length" class="muted empty-library">没有匹配的家具</p>
                </div>
                <div class="library-note"><span>+</span><p>点击添加，或拖入平面图。<br />选中后可调整尺寸、颜色与朝向。</p></div>
            </aside>

            <main class="workspace" @dragover.prevent @drop.prevent="dropFurniture">
                <div class="workspace-toolbar">
                    <div class="segmented mode-switch"><button :class="{ active: mode === '2d' }" @click="changeMode('2d')">2D 平面</button><button :class="{ active: mode === '3d' }" @click="changeMode('3d')">3D 空间</button></div>
                    <div v-if="!presentation && mode === '2d'" class="tool-group"><button v-for="item in tools" :key="item.id" :class="{ active: tool === item.id }" :title="item.hint" @click="chooseTool(item.id)">{{ item.label }}</button></div>
                    <div v-if="mode === '3d'" class="tool-group"><button v-for="item in views" :key="item.id" :class="{ active: cameraView === item.id }" @click="setCamera(item.id)">{{ item.label }}</button><label class="check-label"><input v-model="cutaway" type="checkbox" />剖切墙</label></div>
                    <button class="fit-button" title="适应窗口 F" @click="fitView">适应窗口</button>
                    <button v-if="!presentation" class="mobile-toggle" @click="toggleMobile('library')">家具库</button>
                    <button v-if="!presentation" class="mobile-toggle" @click="toggleMobile('properties')">属性</button>
                </div>
                <div class="viewport">
                    <Plan2D
                        v-if="mode === '2d'" :key="`plan-${documentVersion}`" ref="planView" :plan="plan" :selected="selected"
                        :tool="presentation ? 'select' : tool" :editable="!presentation" :grid="grid" :labels="labels" :dimensions="dimensions" :snap="snap" :furniture-visible="furnitureVisible"
                        @select="selected = $event" @move="moveFurniture" @commit="commit" @create-wall="createWall"
                    />
                    <SceneView
                        v-else :key="`scene-${documentVersion}`" ref="sceneView" :plan="plan" :selected="presentation ? null : selected"
                        :editable="!presentation" :cutaway="cutaway" :furniture-visible="furnitureVisible" :snap="snap"
                        @select="selected = $event" @move="moveFurniture($event, true)"
                    />
                    <div v-if="mode === '2d' && tool !== 'select' && !presentation" class="drawing-hint">{{ tool === 'wall' ? '依次点击墙体起点与终点' : '依次点击两点，测量距离' }} · Shift 锁定水平/垂直 · Esc 取消</div>
                    <div v-if="presentation" class="presentation-card"><span class="eyebrow">A PLACE TO CALL HOME</span><h1>{{ plan.name }}</h1><p>{{ totalArea.toFixed(1) }} m² <span> / </span> {{ plan.rooms.length }} 个空间 <span> / </span> {{ plan.furniture.length }} 件家具</p></div>
                </div>
                <div class="workspace-bottom">
                    <div class="layer-options"><label v-if="mode === '2d'"><input v-model="grid" type="checkbox" />网格</label><label v-if="mode === '2d'"><input v-model="labels" type="checkbox" />房间名</label><label v-if="mode === '2d'"><input v-model="dimensions" type="checkbox" />尺寸</label><label><input v-model="furnitureVisible" type="checkbox" />家具</label><label v-if="!presentation"><input v-model="snap" type="checkbox" />吸附</label></div>
                    <span class="muted">{{ presentation ? '导入 JSON 可切换展示方案' : '单位 m · 右键平移 · Alt 暂停吸附' }}</span>
                </div>
                <nav v-if="presentation" class="room-navigation" aria-label="房间导航"><button @click="fitView">全屋</button><button v-for="room in plan.rooms" :key="room.id" @click="focusRoom(room)">{{ room.name }} <small>{{ roomArea(room).toFixed(1) }} m²</small></button></nav>
            </main>

            <aside v-if="!presentation" class="properties-panel side-panel" :class="{ 'mobile-open': mobilePanel === 'properties' }">
                <div class="panel-heading"><div><span class="eyebrow">INSPECTOR</span><h2>{{ selectedFurniture ? '家具属性' : selectedWall ? '墙体与门窗' : selectedRoom ? '空间与铺装' : '我的空间' }}</h2></div><button v-if="selected" class="icon-button" aria-label="取消选择" @click="selected = null">×</button></div>
                <template v-if="selectedFurniture">
                    <div class="selected-preview" :style="{ color: selectedFurniture.color }">{{ CATALOG.find((item) => item.type === selectedFurniture.type)?.symbol }}</div>
                    <label class="field">名称<input :value="selectedFurniture.name" maxlength="100" @change="updateFurniture('name', $event.target.value)" /></label>
                    <div class="field-grid"><label v-for="field in furnitureFields" :key="field.key" class="field">{{ field.label }}<span class="input-unit"><input type="number" :value="rounded(selectedFurniture[field.key])" :min="field.min" :max="field.max" :step="field.step || 0.05" @change="updateFurniture(field.key, $event.target.valueAsNumber)" /><span>{{ field.unit || 'm' }}</span></span></label></div>
                    <label class="field color-field">材质颜色<input type="color" :value="selectedFurniture.color" @change="updateFurniture('color', $event.target.value)" /><code>{{ selectedFurniture.color }}</code></label>
                    <div class="button-row"><button @click="rotateFurniture(90)">旋转 90°</button><button @click="duplicateFurniture">复制</button><button class="danger" @click="deleteSelection">删除</button></div>
                    <p class="muted tip">在二维或三维中直接拖动家具。旋转快捷键 R，删除 Delete。</p>
                </template>
                <template v-else-if="selectedWall">
                    <div class="wall-badge" :class="{ bearing: selectedWall.bearing }">{{ selectedWall.bearing ? '承重墙 · 已锁定' : '非承重隔墙 · 可编辑' }}</div>
                    <div class="field-grid"><label class="field">墙长<span class="read-value">{{ distance(selectedWall.start, selectedWall.end).toFixed(2) }} m</span></label><label class="field">墙厚 (m)<input type="number" :value="selectedWall.thickness" min="0.06" max="0.6" step="0.02" :disabled="selectedWall.bearing" @change="updateWall('thickness', $event.target.valueAsNumber)" /></label></div>
                    <div v-if="!selectedWall.bearing" class="field-grid"><label v-for="field in wallFields" :key="field.label" class="field">{{ field.label }} (m)<input type="number" :value="selectedWall[field.point][field.axis]" step="0.05" min="-100" max="100" @change="updateWallPoint(field, $event.target.valueAsNumber)" /></label></div>
                    <h3>门窗洞口 <span>{{ selectedWall.openings.length }}</span></h3>
                    <div v-for="opening in selectedWall.openings" :key="opening.id" class="opening-card">
                        <div class="opening-heading"><strong>{{ opening.type === 'door' ? '门洞' : '窗洞' }}</strong><button v-if="!selectedWall.bearing" class="icon-button" aria-label="删除洞口" @click="removeOpening(opening.id)">×</button></div>
                        <div class="field-grid"><label v-for="field in openingFields.filter((field) => opening.type === 'window' || field.key !== 'sill')" :key="field.key" class="field">{{ field.label }} (m)<input type="number" :value="rounded(opening[field.key])" min="0" step="0.05" :disabled="selectedWall.bearing" @change="updateOpening(opening.id, field.key, $event.target.valueAsNumber)" /></label></div>
                    </div>
                    <div v-if="!selectedWall.bearing" class="button-row"><button @click="addOpening('door')">+ 门洞</button><button @click="addOpening('window')">+ 窗洞</button><button class="danger" @click="deleteSelection">拆除墙体</button></div>
                    <p class="muted tip">洞口位置按距墙体起点的中心距离计算。墙体拆改后，面积仍按原房间区域统计。</p>
                </template>
                <template v-else-if="selectedRoom">
                    <div class="room-area"><strong>{{ roomArea(selectedRoom).toFixed(2) }}</strong><span>m² / {{ selectedRoom.name }}</span></div>
                    <label class="field">空间名称<input :value="selectedRoom.name" maxlength="100" @change="updateRoom('name', $event.target.value)" /></label>
                    <h3>选择地面材料</h3>
                    <div class="surface-list"><button v-for="(surface, key) in SURFACES" :key="key" :class="{ active: selectedRoom.surface === key }" @click="updateRoom('surface', key)"><span class="surface-swatch" :class="surface.pattern" :style="{ backgroundColor: surface.color }"></span><span><strong>{{ surface.name }}</strong><small>¥{{ surface.price }} / m²</small></span><span v-if="selectedRoom.surface === key" class="surface-check">✓</span></button></div>
                    <div class="cost-card"><span>预计铺装费用</span><strong>¥{{ money(roomArea(selectedRoom) * SURFACES[selectedRoom.surface].price * 1.05) }}</strong><small>含 5% 材料损耗，不含人工及辅料</small></div>
                </template>
                <template v-else>
                    <div class="room-area"><strong>{{ totalArea.toFixed(1) }}</strong><span>m² / 室内使用面积</span></div>
                    <label class="field">方案名称<input :value="plan.name" maxlength="100" @change="updatePlan('name', $event.target.value)" /></label>
                    <label class="field">墙体高度 (m)<input type="number" :value="plan.wallHeight" min="2" max="6" step="0.1" @change="updatePlan('wallHeight', $event.target.valueAsNumber)" /></label>
                    <p class="muted tip">点击房间更换地面，点击墙体设置门窗；从家具库开始布置你的空间。</p>
                </template>
                <section class="room-list-section"><h3>空间清单 <span>{{ plan.rooms.length }}</span></h3><button v-for="room in plan.rooms" :key="room.id" class="room-row" :class="{ active: selected?.kind === 'room' && selected.id === room.id }" @click="focusRoom(room)"><i :style="{ background: SURFACES[room.surface].color }"></i><span>{{ room.name }}</span><small>{{ roomArea(room).toFixed(1) }} m²</small><span>›</span></button></section>
                <div class="cost-card total-cost"><span>全屋地面材料估算</span><strong>¥{{ money(totalCost) }}</strong><small>含 5% 损耗 · 不含家具、人工及辅料</small></div>
                <button class="reset-button" @click="resetPlan">恢复示例方案</button>
            </aside>
            <button v-if="mobilePanel" class="mobile-backdrop" aria-label="关闭侧栏" @click="mobilePanel = null"></button>
        </div>
        <footer class="studio-footer"><span><i></i>{{ presentation ? '独立展示 · 方案快照' : storageStatus }}</span><span>{{ totalArea.toFixed(1) }} m² <b>·</b> {{ plan.furniture.length }} 件家具 <b>·</b> {{ plan.walls.length }} 面墙</span><span v-if="!presentation" class="keyboard-tip">V 选择　M 测量　W 画墙　T 切换视图　Ctrl+Z 撤销</span><span v-else class="keyboard-tip">GLB 使用完整墙高、全部家具与内嵌材质</span></footer>
        <div v-if="notice" class="toast" role="status">{{ notice }}</div>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from '@fesjs/fes'
import Plan2D from './Plan2D.vue'
import SceneView from './SceneView.vue'
import { CATALOG, clonePlan, createDefaultPlan, createFurniture, createId, distance, planBounds, PRESENTATION_PREFIX, roomArea, roomCenter, snapFurniture, STORAGE_KEY, SURFACES, validatePlan } from '../common/plan'
import { exportGLB, exportPlan, exportPlanPNG, readPlanFile } from '../common/export'

const props = defineProps({ presentation: Boolean })
const route = useRoute()
const router = useRouter()
const rootRef = ref(null)
const planView = ref(null)
const sceneView = ref(null)
const fileInput = ref(null)
const notice = ref('')
const storageStatus = ref('修改后自动保存到本机')
let noticeTimer
const tell = (message) => {
    notice.value = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { notice.value = '' }, 5000)
}

function initialPlan() {
    try {
        const snapshotId = typeof route.query.snapshot === 'string' ? route.query.snapshot : ''
        if (props.presentation && snapshotId) {
            const snapshot = localStorage.getItem(`${PRESENTATION_PREFIX}${snapshotId}`)
            if (!snapshot) throw new Error('此展示快照已不存在，请从设计页重新打开，或导入方案 JSON。')
            return validatePlan(JSON.parse(snapshot).plan)
        }
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            storageStatus.value = '已恢复本机方案'
            return validatePlan(JSON.parse(saved))
        }
    } catch (error) {
        tell(error.message || '本机方案读取失败，已载入默认户型。')
        storageStatus.value = '已载入示例 · 修改后保存'
    }
    return createDefaultPlan()
}

const plan = ref(validatePlan(initialPlan()))
const selected = ref(null)
const mode = ref(props.presentation ? '3d' : '2d')
const tool = ref('select')
const cameraView = ref('iso')
const grid = ref(true)
const labels = ref(true)
const dimensions = ref(true)
const furnitureVisible = ref(true)
const snap = ref(true)
const cutaway = ref(true)
const search = ref('')
const selectedCategory = ref('全部')
const mobilePanel = ref(null)
const busy = ref('')
const documentVersion = ref(0)
const history = ref([JSON.stringify(plan.value)])
const historyIndex = ref(0)
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)
const categories = ['全部', ...new Set(CATALOG.map((item) => item.category))]
const tools = [{ id: 'select', label: '↖ 选择', hint: '选择 / 移动 V' }, { id: 'measure', label: '↔ 测量', hint: '测量 M' }, { id: 'wall', label: '▰ 画墙', hint: '新增非承重墙 W' }]
const views = [{ id: 'iso', label: '鸟瞰' }, { id: 'front', label: '斜视' }, { id: 'top', label: '俯视' }]
const furnitureFields = [
    { key: 'width', label: '宽度', min: 0.1, max: 10 }, { key: 'depth', label: '深度', min: 0.1, max: 10 },
    { key: 'height', label: '高度', min: 0.01, max: 5 }, { key: 'rotation', label: '旋转', min: -360, max: 360, unit: '°', step: 15 },
    { key: 'x', label: '位置 X', min: -100, max: 100 }, { key: 'y', label: '位置 Y', min: -100, max: 100 },
]
const wallFields = [{ point: 'start', axis: 0, label: '起点 X' }, { point: 'start', axis: 1, label: '起点 Y' }, { point: 'end', axis: 0, label: '终点 X' }, { point: 'end', axis: 1, label: '终点 Y' }]
const openingFields = [{ key: 'offset', label: '中心位置' }, { key: 'width', label: '宽度' }, { key: 'height', label: '高度' }, { key: 'sill', label: '窗台高' }]
const filteredCatalog = computed(() => CATALOG.filter((item) => (selectedCategory.value === '全部' || item.category === selectedCategory.value) && `${item.name}${item.category}`.includes(search.value.trim())))
const selectedFurniture = computed(() => selected.value?.kind === 'furniture' ? plan.value.furniture.find((item) => item.id === selected.value.id) : null)
const selectedRoom = computed(() => selected.value?.kind === 'room' ? plan.value.rooms.find((room) => room.id === selected.value.id) : null)
const selectedWall = computed(() => selected.value?.kind === 'wall' ? plan.value.walls.find((wall) => wall.id === selected.value.id) : null)
const totalArea = computed(() => plan.value.rooms.reduce((sum, room) => sum + roomArea(room), 0))
const totalCost = computed(() => plan.value.rooms.reduce((sum, room) => sum + roomArea(room) * SURFACES[room.surface].price * 1.05, 0))
const money = (value) => Math.round(value).toLocaleString('zh-CN')
const rounded = (value) => Math.round(value * 1000) / 1000

function persist() {
    if (props.presentation) return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan.value))
        storageStatus.value = '已自动保存到本机'
    } catch {
        storageStatus.value = '本机存储不可用 · 请导出 JSON 保存'
    }
}

function remember() {
    const snapshot = JSON.stringify(plan.value)
    if (snapshot === history.value[historyIndex.value]) return
    history.value.splice(historyIndex.value + 1)
    history.value.push(snapshot)
    if (history.value.length > 60) history.value.shift()
    historyIndex.value = history.value.length - 1
    persist()
}

function mutate(change) {
    if (props.presentation) return false
    try {
        const draft = clonePlan(plan.value)
        change(draft)
        plan.value = validatePlan(draft)
        remember()
        return true
    } catch {
        tell('修改未保存：请检查尺寸、墙高与洞口范围，洞口之间不能重叠。')
        plan.value = clonePlan(plan.value)
        return false
    }
}

function commit() {
    if (props.presentation) return
    try {
        plan.value = validatePlan(plan.value)
        remember()
    } catch {
        plan.value = JSON.parse(history.value[historyIndex.value])
        tell('修改无效，已恢复上一个有效方案。')
    }
}

function cancelInteractions() {
    planView.value?.cancel()
    sceneView.value?.cancel()
}

function undo() {
    if (!canUndo.value || props.presentation) return
    cancelInteractions()
    plan.value = JSON.parse(history.value[--historyIndex.value])
    selected.value = null
    persist()
}

function redo() {
    if (!canRedo.value || props.presentation) return
    cancelInteractions()
    plan.value = JSON.parse(history.value[++historyIndex.value])
    selected.value = null
    persist()
}

function updatePlan(key, value) {
    mutate((draft) => { draft[key] = value })
}

function updateFurniture(key, value) {
    const id = selectedFurniture.value?.id
    if (id) mutate((draft) => {
        const item = draft.furniture.find((entry) => entry.id === id)
        item[key] = value
        if (['width', 'depth', 'rotation', 'x', 'y'].includes(key)) Object.assign(item, snapFurniture(item, item, draft, false))
    })
}

function updateRoom(key, value) {
    const id = selectedRoom.value?.id
    if (id) mutate((draft) => { draft.rooms.find((room) => room.id === id)[key] = value })
}

function updateWall(key, value) {
    const id = selectedWall.value?.id
    if (id && !selectedWall.value.bearing) mutate((draft) => { draft.walls.find((wall) => wall.id === id)[key] = value })
}

function updateWallPoint(field, value) {
    const id = selectedWall.value?.id
    if (id && !selectedWall.value.bearing) mutate((draft) => { draft.walls.find((wall) => wall.id === id)[field.point][field.axis] = value })
}

function moveFurniture(next, save = false) {
    if (props.presentation) return
    const item = plan.value.furniture.find((entry) => entry.id === next.id)
    if (!item) return
    item.x = next.x
    item.y = next.y
    if (save) commit()
}

function addFurniture(type, point = null) {
    if (props.presentation) return
    const bounds = planBounds(plan.value)
    const center = point || (selectedRoom.value ? roomCenter(selectedRoom.value) : [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2])
    const item = createFurniture(type, ...center)
    Object.assign(item, snapFurniture(item, item, plan.value, snap.value))
    if (!mutate((draft) => draft.furniture.push(item))) return
    selected.value = { kind: 'furniture', id: item.id }
    tool.value = 'select'
    mobilePanel.value = null
}

function startLibraryDrag(event, type) {
    event.dataTransfer.setData('application/x-tvt-furniture', type)
    event.dataTransfer.effectAllowed = 'copy'
}

function dropFurniture(event) {
    const type = event.dataTransfer.getData('application/x-tvt-furniture')
    if (!CATALOG.some((item) => item.type === type)) return
    const svg = planView.value?.getSVG()
    const point = svg ? new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse()) : null
    addFurniture(type, point ? [point.x, point.y] : null)
}

function rotateFurniture(angle) {
    if (selectedFurniture.value) updateFurniture('rotation', ((selectedFurniture.value.rotation + angle) % 360 + 360) % 360)
}

function duplicateFurniture() {
    if (!selectedFurniture.value || props.presentation) return
    const item = { ...clonePlan(selectedFurniture.value), id: createId('furniture') }
    Object.assign(item, snapFurniture(item, { x: item.x + 0.25, y: item.y + 0.25 }, plan.value, snap.value))
    if (!mutate((draft) => draft.furniture.push(item))) return
    selected.value = { kind: 'furniture', id: item.id }
}

function deleteSelection() {
    if (selectedFurniture.value) mutate((draft) => { draft.furniture = draft.furniture.filter((item) => item.id !== selected.value.id) })
    else if (selectedWall.value && !selectedWall.value.bearing) mutate((draft) => { draft.walls = draft.walls.filter((wall) => wall.id !== selected.value.id) })
    else return
    selected.value = null
}

function createWall(points) {
    const wall = { id: createId('wall'), ...points, thickness: 0.14, bearing: false, openings: [] }
    if (!mutate((draft) => draft.walls.push(wall))) return
    selected.value = { kind: 'wall', id: wall.id }
    tool.value = 'select'
}

function addOpening(type) {
    const wall = selectedWall.value
    if (!wall || wall.bearing) return
    const width = type === 'door' ? 0.9 : 1.2
    let cursor = 0.12
    for (const opening of [...wall.openings].sort((first, second) => first.offset - second.offset)) {
        if (opening.offset - opening.width / 2 - cursor >= width + 0.12) break
        cursor = opening.offset + opening.width / 2 + 0.12
    }
    if (cursor + width > distance(wall.start, wall.end) - 0.12) return tell('这面墙没有足够的空白位置，可以先调整或移除已有洞口。')
    const opening = { id: createId(type), type, offset: cursor + width / 2, width, height: type === 'door' ? 2.1 : 1.2, sill: type === 'door' ? 0 : 0.8 }
    mutate((draft) => draft.walls.find((entry) => entry.id === wall.id).openings.push(opening))
}

function updateOpening(id, key, value) {
    const wall = selectedWall.value
    if (wall && !wall.bearing) mutate((draft) => { draft.walls.find((entry) => entry.id === wall.id).openings.find((entry) => entry.id === id)[key] = value })
}

function removeOpening(id) {
    const wall = selectedWall.value
    if (wall && !wall.bearing) mutate((draft) => {
        const entry = draft.walls.find((item) => item.id === wall.id)
        entry.openings = entry.openings.filter((opening) => opening.id !== id)
    })
}

function chooseTool(next) {
    changeMode('2d')
    tool.value = next
}

function changeMode(next) {
    cancelInteractions()
    mode.value = next
    cameraView.value = 'iso'
    mobilePanel.value = null
}

function setCamera(view) {
    cameraView.value = view
    sceneView.value?.setView(view)
}

function fitView() {
    if (mode.value === '2d') planView.value?.fit()
    else sceneView.value?.setView(cameraView.value)
}

function focusRoom(room) {
    selected.value = { kind: 'room', id: room.id }
    if (mode.value === '3d') sceneView.value?.focusRoom(room)
    mobilePanel.value = null
}

function toggleMobile(panel) {
    mobilePanel.value = mobilePanel.value === panel ? null : panel
}

function resetPlan() {
    cancelInteractions()
    mutate((draft) => Object.assign(draft, createDefaultPlan()))
    selected.value = null
    documentVersion.value++
    tell('已恢复示例方案，可撤销此次操作。')
}

async function importFile(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    try {
        const imported = await readPlanFile(file)
        cancelInteractions()
        plan.value = imported
        selected.value = null
        documentVersion.value++
        if (!props.presentation) remember()
        tell(props.presentation ? '已载入展示方案，设计页不受影响。' : '方案已导入，可撤销此次操作。')
    } catch (error) {
        tell(error.message)
    }
}

async function performExport(kind) {
    if (busy.value) return
    cancelInteractions()
    busy.value = kind
    try {
        if (kind === 'glb') await exportGLB(clonePlan(plan.value))
        else if (kind === 'json') exportPlan(plan.value)
        else if (mode.value === '3d') await sceneView.value.screenshot()
        else await exportPlanPNG(planView.value.getSVG(), plan.value.name)
        tell(kind === 'glb' ? 'GLB 已导出：米制、完整墙高，包含地面、门窗、家具与材质。' : '已生成下载文件。')
    } catch (error) {
        tell(error.message || '导出失败，请重试。')
    } finally {
        busy.value = ''
    }
}

function openPresentation() {
    cancelInteractions()
    try {
        const id = createId('snapshot')
        const key = `${PRESENTATION_PREFIX}${id}`
        const saved = { createdAt: Date.now(), plan: validatePlan(plan.value) }
        localStorage.setItem(key, JSON.stringify(saved))
        const snapshots = Object.keys(localStorage).filter((entry) => entry.startsWith(PRESENTATION_PREFIX)).sort((first, second) => {
            const createdAt = (entry) => {
                try {
                    return JSON.parse(localStorage.getItem(entry)).createdAt || 0
                } catch {
                    return 0
                }
            }
            return createdAt(second) - createdAt(first)
        })
        snapshots.slice(8).forEach((entry) => localStorage.removeItem(entry))
        const href = router.resolve({ path: '/plugins/floorplan3D/viewer', query: { snapshot: id } }).href
        window.open(href, '_blank', 'noopener,noreferrer')
    } catch {
        tell('展示快照无法保存到本机。可以先导出 JSON，再从独立展示页导入。')
    }
}

function focusWorkspace(event) {
    if (!event.target.closest('input, select, button, a, textarea')) rootRef.value.focus({ preventScroll: true })
}

function handleKey(event) {
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return
    const key = event.key.toLowerCase()
    if ((event.ctrlKey || event.metaKey) && !props.presentation) {
        if (key === 'z') {
            event.preventDefault()
            if (event.shiftKey) redo()
            else undo()
        } else if (key === 'y') {
            event.preventDefault()
            redo()
        } else if (key === 'd') {
            event.preventDefault()
            duplicateFurniture()
        }
        return
    }
    if (key === 't') changeMode(mode.value === '2d' ? '3d' : '2d')
    else if (key === 'f') fitView()
    else if (key === 'escape') {
        cancelInteractions()
        selected.value = null
        tool.value = 'select'
        mobilePanel.value = null
    } else if (!props.presentation) {
        if (['v', 'm', 'w'].includes(key)) chooseTool({ v: 'select', m: 'measure', w: 'wall' }[key])
        else if (key === 'r') rotateFurniture(event.shiftKey ? -90 : 90)
        else if (['delete', 'backspace'].includes(key)) {
            event.preventDefault()
            deleteSelection()
        }
    }
}

onMounted(async () => {
    await nextTick()
    rootRef.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => clearTimeout(noticeTimer))
</script>

<style scoped>
.floorplan-studio { --ink: #344c3e; --muted: #8b958b; --accent: #4f7158; --line: #e9ebe3; position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; background: #fbfbf8; color: var(--ink); font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif; outline: none; }
.floorplan-studio :deep(*) { box-sizing: border-box; }
button, input { font: inherit; }
button { border: 1px solid var(--line); border-radius: 7px; padding: 7px 11px; background: #fff; color: #596754; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
button:hover { background: #f1f4ec; }
button:disabled { cursor: default; opacity: 0.4; }
button.active { background: #eaf0e5; border-color: #b8c7ac; color: #3e6746; }
button.primary { background: var(--ink); border-color: var(--ink); color: #fff; padding-inline: 16px; }
button.primary:hover { background: #47604c; }
input { min-width: 0; border: 1px solid #e0e5d9; border-radius: 6px; background: #fff; color: var(--ink); padding: 8px 9px; outline: none; }
input:focus { border-color: #9caf95; box-shadow: 0 0 0 2px #8ba27b14; }
input[type='checkbox'] { accent-color: var(--accent); margin: 0 5px 0 0; vertical-align: -2px; }
input:disabled { background: #f4f5f0; color: #8f998c; }
.studio-header { display: flex; align-items: center; gap: 22px; min-height: 78px; padding: 14px 25px; background: #fff; border-bottom: 1px solid var(--line); z-index: 4; }
.brand { display: flex; align-items: center; gap: 11px; flex-shrink: 0; }
.brand-mark { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 11px; background: #e9eee1; color: #55734a; font-size: 32px; line-height: 1; }
.brand strong { display: block; font-size: 17px; font-weight: 650; letter-spacing: 1px; }
.eyebrow { font-size: 9px; letter-spacing: 2px; color: #929d88; font-weight: 600; }
.project-name { max-width: 270px; width: 20vw; padding: 8px 0 8px 20px; border: 0; border-left: 1px solid var(--line); border-radius: 0; background: transparent; color: #8d9788; font-size: 12px; }
.header-actions { display: flex; align-items: center; gap: 7px; margin-left: auto; }
.header-actions button { font-size: 11px; }
.file-input { display: none; }
.studio-body { display: flex; flex: 1; min-height: 0; position: relative; }
.side-panel { background: #fff; padding: 23px 20px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #dce2d4 transparent; flex-shrink: 0; }
.library-panel { width: 246px; border-right: 1px solid var(--line); display: flex; flex-direction: column; }
.properties-panel { width: 278px; border-left: 1px solid var(--line); }
.panel-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
h2 { margin: 5px 0 0; font-size: 15px; font-weight: 600; }
h3 { display: flex; align-items: center; justify-content: space-between; margin: 23px 0 13px; font-size: 12px; font-weight: 600; }
h3 span { font-size: 10px; color: #99a28f; font-weight: 400; }
.small-count { padding: 3px 7px; background: #f1f3ec; border-radius: 5px; color: #9ca58e; font-size: 10px; }
.search-input { flex-shrink: 0; width: 100%; background: #f8f9f4; border-color: #edf0e6; font-size: 11px; padding: 10px; }
.category-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 17px 0; }
.category-list button { border: 0; background: transparent; padding: 4px 8px; font-size: 10px; color: #939c8c; }
.category-list button.active { background: #edf2e5; color: #5b794e; }
.furniture-library { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-content: start; }
.furniture-card { position: relative; min-height: 115px; text-align: left; padding: 12px 10px 10px; border: 1px solid #ecefe5; border-radius: 9px; background: #fafbf7; }
.furniture-card:hover { border-color: #becdae; background: #f4f7ed; }
.furniture-symbol { display: block; height: 48px; font-size: 38px; line-height: 42px; text-align: center; text-shadow: 0 2px #344c3e1a; }
.furniture-card strong { display: block; font-size: 11px; font-weight: 500; margin-top: 6px; }
.furniture-card small { display: block; font-size: 8px; color: #a0a88f; margin-top: 3px; }
.add-icon { position: absolute; right: 8px; bottom: 21px; color: #a8b79a; font-size: 15px; }
.library-note { display: flex; align-items: center; gap: 12px; margin-top: 24px; padding-top: 15px; border-top: 1px solid var(--line); color: #98a28b; }
.library-note > span { font-size: 25px; font-weight: 200; }
.library-note p { font-size: 10px; line-height: 1.8; margin: 0; }
.empty-library { grid-column: 1 / -1; padding: 25px 0; text-align: center; }
.workspace { position: relative; display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; background: #f4f3ee; }
.workspace-toolbar { display: flex; align-items: center; gap: 12px; min-height: 61px; padding: 11px 20px; background: #fdfdfa; border-bottom: 1px solid var(--line); flex-shrink: 0; z-index: 2; }
.segmented { display: flex; gap: 3px; background: #edeFE7; border: 1px solid #e6eadd; border-radius: 8px; padding: 3px; flex-shrink: 0; }
.segmented button { padding: 5px 11px; border: 0; background: transparent; color: #949e88; font-size: 11px; }
.segmented button.active { background: white; box-shadow: 0 1px 4px #59654e0d; color: #536c45; }
.tool-group { display: flex; gap: 3px; align-items: center; }
.tool-group button { font-size: 11px; padding: 6px 9px; background: transparent; border-color: transparent; }
.tool-group button.active { background: #e9eee2; }
.check-label { font-size: 11px; margin-left: 8px; white-space: nowrap; color: #818e76; }
.fit-button { margin-left: auto; font-size: 10px; padding: 6px 8px; color: #929c87; background: transparent; }
.viewport { flex: 1; min-height: 0; position: relative; overflow: hidden; }
.drawing-hint { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); max-width: 90%; padding: 9px 15px; background: #fffffff0; border: 1px solid #e0e5d7; border-radius: 8px; font-size: 11px; color: #7f8f6d; text-align: center; pointer-events: none; }
.workspace-bottom { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 10px 20px; background: #fdfdfa; border-top: 1px solid var(--line); font-size: 10px; flex-shrink: 0; }
.layer-options { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; color: #8e9983; }
.layer-options label { cursor: pointer; white-space: nowrap; }
.layer-options input { width: 11px; height: 11px; }
.muted { color: var(--muted); font-size: 10px; }
.tip { margin: 17px 0; line-height: 1.9; }
.icon-button { border: 0; background: transparent; padding: 0 4px; color: #9ba58e; font-size: 19px; line-height: 1; }
.selected-preview { display: grid; place-items: center; height: 95px; border-radius: 10px; background: #f4f6ee; font-size: 65px; margin-bottom: 20px; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 10px; color: #8c987f; margin-bottom: 14px; }
.field > input { width: 100%; font-size: 12px; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 12px; }
.input-unit { display: flex; position: relative; align-items: center; }
.input-unit input { width: 100%; padding-right: 28px; font-size: 12px; }
.input-unit > span { position: absolute; right: 23px; pointer-events: none; font-size: 10px; color: #a7af9a; }
.color-field { flex-direction: row; align-items: center; }
.color-field input { width: 30px; height: 25px; padding: 2px; margin-left: auto; }
.color-field code { color: #859478; font-size: 10px; }
.button-row { display: flex; gap: 7px; }
.button-row button { flex: 1; font-size: 10px; padding: 7px; }
.danger { color: #af8170; }
.wall-badge { background: #eef4e6; color: #78895e; border-radius: 6px; padding: 9px 11px; font-size: 10px; margin-bottom: 18px; }
.wall-badge.bearing { background: #f3eee4; color: #a4926d; }
.read-value { color: #556a49; font-size: 14px; padding: 6px 0; }
.opening-card { padding: 11px 10px 0; border: 1px solid var(--line); border-radius: 7px; margin-bottom: 9px; background: #fafbf7; }
.opening-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; color: #7a8d69; font-size: 11px; }
.opening-card .field { font-size: 9px; }
.opening-card input { padding: 5px 6px; font-size: 11px; }
.room-area { margin: 22px 0 26px; }
.room-area strong { display: block; font-size: 46px; font-weight: 300; letter-spacing: -2px; color: #617954; }
.room-area span { font-size: 10px; color: #9aa68e; }
.surface-list { display: grid; grid-template-columns: 1fr; gap: 8px; }
.surface-list button { display: flex; align-items: center; gap: 12px; text-align: left; padding: 9px; border-color: #edf0e6; }
.surface-list button.active { border-color: #a7b995; background: #f3f7ec; }
.surface-swatch { width: 37px; height: 35px; border-radius: 4px; flex-shrink: 0; }
.surface-swatch.wood { background-image: repeating-linear-gradient(90deg, transparent 0 11px, #5b432c30 11px 12px); }
.surface-swatch.tile { background-image: linear-gradient(90deg, transparent 47%, #79766826 48% 51%, transparent 52%), linear-gradient(0deg, transparent 47%, #79766826 48% 51%, transparent 52%); }
.surface-swatch.terrazzo { background-image: radial-gradient(#73846a66 1px, transparent 2px); background-size: 7px 9px; }
.surface-list strong { display: block; font-weight: 500; font-size: 11px; }
.surface-list small { display: block; margin-top: 3px; font-size: 9px; color: #9ba68f; }
.surface-check { margin-left: auto; font-size: 17px; color: #6a8d53; }
.cost-card { margin-top: 22px; padding: 15px; background: #f3f6ec; border: 1px solid #e7eddc; border-radius: 8px; }
.cost-card > span { display: block; font-size: 10px; color: #879a70; }
.cost-card strong { display: block; margin: 5px 0; font-size: 24px; font-weight: 500; color: #667d50; }
.cost-card small { display: block; color: #a1ac94; font-size: 9px; }
.room-list-section { border-top: 1px solid var(--line); margin-top: 24px; }
.room-row { display: flex; align-items: center; gap: 9px; width: 100%; border: 0; background: transparent; border-radius: 6px; padding: 9px 4px; font-size: 11px; color: #7c8b70; }
.room-row i { width: 9px; height: 9px; border-radius: 2px; }
.room-row small { margin-left: auto; font-size: 10px; color: #a0aa93; }
.room-row > span:last-child { margin-left: 3px; color: #b3bba8; }
.room-row.active { background: #f1f5e9; }
.total-cost strong { font-size: 22px; }
.reset-button { display: block; margin: 19px auto 0; border-color: transparent; color: #a9b19c; font-size: 10px; }
.studio-footer { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 9px 24px; min-height: 36px; border-top: 1px solid var(--line); background: #fff; color: #a2ab97; font-size: 9px; z-index: 4; }
.studio-footer i { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #91ab70; margin-right: 6px; vertical-align: 1px; }
.studio-footer b { font-weight: 400; padding: 0 8px; color: #c9cfbf; }
.toast { position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%); max-width: min(90%, 700px); padding: 13px 22px; background: #344c3ef5; color: #f6f8ee; border-radius: 10px; font-size: 12px; box-shadow: 0 6px 30px #344c3e20; z-index: 20; }
.mobile-toggle, .mobile-backdrop { display: none; }
.presentation .workspace-toolbar { padding-inline: 30px; }
.presentation-card { position: absolute; top: 28px; left: 35px; max-width: calc(100% - 70px); pointer-events: none; }
.presentation-card h1 { margin: 10px 0 8px; font-size: 26px; font-weight: 500; color: #556b51; }
.presentation-card p { color: #99a38c; font-size: 11px; }
.presentation-card p span { margin: 0 10px; color: #c1c8b7; }
.room-navigation { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; padding: 14px 20px; background: #fff; border-top: 1px solid var(--line); }
.room-navigation button { padding: 7px 13px; border-radius: 20px; font-size: 11px; }
.room-navigation small { margin-left: 8px; color: #a1ac93; font-size: 9px; }
@media (max-width: 1350px) {
    .project-name { display: none; }
    .studio-header { gap: 12px; padding-inline: 18px; }
    .library-panel { width: 214px; padding-inline: 15px; }
    .properties-panel { width: 245px; padding-inline: 16px; }
    .workspace-toolbar { gap: 7px; padding-inline: 12px; }
    .tool-group button { padding-inline: 7px; }
    .workspace-bottom > .muted { display: none; }
    .keyboard-tip { display: none; }
}
@media (max-width: 1080px) {
    .brand strong { font-size: 14px; }
    .studio-header { padding: 10px 12px; min-height: 67px; gap: 12px; }
    .header-actions { overflow-x: auto; scrollbar-width: none; }
    .header-actions button { flex-shrink: 0; }
    .side-panel { width: 210px; }
    .workspace-toolbar { flex-wrap: wrap; gap: 7px; }
    .fit-button { padding-inline: 5px; }
}
@media (max-width: 900px) {
    .side-panel { display: none; position: absolute; top: 0; bottom: 0; z-index: 7; width: 258px; box-shadow: 0 0 30px #344c3e15; }
    .side-panel.mobile-open { display: block; }
    .library-panel { left: 0; }
    .properties-panel { right: 0; }
    .mobile-backdrop { display: block; position: absolute; inset: 0; border: 0; border-radius: 0; z-index: 6; background: #344c3e28; }
    .mobile-toggle { display: block; font-size: 10px; padding: 6px 8px; }
    .studio-header { min-height: 61px; }
    .brand-mark { width: 33px; height: 33px; font-size: 27px; }
    .brand { gap: 8px; }
    .brand .eyebrow { font-size: 7px; letter-spacing: 1px; }
    .brand strong { font-size: 13px; letter-spacing: 0; }
    .header-actions { gap: 5px; }
    .header-actions button { padding: 7px 9px; font-size: 10px; }
    .studio-footer { padding: 9px 12px; font-size: 8px; gap: 8px; }
    .studio-footer b { padding: 0 3px; }
    .layer-options { gap: 11px; }
    .presentation-card { left: 20px; top: 15px; }
    .presentation-card h1 { font-size: 18px; }
    .presentation .workspace-toolbar { padding-inline: 12px; }
}
@media (max-width: 540px) {
    .brand strong { display: none; }
    .brand .eyebrow { display: none; }
    .studio-header { gap: 8px; }
    .header-actions { width: calc(100% - 41px); }
    .workspace-toolbar { padding: 8px; }
    .tool-group button { font-size: 10px; }
    .mode-switch button { padding-inline: 8px; }
    .check-label { margin-left: 3px; font-size: 10px; }
    .workspace-bottom { padding-inline: 12px; }
    .drawing-hint { width: 90%; font-size: 10px; }
    .presentation-card p { font-size: 9px; }
    .room-navigation { flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto; padding: 10px; }
    .room-navigation button { flex-shrink: 0; font-size: 10px; }
    .room-navigation small { display: none; }
}
</style>
