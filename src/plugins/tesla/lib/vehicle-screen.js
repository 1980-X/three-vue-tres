import { Box3, CanvasTexture, MathUtils, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three'
import { readVehicleTelemetry } from './live-drive.js'

export function createVehicleScreen(model, vehicle) {
    let display = null
    model.getObjectByName(vehicle.screenNode)?.traverse((node) => {
        if (node.isMesh && [node.material].flat().some(material => material.name === vehicle.screenMaterial)) display = node
    })
    if (!display) throw new Error(`${vehicle.name} 缺少车内屏幕：${vehicle.screenNode}/${vehicle.screenMaterial}`)
    model.updateWorldMatrix(true, true)
    const toVehicle = new Matrix4().copy(model.matrixWorld).invert().multiply(display.matrixWorld)
    const positions = display.geometry.getAttribute('position').clone().applyMatrix4(toVehicle)
    const bounds = new Box3().setFromBufferAttribute(positions)
    const front = new Box3()
    const point = new Vector3()
    const split = bounds.getCenter(new Vector3()).z
    for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i)
        if (!vehicle.combinedScreen || point.z < split) front.expandByPoint(point)
    }
    // Fit in vehicle coordinates; some models combine front and rear screens.
    const center = front.getCenter(new Vector3())
    const size = front.getSize(new Vector3())
    const tilt = Math.atan2(size.z, size.y)
    const normal = new Vector3(0, Math.sin(tilt), Math.cos(tilt))
    const canvas = document.createElement('canvas')
    canvas.width = 1440
    canvas.height = 900
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('当前设备无法绘制车内仪表。')
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 4
    const panel = new Mesh(new PlaneGeometry(size.x * 1.12, Math.hypot(size.y, size.z) * 1.12), new MeshBasicMaterial({
        map: texture, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }))
    panel.name = 'TeslaLiveInstruments'
    panel.position.copy(center).addScaledVector(normal, .006)
    panel.rotation.x = -tilt
    model.add(panel)
    // Keep the white instruments readable through the dark side glazing.
    model.traverse((node) => {
        if (!node.isMesh) return
        const adapt = (material) => {
            if (material.name !== 'Glass_Windows') return material
            const glass = material.clone()
            glass.opacity = .16
            glass.depthWrite = false
            return glass
        }
        node.material = Array.isArray(node.material) ? node.material.map(adapt) : adapt(node.material)
    })

    const text = (value, x, y, fontSize, color = '#f7fafc', align = 'center') => {
        ctx.font = `600 ${fontSize}px Arial, "Microsoft YaHei", sans-serif`
        ctx.fillStyle = color
        ctx.textAlign = align
        ctx.fillText(String(value), x, y)
    }
    const gauge = (x, value, max, label, unit, unknown = false, redline = max) => {
        const start = Math.PI * .75, arc = Math.PI * 1.5
        const ratio = MathUtils.clamp(value / max, 0, 1)
        ctx.lineCap = 'round'
        ctx.lineWidth = 16
        ctx.beginPath(); ctx.arc(x, 370, 220, start, start + arc); ctx.strokeStyle = '#253345'; ctx.stroke()
        ctx.beginPath(); ctx.arc(x, 370, 220, start, start + arc * ratio); ctx.strokeStyle = '#ff5278'; ctx.stroke()
        for (let i = 0; i <= 8; i++) {
            const angle = start + arc * i / 8
            const r = 220
            ctx.lineWidth = 3
            ctx.strokeStyle = i / 8 >= redline / max ? '#ff5278' : '#93a8bd'
            ctx.beginPath(); ctx.moveTo(x + Math.cos(angle) * (r - 22), 370 + Math.sin(angle) * (r - 22)); ctx.lineTo(x + Math.cos(angle) * (r - 8), 370 + Math.sin(angle) * (r - 8)); ctx.stroke()
            text(Math.round(max * i / 8), x + Math.cos(angle) * 174, 379 + Math.sin(angle) * 174, 23, '#a9bed1')
        }
        text(unknown ? '—' : Math.round(value).toLocaleString('en-US'), x, 410, unit === 'km/h' ? 112 : 82)
        text(unit, x, 458, 28, '#a9bed1')
        text(label, x, 540, 29)
    }
    let signature = ''
    let disposed = false
    let latest = null
    let latestProfile = null
    function update(state, profile) {
        if (disposed || !state || !profile) return
        latest = state
        latestProfile = profile
        const telemetry = readVehicleTelemetry(state)
        const { speed, phase, fresh } = telemetry
        const rpm = state.engine.rpm
        const max = Math.ceil((profile.config.engine.limiterRpm || profile.config.engine.redlineRpm) / 1000) * 1000
        const gear = phase === 'parked' ? 'P' : state.engine.gearLabel
        const labels = { parked: '车辆静止', accelerating: '正在加速', braking: '制动减速', left: state.mode === 'demo' ? '模拟左转' : '左转 · 航向估算', right: state.mode === 'demo' ? '模拟右转' : '右转 · 航向估算', driving: '匀速行驶' }
        const location = state.mode === 'demo' ? '桌面演示' : ({ denied: '需要允许定位', unsupported: '浏览器不支持定位', insecure: '需要 HTTPS 定位', unavailable: '正在寻找定位信号', requesting: '等待定位授权' })[state.gpsStatus]
            || ({ none: '等待定位 · 驻车待机', fresh: 'GPS 实时连接', stale: '定位延迟 · 平缓停车', lost: '定位中断 · 已停车' })[state.motion.quality]
        const sound = state.status === 'starting' || state.status === 'switching' ? `加载声浪 ${state.progress}%` : state.error ? `${state.error}${state.audioBlocked ? ' · 点按重试声浪' : ''}` : state.audioBlocked ? '点按场景启用声浪' : state.status !== 'running' ? '声浪待机' : state.motion.quality === 'none' || state.motion.quality === 'lost' ? '等待定位 · 声浪静音' : '声浪已连接'
        const next = JSON.stringify([Math.round(speed * 3.6), Math.round(rpm), gear, phase, location, sound, fresh, profile.id, state.engine.load.toFixed(2), telemetry.acceleration.toFixed(2), state.settings.volume, state.settings.intensity])
        if (signature === next) return
        signature = next
        ctx.fillStyle = '#07111e'; ctx.fillRect(0, 0, 1440, 900)
        ctx.strokeStyle = '#ff5278'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 1430, 890)
        text('EV ENGINE  /  TESLA', 48, 64, 32, '#ff7094', 'left')
        text(profile.name, 1390, 64, 30, '#e6f2ff', 'right')
        gauge(320, speed * 3.6, 240, '当前时速', 'km/h', !fresh && !speed)
        gauge(1120, rpm, max, '模拟转速', 'rpm', false, profile.config.engine.redlineRpm)
        text('GEAR', 720, 270, 26, '#a9bed1')
        text(gear, 720, 397, 110)
        text('模拟挡位', 720, 439, 23, '#a9bed1')
        text(labels[phase], 720, 475, 27, phase === 'braking' ? '#ff7094' : '#a9bed1')
        const ratio = rpm / profile.config.engine.redlineRpm
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = i / 40 < ratio ? i > 33 ? '#ff355c' : '#ff8ca7' : '#24303f'
            ctx.fillRect(55 + i * 33.5, 632, 25, 22)
        }
        text('加速度', 280, 724, 26, '#a9bed1')
        text(`${telemetry.acceleration > 0 ? '+' : ''}${telemetry.acceleration.toFixed(2)} m/s²`, 280, 774, 40)
        text('模拟负载', 720, 724, 26, '#a9bed1')
        text(`${Math.round(state.engine.load * 100)}%`, 720, 774, 40)
        text(location || '等待位置', 1160, 724, 27, fresh ? '#70edb2' : '#ffd28b')
        text(`音量 ${state.settings.volume}% · 强度 ${state.settings.intensity}%`, 1160, 772, 24, '#a9bed1')
        // Long browser/GPS errors stay inside the in-car screen.
        text(sound.length > 48 ? `${sound.slice(0, 47)}…` : sound, 720, 856, 27, '#e0eaf4')
        texture.needsUpdate = true
    }
    document.fonts?.ready.then(() => { signature = ''; update(latest, latestProfile) })
    return {
        update,
        getCabinView() {
            model.updateWorldMatrix(true, true)
            return { target: model.localToWorld(center.clone()), position: model.localToWorld(center.clone().add(new Vector3(-.32, .26, .72))) }
        },
        dispose() {
            disposed = true
            panel.removeFromParent()
            panel.geometry.dispose()
            panel.material.dispose()
            texture.dispose()
            canvas.width = canvas.height = 0
        },
    }
}

