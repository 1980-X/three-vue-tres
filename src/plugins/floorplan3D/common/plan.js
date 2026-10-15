export const PLAN_FORMAT = 'tvt-floorplan'
export const STORAGE_KEY = 'tvt.floorplan3D.plan.v1'
export const PRESENTATION_PREFIX = 'tvt.floorplan3D.presentation.'

export const SURFACES = {
    oak: { name: '浅橡木', color: '#cdb18a', price: 268, pattern: 'wood' },
    walnut: { name: '胡桃木', color: '#937052', price: 328, pattern: 'wood' },
    tile: { name: '暖灰地砖', color: '#dddcd5', price: 158, pattern: 'tile' },
    stone: { name: '浅色石材', color: '#e6e2d8', price: 428, pattern: 'tile' },
    terrazzo: { name: '水磨石', color: '#c5c9c2', price: 218, pattern: 'terrazzo' },
    carpet: { name: '柔软地毯', color: '#b7b5c2', price: 128, pattern: 'carpet' },
}

export const CATALOG = [
    { type: 'sofa', name: '三人沙发', category: '客厅', width: 2.5, depth: 0.95, height: 0.86, color: '#a2b3a2', symbol: '▤' },
    { type: 'armchair', name: '休闲单椅', category: '客厅', width: 0.85, depth: 0.85, height: 0.82, color: '#c89f76', symbol: '▣' },
    { type: 'coffee', name: '茶几', category: '客厅', width: 1.2, depth: 0.65, height: 0.38, color: '#be9a73', symbol: '▱' },
    { type: 'tvstand', name: '电视柜', category: '客厅', width: 2.1, depth: 0.4, height: 0.5, color: '#b49373', symbol: '▬' },
    { type: 'rug', name: '地毯', category: '客厅', width: 2.6, depth: 1.8, height: 0.015, color: '#ded4c3', symbol: '▧' },
    { type: 'bed', name: '双人床', category: '卧室', width: 1.8, depth: 2.1, height: 1.05, color: '#b2becb', symbol: '▥' },
    { type: 'nightstand', name: '床头柜', category: '卧室', width: 0.48, depth: 0.42, height: 0.52, color: '#c4a583', symbol: '▦' },
    { type: 'wardrobe', name: '衣柜', category: '卧室', width: 1.8, depth: 0.6, height: 2.25, color: '#ded6c7', symbol: '▥' },
    { type: 'desk', name: '书桌', category: '书房', width: 1.4, depth: 0.65, height: 0.75, color: '#bca07d', symbol: '▱' },
    { type: 'bookshelf', name: '书架', category: '书房', width: 1.2, depth: 0.32, height: 1.9, color: '#b69773', symbol: '▤' },
    { type: 'table', name: '餐桌', category: '餐厨', width: 1.5, depth: 0.85, height: 0.76, color: '#c2a47d', symbol: '▱' },
    { type: 'chair', name: '餐椅', category: '餐厨', width: 0.46, depth: 0.5, height: 0.85, color: '#b89d79', symbol: '▣' },
    { type: 'counter', name: '橱柜', category: '餐厨', width: 1.6, depth: 0.62, height: 0.88, color: '#c5c7bc', symbol: '▦' },
    { type: 'fridge', name: '冰箱', category: '餐厨', width: 0.75, depth: 0.7, height: 1.85, color: '#c3c9c9', symbol: '▯' },
    { type: 'stove', name: '灶台', category: '餐厨', width: 0.8, depth: 0.62, height: 0.88, color: '#c8cec3', symbol: '⊙' },
    { type: 'sink', name: '水槽柜', category: '餐厨', width: 0.9, depth: 0.62, height: 0.88, color: '#c8cec3', symbol: '▣' },
    { type: 'toilet', name: '马桶', category: '卫浴', width: 0.42, depth: 0.72, height: 0.75, color: '#eeeae0', symbol: '◉' },
    { type: 'vanity', name: '浴室柜', category: '卫浴', width: 1.0, depth: 0.52, height: 0.85, color: '#bda88c', symbol: '▣' },
    { type: 'shower', name: '淋浴房', category: '卫浴', width: 1.1, depth: 0.95, height: 2.05, color: '#b5d2d4', symbol: '▧' },
    { type: 'washer', name: '洗衣机', category: '卫浴', width: 0.6, depth: 0.62, height: 0.85, color: '#e0e1d9', symbol: '◉' },
    { type: 'plant', name: '绿植', category: '装饰', width: 0.55, depth: 0.55, height: 1.25, color: '#6d8c65', symbol: '✳' },
    { type: 'lamp', name: '落地灯', category: '装饰', width: 0.45, depth: 0.45, height: 1.65, color: '#dbca9b', symbol: '◍' },
]

