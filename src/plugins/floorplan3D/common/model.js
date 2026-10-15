import {
    BoxGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, FrontSide, Group, Mesh,
    MeshStandardMaterial, RepeatWrapping, Shape, ShapeGeometry, SphereGeometry, SRGBColorSpace,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { distance, planBounds, roomArea, SURFACES, wallAngle } from './plan'

function floorTexture(surface) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    context.fillStyle = surface.color
    context.fillRect(0, 0, 256, 256)
    if (surface.pattern === 'wood') {
        for (let board = 0; board < 4; board++) {
            context.fillStyle = board % 2 ? '#ffffff14' : '#00000008'
            context.fillRect(board * 64, 0, 64, 256)
            context.strokeStyle = '#5d493a35'
            context.lineWidth = 1.2
            context.strokeRect(board * 64, board % 2 ? -128 : 0, 64, 256)
            context.strokeRect(board * 64, board % 2 ? 128 : 256, 64, 256)
            context.strokeStyle = '#725e4920'
            for (let grain = 0; grain < 7; grain++) {
                context.beginPath()
                context.moveTo(board * 64 + grain * 9 + 4, 0)
                context.bezierCurveTo(board * 64 + grain * 9 + 12, 75, board * 64 + grain * 9 - 3, 175, board * 64 + grain * 9 + 5, 256)
                context.stroke()
            }
        }
    } else if (surface.pattern === 'tile') {
        context.strokeStyle = '#7d7a6e40'
        context.lineWidth = 2
        context.strokeRect(0, 0, 256, 256)
    } else {
        for (let speck = 0; speck < 900; speck++) {
            const horizontal = (speck * 71.73) % 256
            const vertical = (speck * speck * 13.37) % 256
            context.fillStyle = speck % 2 ? '#ffffff35' : '#383c3725'
            const size = surface.pattern === 'terrazzo' ? 2 + speck % 5 : 1
            context.fillRect(horizontal, vertical, size, size)
        }
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(surface.pattern === 'tile' ? 1 / 0.8 : 1, surface.pattern === 'tile' ? 1 / 0.8 : 1)
    return texture
}

export function createModel(plan, { cutaway = false, furnitureVisible = true } = {}) {
    const root = new Group()
    root.name = plan.name
    root.userData = { format: plan.format, units: 'm', wallHeight: plan.wallHeight }
    const materials = new Map()
    const material = (color, opacity = 1) => {
        const key = `${color}:${opacity}`
        if (!materials.has(key)) materials.set(key, new MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: opacity < 1 ? DoubleSide : FrontSide }))
        return materials.get(key)
    }
    const box = (parent, width, height, depth, color, positionX = 0, positionY = height / 2, positionZ = 0, rounded = false, opacity = 1) => {
        if (Math.min(width, height, depth) < 0.001) return null
        const geometry = rounded ? new RoundedBoxGeometry(width, height, depth, 2, Math.min(width, height, depth, 0.22) * 0.18) : new BoxGeometry(width, height, depth)
        const mesh = new Mesh(geometry, material(color, opacity))
        mesh.position.set(positionX, positionY, positionZ)
        mesh.castShadow = opacity === 1
        mesh.receiveShadow = true
        parent.add(mesh)
        return mesh
    }
    const cylinder = (parent, top, bottom, height, color, positionX = 0, positionY = height / 2, positionZ = 0) => {
        const mesh = new Mesh(new CylinderGeometry(top, bottom, height, 24), material(color))
        mesh.position.set(positionX, positionY, positionZ)
        mesh.castShadow = true
        mesh.receiveShadow = true
        parent.add(mesh)
        return mesh
    }
    const sphere = (parent, width, height, depth, color, positionX, positionY, positionZ) => {
        const mesh = new Mesh(new SphereGeometry(1, 16, 12), material(color))
        mesh.scale.set(width / 2, height / 2, depth / 2)
        mesh.position.set(positionX, positionY, positionZ)
        mesh.castShadow = true
        parent.add(mesh)
        return mesh
    }
    const bounds = planBounds(plan)
    const base = new Group()
    base.name = '建筑 / 楼板'
    box(base, bounds.maxX - bounds.minX + 0.3, 0.16, bounds.maxY - bounds.minY + 0.3, '#e0dbd1', (bounds.minX + bounds.maxX) / 2, -0.09, (bounds.minY + bounds.maxY) / 2)
    root.add(base)
    for (const room of plan.rooms) {
        const shape = new Shape(room.points.map(([horizontal, vertical]) => ({ x: horizontal, y: -vertical })))
        const surface = SURFACES[room.surface]
        const floor = new Mesh(new ShapeGeometry(shape), new MeshStandardMaterial({ map: floorTexture(surface), roughness: surface.pattern === 'tile' ? 0.48 : 0.82, side: DoubleSide }))
        floor.name = `地面 / ${room.name}`
        floor.rotation.x = -Math.PI / 2
        floor.position.y = 0.002
        floor.receiveShadow = true
        floor.userData = { kind: 'room', id: room.id, area: roomArea(room), surface: room.surface }
        root.add(floor)
    }
    const wallHeight = cutaway ? Math.min(0.95, plan.wallHeight) : plan.wallHeight
    for (const wall of plan.walls) {
        const group = new Group()
        group.name = `墙体 / ${wall.id}`
        group.userData = { kind: 'wall', id: wall.id, bearing: wall.bearing }
        group.position.set(wall.start[0], 0, wall.start[1])
        group.rotation.y = -wallAngle(wall)
        const length = distance(wall.start, wall.end)
        const wallColor = wall.bearing ? '#d5d1c9' : '#eeeae0'
        let cursor = 0
        for (const opening of [...wall.openings].sort((first, second) => first.offset - second.offset)) {
            const left = opening.offset - opening.width / 2
            box(group, left - cursor, wallHeight, wall.thickness, wallColor, (left + cursor) / 2)
            const bottom = Math.min(opening.sill, wallHeight)
            const top = Math.min(opening.sill + opening.height, wallHeight)
            box(group, opening.width, bottom, wall.thickness, wallColor, opening.offset)
            box(group, opening.width, wallHeight - top, wall.thickness, wallColor, opening.offset, top + (wallHeight - top) / 2)
            if (top > bottom) {
                const frameColor = opening.type === 'window' ? '#8e9e9b' : '#b7a083'
                const visibleHeight = top - bottom
                const centerHeight = bottom + visibleHeight / 2
                for (const direction of [-1, 1]) box(group, 0.045, visibleHeight, wall.thickness + 0.025, frameColor, opening.offset + direction * (opening.width / 2 - 0.0225), centerHeight)
                if (opening.sill + opening.height <= wallHeight) box(group, opening.width, 0.045, wall.thickness + 0.025, frameColor, opening.offset, top - 0.0225)
                if (opening.type === 'window') {
                    box(group, opening.width, 0.045, wall.thickness + 0.025, frameColor, opening.offset, bottom + 0.0225)
                    box(group, opening.width - 0.09, visibleHeight - 0.08, 0.018, '#b5d4da', opening.offset, centerHeight, 0, false, 0.28)
                    box(group, 0.035, visibleHeight, 0.05, frameColor, opening.offset, centerHeight)
                } else {
                    const leafCount = opening.width > 1.5 ? 2 : 1
                    for (let leaf = 0; leaf < leafCount; leaf++) {
                        const leafWidth = (opening.width - 0.09) / leafCount
                        const hinge = new Group()
                        hinge.position.set(left + 0.045 + (leaf ? leafWidth * 2 : 0), 0, 0)
                        hinge.rotation.y = (leaf ? 1 : -1) * Math.PI / 3
                        const sign = leaf ? -1 : 1
                        box(hinge, leafWidth, visibleHeight - 0.05, 0.04, '#c5ac89', sign * leafWidth / 2, visibleHeight / 2, 0, true)
                        box(hinge, 0.1, 0.025, 0.065, '#77736a', sign * (leafWidth - 0.1), Math.min(1.03, visibleHeight * 0.65))
                        group.add(hinge)
                    }
                }
            }
            cursor = opening.offset + opening.width / 2
        }
        box(group, length - cursor, wallHeight, wall.thickness, wallColor, (cursor + length) / 2)
        root.add(group)
    }
    if (!furnitureVisible) return root
    for (const item of plan.furniture) {
        const group = new Group()
        group.name = `家具 / ${item.name}`
        group.userData = { kind: 'furniture', id: item.id, type: item.type }
        group.position.set(item.x, 0.012, item.y)
        group.rotation.y = -item.rotation * Math.PI / 180
        const width = item.width
        const depth = item.depth
        const height = item.height
        const color = item.color
        const darker = `#${new Color(color).multiplyScalar(0.78).getHexString()}`
        const legs = (legHeight, inset = 0.1) => {
            for (const horizontal of [-1, 1]) for (const vertical of [-1, 1]) {
                box(group, Math.min(0.045, width * 0.1), legHeight, Math.min(0.045, depth * 0.1), '#76604b', horizontal * width * (0.5 - inset), legHeight / 2, vertical * depth * (0.5 - inset))
            }
        }
        switch (item.type) {
            case 'bed':
                box(group, width, height * 0.27, depth, darker, 0, height * 0.19, 0, true)
                box(group, width * 0.97, height * 0.2, depth * 0.93, '#f2eee6', 0, height * 0.42, 0, true)
                box(group, width, height * 0.14, depth * 0.65, color, 0, height * 0.55, depth * 0.13, true)
                box(group, width, height, depth * 0.06, darker, 0, height / 2, -depth * 0.47, true)
                for (const side of [-1, 1]) box(group, width * 0.39, height * 0.13, depth * 0.19, '#f9f6ef', side * width * 0.24, height * 0.58, -depth * 0.31, true)
                break
            case 'sofa':
            case 'armchair': {
                legs(height * 0.13)
                box(group, width, height * 0.26, depth, darker, 0, height * 0.26, 0, true)
                box(group, width, height * 0.72, depth * 0.19, color, 0, height * 0.64, -depth * 0.4, true)
                for (const side of [-1, 1]) box(group, width * 0.08, height * 0.45, depth, darker, side * width * 0.46, height * 0.5, 0, true)
                const seats = item.type === 'sofa' ? 3 : 1
                for (let seat = 0; seat < seats; seat++) box(group, width * 0.81 / seats, height * 0.16, depth * 0.77, color, width * 0.83 * ((seat + 0.5) / seats - 0.5), height * 0.46, depth * 0.09, true)
                if (seats > 1) box(group, width * 0.15, height * 0.38, depth * 0.12, '#e8ddca', -width * 0.3, height * 0.66, -depth * 0.21, true)
                break
            }
            case 'table':
            case 'coffee':
            case 'desk':
                legs(height * 0.9)
                box(group, width, height * 0.1, depth, color, 0, height * 0.95, 0, true)
                if (item.type === 'desk') {
                    box(group, width * 0.34, height * 0.36, depth * 0.04, '#414b4d', 0, height * 1.28, -depth * 0.22, true)
                    box(group, width * 0.16, height * 0.03, depth * 0.19, '#666b69', 0, height * 1.02, -depth * 0.2)
                }
                break
            case 'chair':
                legs(height * 0.49)
                box(group, width, height * 0.1, depth, color, 0, height * 0.52, 0, true)
                box(group, width, height * 0.46, depth * 0.12, color, 0, height * 0.77, -depth * 0.44, true)
                break
            case 'rug':
                box(group, width, height, depth, color, 0, height / 2, 0, true)
                break
            case 'plant':
                cylinder(group, width * 0.29, width * 0.21, height * 0.32, '#bdab91')
                cylinder(group, width * 0.025, width * 0.035, height * 0.5, '#735a3e', 0, height * 0.49)
                for (let leaf = 0; leaf < 7; leaf++) {
                    const angle = leaf * 2.4
                    const crown = sphere(group, width * 0.62, height * 0.38, depth * 0.5, color, Math.sin(angle) * width * 0.21, height * (0.59 + leaf % 3 * 0.1), Math.cos(angle) * depth * 0.2)
                    crown.rotation.z = Math.sin(angle) * 0.5
                }
                break
            case 'lamp':
                cylinder(group, width * 0.33, width * 0.4, height * 0.025, '#646457')
                cylinder(group, width * 0.023, width * 0.023, height * 0.8, '#8e8062', 0, height * 0.42)
                cylinder(group, width * 0.28, width * 0.5, height * 0.22, color, 0, height * 0.87)
                break
            case 'toilet':
                box(group, width * 0.9, height * 0.8, depth * 0.24, color, 0, height * 0.6, -depth * 0.36, true)
                sphere(group, width * 0.87, height * 0.56, depth * 0.76, color, 0, height * 0.28, depth * 0.08)
                sphere(group, width, height * 0.12, depth * 0.78, '#f8f6ef', 0, height * 0.58, depth * 0.08)
                break
            case 'shower':
                box(group, width, height * 0.025, depth, '#e0dfd5', 0, height * 0.0125)
                box(group, width, height, 0.018, color, 0, height / 2, -depth / 2, false, 0.22)
                box(group, 0.018, height, depth, color, width / 2, height / 2, 0, false, 0.22)
                for (const side of [-1, 1]) box(group, 0.025, height, 0.025, '#8c9896', width / 2, height / 2, side * depth / 2)
                cylinder(group, 0.015, 0.015, height * 0.8, '#959c98', -width * 0.15, height * 0.55, -depth * 0.44)
                cylinder(group, width * 0.12, width * 0.12, 0.025, '#959c98', -width * 0.15, height * 0.94, -depth * 0.3)
                break
            default: {
                const cabinetHeight = item.type === 'tvstand' ? height * 0.62 : height
                box(group, width, cabinetHeight, depth, color, 0, cabinetHeight / 2, 0, true)
                if (item.type === 'bookshelf') {
                    box(group, width * 0.91, height * 0.89, depth * 0.12, darker, 0, height * 0.49, depth * 0.47)
                    for (let shelf = 1; shelf < 5; shelf++) {
                        box(group, width, 0.035, depth, color, 0, height * shelf / 5)
                        for (let book = 0; book < 4; book++) box(group, width * 0.11, height * (0.1 + book % 2 * 0.03), depth * 0.7, ['#928879', '#c3c2a9', '#879b93', '#ab8b78'][book], width * (book * 0.2 - 0.3), height * shelf / 5 + height * 0.075, depth * 0.15)
                    }
                } else if (item.type === 'washer') {
                    const drum = cylinder(group, width * 0.32, width * 0.32, 0.025, '#505c60', 0, height * 0.46, depth * 0.51)
                    drum.rotation.x = Math.PI / 2
                    box(group, width * 0.75, height * 0.065, 0.02, '#aab1ad', 0, height * 0.86, depth * 0.51)
                } else {
                    const panels = Math.max(1, Math.round(width / 0.6))
                    for (let panel = 1; panel < panels; panel++) box(group, 0.012, cabinetHeight * 0.9, 0.01, darker, width * (panel / panels - 0.5), cabinetHeight * 0.48, depth * 0.505)
                    for (let panel = 0; panel < panels; panel++) box(group, 0.024, cabinetHeight * 0.12, 0.024, '#807b6d', width * ((panel + 0.75) / panels - 0.5), cabinetHeight * 0.67, depth * 0.53)
                }
                if (item.type === 'tvstand') {
                    box(group, width * 0.74, height * 1.75, 0.05, '#343f43', 0, height * 1.63, -depth * 0.15, true)
                    box(group, width * 0.2, 0.025, depth * 0.5, '#495150', 0, cabinetHeight + 0.02)
                }
                if (item.type === 'fridge') box(group, width * 0.96, 0.015, 0.012, darker, 0, height * 0.32, depth * 0.51)
                if (['counter', 'stove', 'sink', 'vanity'].includes(item.type)) box(group, width * 1.02, height * 0.045, depth * 1.02, '#eeeae1', 0, height)
                if (item.type === 'stove') {
                    box(group, width * 0.86, 0.025, depth * 0.78, '#404b4b', 0, height + 0.025)
                    for (const side of [-1, 1]) cylinder(group, width * 0.15, width * 0.15, 0.02, '#7d8481', side * width * 0.24, height + 0.045)
                }
                if (['sink', 'vanity'].includes(item.type)) {
                    box(group, width * 0.59, 0.025, depth * 0.65, '#929f9e', 0, height + 0.025, 0, true)
                    box(group, width * 0.48, 0.027, depth * 0.52, '#bfcac8', 0, height + 0.03, 0, true)
                    cylinder(group, 0.018, 0.018, 0.22, '#8b9795', 0, height + 0.11, -depth * 0.36)
                    box(group, 0.035, 0.035, depth * 0.19, '#8b9795', 0, height + 0.2, -depth * 0.28)
                }
                break
            }
        }
        root.add(group)
    }
    return root
}

export function disposeModel(root) {
    const geometries = new Set()
    const materials = new Set()
    const textures = new Set()
    root.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry)
        for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
            materials.add(material)
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
        }
    })
    textures.forEach((texture) => texture.dispose())
    materials.forEach((material) => material.dispose())
    geometries.forEach((geometry) => geometry.dispose())
}
