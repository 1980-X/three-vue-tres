import * as THREE from 'three'
import { DriveCamera, DriveState, bindDriveInput } from 'PLS/ff91Drive'
import { loadDriveAssets } from './drive-assets.js'
import { createModelY } from './model-y.js'
import { createTeslaGround } from './drive-ground.js'
import { createDriveEnvironment } from './drive-environment.js'
import { createDisplayCamera, readVehicleTelemetry, updateLiveDriveState } from './live-drive.js'

class TeslaDriveScene {
    constructor(container, options) {
        this.container = container
        this.options = { gyroscope: false, ...options }
        this.props = new DriveState()
        this.status = 'loading'
        this.cameraView = 'exterior'
        this.started = this.paused = this.active = this.disposed = false
    }

    initialize() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
        this.renderer.setClearColor(0x14030b)
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.renderer.outputColorSpace = THREE.SRGBColorSpace
        this.renderer.autoClear = false
        if (!this.renderer.extensions.has('EXT_color_buffer_float')) throw new Error('当前设备不支持地面波纹所需的浮点纹理。')
        this.renderer.domElement.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%'
        this.renderer.domElement.setAttribute('aria-hidden', 'true')
        this.container.appendChild(this.renderer.domElement)
        this.scene = new THREE.Scene()
        this.camera = new DriveCamera({
            distance: this.options.telemetry ? 6.4 : 12, focusPos: new THREE.Vector3(0, this.options.telemetry ? .95 : .8, 0),
            rotation: new THREE.Vector3(this.options.telemetry ? -125 : 35, this.options.telemetry ? 16 : 20, 0),
            distRange: { min: this.options.telemetry ? .55 : 4, max: 24 }, rotRange: { yMin: 3, yMax: 75 },
        })
        this.scene.add(new THREE.HemisphereLight(0xff829e, 0x14020b, 0.55))
        this.light = new THREE.DirectionalLight(0xffe2ec, 2.5)
        this.scene.add(this.light)
        const redRim = new THREE.DirectionalLight(0xff174a, 4)
        redRim.position.set(-5, 4, -6)
        const magentaRim = new THREE.DirectionalLight(0xc32f8c, 2)
        magentaRim.position.set(5, 3, 4)
        this.scene.add(redRim, magentaRim)
        this.assets = loadDriveAssets(this.options.onProgress, this.options.modelId)
        this.assets.ready.catch(() => {})
        this.grid = createTeslaGround(this.scene, this.renderer, this.assets.cargo.teslaMark)
        this.resize()
        this.observer = new ResizeObserver(() => this.resize())
        this.observer.observe(this.container)
        if (!this.options.telemetry) this.removeInput = bindDriveInput(this.container, this, this.options.onJoystick)
        this.onVisibility = () => this.updateActivity()
        document.addEventListener('visibilitychange', this.onVisibility)
        this.updateActivity()
        this.ready = this.assets.ready.then((cargo) => {
            if (this.disposed) return
            this.vehicle = createModelY(this.scene, cargo, { dashboard: this.options.telemetry })
            this.props = new DriveState(this.vehicle.spec)
            this.syncTime()
            this.vehicle.reset()
            if (this.options.telemetry) {
                this.displayCamera = createDisplayCamera(this.container, this.camera, this.vehicle)
                this.displayCamera.setView(this.cameraView)
                this.vehicle.setTelemetry(this.telemetry, this.profile)
            }
            this.environment = createDriveEnvironment(this.scene, this.renderer, cargo.envSkybox)
            this.resize()
            this.status = 'ready'
            this.options.onReady?.()
            if (this.options.telemetry) this.start()
        }).catch((error) => {
            if (!this.disposed) {
                this.dispose()
                this.status = 'error'
                this.options.onError?.(error)
            }
            throw error
        })
        this.ready.catch(() => {})
    }

    syncTime() {
        this.lastFrame = performance.now() / 1000
        this.props.time.prev = this.props.time.prevBreak = this.lastFrame
    }

    resize() {
        if (this.disposed) return
        const width = Math.max(1, this.container.clientWidth)
        const height = Math.max(1, this.container.clientHeight)
        this.renderer.setSize(width, height, false)
        this.camera.onWindowResize(width, height)
        this.grid.onWindowResize(width, height, this.renderer.getPixelRatio())
        this.vehicle?.resize(height * this.renderer.getPixelRatio())
    }

    render(time) {
        if (!this.active || this.disposed) return
        const seconds = time / 1000
        const delta = Math.max(0, Math.min(seconds - this.lastFrame, this.options.telemetry ? .25 : .05))
        this.lastFrame = seconds
        if (this.vehicle && this.options.telemetry) {
            const telemetry = readVehicleTelemetry(this.telemetry)
            updateLiveDriveState(this.props, telemetry, delta)
            this.vehicle.update(this.props)
            this.grid.update(this.props)
            this.displayCamera.update(this.props, telemetry, delta)
        } else if (this.vehicle && this.props.update(seconds)) {
            this.vehicle.update(this.props)
            this.grid.update(this.props)
        } else if (!this.vehicle) this.grid.update()
        this.grid.setIntro(THREE.MathUtils.damp(this.grid.uniProgress.value, this.started ? 0 : 1, 4, delta))
        this.camera.update()
        this.environment?.update(this.camera.camera)
        this.light.position.copy(this.camera.camera.position).normalize()
        this.light.position.y = 1
        this.renderer.setRenderTarget(null)
        this.renderer.clear()
        this.renderer.render(this.scene, this.camera.camera)
        this.frameId = requestAnimationFrame((next) => this.render(next))
    }

    updateActivity() {
        if (this.disposed) return
        const active = !this.paused && !document.hidden
        if (active === this.active) return
        this.active = active
        this.syncTime()
        if (active) this.frameId = requestAnimationFrame((time) => this.render(time))
        else {
            cancelAnimationFrame(this.frameId)
            this.props.keys.length = 0
            this.props.joyVec.set(0, 0)
            this.displayCamera?.clear()
        }
    }

    start() {
        if (this.disposed || this.started || this.status !== 'ready') return
        this.started = true
        this.status = 'running'
        if (!this.options.telemetry) {
            this.props.speed = 12
            this.camera.rotTarget.set(-20, 10, 0)
            this.camera.distTarget = 8.5
            this.container.focus({ preventScroll: true })
        }
        this.options.onStart?.()
    }

    pause() { this.paused = true; this.updateActivity() }
    resume() { this.paused = false; this.updateActivity() }

    reset() {
        if (this.disposed || !this.vehicle) return
        this.props = new DriveState(this.vehicle.spec)
        this.syncTime()
        this.vehicle.reset()
        this.grid.uniOrigin.value = this.props.pos
        this.camera.setRotation(-20, 10, 0)
        this.camera.setDistance(8.5)
    }

    setInput({ throttle = 0, steering = 0, brake = false } = {}) {
        if (this.options.telemetry) return
        const clamp = (value) => THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, -1, 1)
        this.props.joyVec.set(clamp(steering), brake ? -1 : clamp(throttle))
    }

    setTelemetry(state, profile) {
        if (this.disposed) return
        this.telemetry = state
        this.profile = profile
        this.vehicle?.setTelemetry(state, profile)
    }

    setCameraView(view) {
        if (this.disposed) return
        this.cameraView = view === 'interior' ? 'interior' : 'exterior'
        this.displayCamera?.setView(this.cameraView)
    }

    getState() {
        return { status: this.status, speed: this.props.speed, steering: this.props.wAngleInner, braking: Boolean(this.props.braking) }
    }

    dispose() {
        if (this.disposed) return
        this.disposed = true
        this.status = 'disposed'
        cancelAnimationFrame(this.frameId)
        this.observer?.disconnect()
        this.removeInput?.()
        this.displayCamera?.dispose()
        this.vehicle?.dispose()
        if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility)
        this.assets?.dispose(this.scene)
        this.environment?.dispose()
        this.grid?.rippleGen.dispose()
        this.scene?.clear()
        this.renderer?.dispose()
        this.renderer?.forceContextLoss()
        this.renderer?.domElement.remove()
    }
}

export function createTeslaDrive(container, options = {}) {
    const scene = new TeslaDriveScene(container, options)
    try { scene.initialize(); return scene }
    catch (error) { scene.dispose(); throw error }
}