export const clonePlan = (plan) => JSON.parse(JSON.stringify(plan))
export const createId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`
export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))
export const distance = (start, end) => Math.hypot(end[0] - start[0], end[1] - start[1])
export const wallAngle = (wall) => Math.atan2(wall.end[1] - wall.start[1], wall.end[0] - wall.start[0])
export const roomCenter = (room) => {
    const bounds = planBounds({ rooms: [room], walls: [], furniture: [] })
    return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]
}
export const roomArea = (room) => Math.abs(room.points.reduce((sum, point, index, points) => {
    const next = points[(index + 1) % points.length]
    return sum + point[0] * next[1] - next[0] * point[1]
}, 0)) / 2

export function planBounds(plan) {
    const points = [...plan.rooms.flatMap((room) => room.points), ...plan.walls.flatMap((wall) => [wall.start, wall.end])]
    if (!points.length) points.push([0, 0], [10, 9])
    return {
        minX: Math.min(...points.map((point) => point[0])),
        maxX: Math.max(...points.map((point) => point[0])),
        minY: Math.min(...points.map((point) => point[1])),
        maxY: Math.max(...points.map((point) => point[1])),
    }
}

export function createFurniture(type, positionX = 5, positionY = 5) {
    const item = CATALOG.find((entry) => entry.type === type)
    return { id: createId('furniture'), type, name: item.name, x: positionX, y: positionY, width: item.width, depth: item.depth, height: item.height, rotation: 0, color: item.color }
}

export function snapFurniture(item, position, plan, enabled) {
    const bounds = planBounds(plan)
    const angle = item.rotation * Math.PI / 180
    const halfWidth = (Math.abs(Math.cos(angle)) * item.width + Math.abs(Math.sin(angle)) * item.depth) / 2
    const halfDepth = (Math.abs(Math.sin(angle)) * item.width + Math.abs(Math.cos(angle)) * item.depth) / 2
    const snap = (value) => enabled ? Math.round(value / 0.05) * 0.05 : value
    const next = { x: snap(position.x), y: snap(position.y) }
    if (enabled) {
        for (const wall of plan.walls) {
            if (Math.abs(wall.start[0] - wall.end[0]) < 0.001) {
                if (next.y < Math.min(wall.start[1], wall.end[1]) || next.y > Math.max(wall.start[1], wall.end[1])) continue
                const edge = wall.start[0] + Math.sign(next.x - wall.start[0]) * (wall.thickness / 2 + halfWidth)
                if (Math.abs(next.x - edge) < 0.12) next.x = edge
            } else if (Math.abs(wall.start[1] - wall.end[1]) < 0.001) {
                if (next.x < Math.min(wall.start[0], wall.end[0]) || next.x > Math.max(wall.start[0], wall.end[0])) continue
                const edge = wall.start[1] + Math.sign(next.y - wall.start[1]) * (wall.thickness / 2 + halfDepth)
                if (Math.abs(next.y - edge) < 0.12) next.y = edge
            }
        }
    }
    next.x = bounds.maxX - bounds.minX < halfWidth * 2 ? (bounds.minX + bounds.maxX) / 2 : clamp(next.x, bounds.minX + halfWidth, bounds.maxX - halfWidth)
    next.y = bounds.maxY - bounds.minY < halfDepth * 2 ? (bounds.minY + bounds.maxY) / 2 : clamp(next.y, bounds.minY + halfDepth, bounds.maxY - halfDepth)
    return next
}

export function createDefaultPlan() {
    const room = (id, name, surface, left, top, right, bottom) => ({ id, name, surface, points: [[left, top], [right, top], [right, bottom], [left, bottom]] })
    const opening = (id, type, offset, width, height = 2.1, sill = 0) => ({ id, type, offset, width, height, sill })
    const wall = (id, start, end, bearing, openings = []) => ({ id, start, end, bearing, thickness: bearing ? 0.24 : 0.14, openings })
    const furniture = (type, positionX, positionY, rotation = 0, overrides = {}) => ({ ...createFurniture(type, positionX, positionY), rotation, ...overrides })
    return {
        format: PLAN_FORMAT,
        version: 1,
        units: 'm',
        name: '林间小筑 · 两室一厅',
        wallHeight: 2.8,
        rooms: [
            room('bedroom', '主卧', 'oak', 0.12, 0.12, 4.1, 3.8),
            room('study', '书房', 'oak', 4.24, 0.12, 6.5, 3.8),
            room('bathroom', '卫浴', 'terrazzo', 6.64, 0.12, 9.88, 2.5),
            room('kitchen', '厨房', 'tile', 6.64, 2.64, 9.88, 5.25),
            room('living', '客厅', 'oak', 0.12, 3.94, 6.5, 7.35),
            room('dining', '餐厅', 'stone', 6.64, 5.39, 9.88, 7.35),
            room('balcony', '阳台', 'walnut', 0.12, 7.49, 9.88, 8.88),
        ],
        walls: [
            wall('north', [0, 0], [10, 0], true, [opening('north-1', 'window', 2.0, 2.1, 1.4, 0.9), opening('north-2', 'window', 5.4, 1.3, 1.4, 0.9), opening('north-3', 'window', 8.2, 1.2, 1.0, 1.2)]),
            wall('east', [10, 0], [10, 9], true, [opening('east-1', 'window', 3.9, 1.5, 1.4, 0.9), opening('east-2', 'window', 6.3, 1.2, 1.4, 0.9)]),
            wall('south', [0, 9], [10, 9], true, [opening('south-1', 'window', 5, 8, 1.6, 0.7)]),
            wall('west', [0, 0], [0, 9], true, [opening('west-1', 'window', 5.1, 1.9, 1.4, 0.9), opening('entry', 'door', 6.85, 0.95)]),
            wall('bedroom-study', [4.17, 0], [4.17, 3.87], false),
            wall('bedroom-living', [0, 3.87], [6.57, 3.87], false, [opening('bedroom-door', 'door', 3.3, 0.88), opening('study-door', 'door', 5.8, 0.88)]),
            wall('service', [6.57, 0], [6.57, 7.42], false, [opening('bathroom-door', 'door', 1.8, 0.8), opening('kitchen-door', 'door', 4.4, 1), opening('dining-door', 'door', 6.35, 1.6)]),
            wall('bathroom-kitchen', [6.57, 2.57], [10, 2.57], false),
            wall('kitchen-dining', [6.57, 5.32], [10, 5.32], false, [opening('kitchen-passage', 'door', 1.7, 1.3)]),
            wall('balcony-divider', [0, 7.42], [10, 7.42], false, [opening('balcony-door', 'door', 4.2, 3.1), opening('balcony-window', 'window', 8.2, 2.3, 1.6, 0.7)]),
        ],
        furniture: [
            furniture('bed', 2, 1.5), furniture('nightstand', 0.77, 0.75), furniture('nightstand', 3.23, 0.75),
            furniture('wardrobe', 0.5, 2.55, 90, { width: 1.8 }), furniture('desk', 5.35, 0.65),
            furniture('chair', 5.35, 1.4, 180), furniture('bookshelf', 4.48, 2.7, 90, { width: 1.5 }),
            furniture('rug', 2.8, 5.75), furniture('sofa', 2.8, 4.65), furniture('coffee', 2.8, 5.85),
            furniture('tvstand', 2.05, 6.98), furniture('armchair', 4.9, 6.35, -30), furniture('lamp', 4.5, 4.45),
            furniture('table', 8.15, 6.25), furniture('chair', 8.15, 5.58), furniture('chair', 8.15, 6.94, 180),
            furniture('chair', 7.12, 6.25, -90), furniture('chair', 9.2, 6.25, 90),
            furniture('counter', 8.1, 2.97), furniture('sink', 9.55, 4.65, -90), furniture('stove', 9.55, 3.75, -90),
            furniture('fridge', 7.15, 3.05), furniture('shower', 9.25, 0.7), furniture('toilet', 8.1, 0.6),
            furniture('vanity', 7.35, 0.42), furniture('washer', 0.6, 8.3), furniture('plant', 8.9, 8.3),
            furniture('armchair', 7.3, 8.25), furniture('plant', 5.8, 6.8),
        ],
    }
}

export function validatePlan(input) {
    const fail = () => { throw new Error('方案格式无效，请选择本案例导出的 JSON（版本 1、单位 m）。') }
    const number = (value, minimum, maximum) => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
    const point = (value) => Array.isArray(value) && value.length === 2 && value.every((coordinate) => number(coordinate, -100, 100))
    const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 100
    const color = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    const list = (value, maximum) => Array.isArray(value) && value.length <= maximum
    const unique = (items) => items.every((item) => item && text(item.id)) && new Set(items.map((item) => item.id)).size === items.length
    if (!input || input.format !== PLAN_FORMAT || input.version !== 1 || input.units !== 'm' || !text(input.name) || !number(input.wallHeight, 2, 6)) fail()
    if (!list(input.rooms, 80) || !input.rooms.length || !list(input.walls, 300) || !list(input.furniture, 400)) fail()
    if (![input.rooms, input.walls, input.furniture].every(unique)) fail()
    for (const room of input.rooms) {
        if (!text(room.name) || !Object.hasOwn(SURFACES, room.surface) || !list(room.points, 40) || room.points.length < 3 || !room.points.every(point) || roomArea(room) < 0.01) fail()
        const signedArea = (first, second, third) => (second[0] - first[0]) * (third[1] - first[1]) - (second[1] - first[1]) * (third[0] - first[0])
        for (let edge = 0; edge < room.points.length; edge++) {
            const start = room.points[edge]
            const end = room.points[(edge + 1) % room.points.length]
            if (distance(start, end) < 0.01) fail()
            for (let other = edge + 2; other < room.points.length; other++) {
                if (edge === 0 && other === room.points.length - 1) continue
                const otherStart = room.points[other]
                const otherEnd = room.points[(other + 1) % room.points.length]
                if (signedArea(start, end, otherStart) * signedArea(start, end, otherEnd) <= 0 && signedArea(otherStart, otherEnd, start) * signedArea(otherStart, otherEnd, end) <= 0) {
                    const overlaps = Math.max(Math.min(start[0], end[0]), Math.min(otherStart[0], otherEnd[0])) <= Math.min(Math.max(start[0], end[0]), Math.max(otherStart[0], otherEnd[0])) && Math.max(Math.min(start[1], end[1]), Math.min(otherStart[1], otherEnd[1])) <= Math.min(Math.max(start[1], end[1]), Math.max(otherStart[1], otherEnd[1]))
                    if (overlaps) fail()
                }
            }
        }
    }
    for (const wall of input.walls) {
        if (!point(wall.start) || !point(wall.end) || distance(wall.start, wall.end) < 0.3 || !number(wall.thickness, 0.06, 0.6) || typeof wall.bearing !== 'boolean' || !list(wall.openings, 20) || !unique(wall.openings)) fail()
        let previousEnd = 0
        for (const opening of [...wall.openings].sort((first, second) => first.offset - second.offset)) {
            if (!['door', 'window'].includes(opening.type) || !number(opening.offset, 0, 300) || !number(opening.width, 0.3, 20) || !number(opening.height, 0.3, input.wallHeight) || !number(opening.sill, 0, input.wallHeight - opening.height + 0.001)) fail()
            if (opening.type === 'door' && opening.sill !== 0) fail()
            if (opening.offset - opening.width / 2 < previousEnd - 0.001 || opening.offset + opening.width / 2 > distance(wall.start, wall.end) + 0.001) fail()
            previousEnd = opening.offset + opening.width / 2
        }
    }
    for (const item of input.furniture) {
        if (!CATALOG.some((entry) => entry.type === item.type) || !text(item.name) || !point([item.x, item.y]) || !number(item.width, 0.1, 10) || !number(item.depth, 0.1, 10) || !number(item.height, 0.01, 5) || !number(item.rotation, -360, 360) || !color(item.color)) fail()
    }
    return {
        format: PLAN_FORMAT, version: 1, units: 'm', name: input.name, wallHeight: input.wallHeight,
        rooms: input.rooms.map(({ id, name, surface, points }) => ({ id, name, surface, points: points.map((entry) => [...entry]) })),
        walls: input.walls.map(({ id, start, end, thickness, bearing, openings }) => ({ id, start: [...start], end: [...end], thickness, bearing, openings: openings.map(({ id: openingId, type, offset, width, height, sill }) => ({ id: openingId, type, offset, width, height, sill })) })),
        furniture: input.furniture.map(({ id, type, name, x: positionX, y: positionY, width, depth, height, rotation, color: itemColor }) => ({ id, type, name, x: positionX, y: positionY, width, depth, height, rotation, color: itemColor })),
    }
}
