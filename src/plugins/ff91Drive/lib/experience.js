import * as THREE from 'three'
import { gsap } from 'gsap'
import Camera from './camera.js'
import CarBody from './vehicle-body.js'
import Grid from './ground.js'
import { CarProps } from './vehicle-state.js'
import { loadAssets, resolveAssetBase } from './assets.js'
import { bindInput } from './input.js'

/** Owns its renderer and resources. It never alters the host's Three.js settings. */
class FF91Experience {
    constructor(container, options) {
        this.container = container
        this.options = options
        this.props = new CarProps()
        this.status = 'loading'
        this.started = false
        this.disposed = false
        this.paused = false
        this.active = false
        this.tweens = new Set()
        this.pausedTweens = new Set()
        this.frameId = 0
        this.worldPosition = new THREE.Vector3()
        this.originalTabIndex = container.getAttribute('tabindex')
        this.originalPosition = container.style.position
        this.assetBase = resolveAssetBase(options.assetBase)
    }

    initialize() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
        const ratio = Number.isFinite(this.options.pixelRatio) ? THREE.MathUtils.clamp(this.options.pixelRatio, 0.5, 2) : 1
        this.renderer.setPixelRatio(ratio)
        this.renderer.setClearColor(0x393533)
        this.renderer.toneMapping = THREE.NoToneMapping
        this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
        this.renderer.autoClear = false
        this.renderer.domElement.setAttribute('aria-hidden', 'true')
        this.renderer.domElement.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%'
        if (!this.renderer.extensions.has('EXT_color_buffer_float')) {
            throw new Error('This device cannot render the floating point textures required by the FF 91 ground effects.')
        }
        this.positionChanged = getComputedStyle(this.container).position === 'static'
        if (this.positionChanged) this.container.style.position = 'relative'
        this.container.appendChild(this.renderer.domElement)
        if (!this.container.hasAttribute('tabindex')) this.container.tabIndex = 0
        this.scene = new THREE.Scene()
        this.camera = new Camera({
            distance: 7,
            focusPos: new THREE.Vector3(0, 1, 1.56),
            distRange: { max: 40, min: 4 },
            rotation: new THREE.Vector3(45, 0, 0),
            rotRange: { yMin: -1 },
        })
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.2))
        this.light = new THREE.DirectionalLight(0xffffff, 0)
        this.light.position.set(0, 2, 0)
        this.scene.add(this.light)
        this.assets = loadAssets(this.assetBase, (value) => this.options.onProgress?.(value))
        this.assets.ready.catch(() => {})
        this.grid = new Grid(this.scene, this.renderer, this.assets.cargo.ledA)
        this.resize()
        this.resizeObserver = new ResizeObserver(() => this.resize())
        this.resizeObserver.observe(this.container)
        this.removeInput = bindInput(this.container, this, this.options.onJoystick)
        this.onVisibility = () => this.updateActivity()
        document.addEventListener('visibilitychange', this.onVisibility)
        this.updateActivity()
        this.tween(this.grid.uniProgress, { value: 1, duration: 2 })
        this.tween(this.camera, { distTarget: 30, duration: 1 })
        this.tween(this.camera.rotTarget, { x: 0, y: 90, duration: 1 })
        this.ready = this.assets.ready.then((cargo) => {
            if (this.disposed) return
            this.car = new CarBody(this.scene, cargo)
            this.scene.background = cargo.envSkybox
            this.setLights({ headlights: true, highBeams: false })
            this.status = 'ready'
            this.resize()
            this.options.onReady?.(this)
            if (this.options.autoStart) this.start()
            return this
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

    tween(target, values) {
        const tween = gsap.to(target, { ease: 'power2.inOut', overwrite: 'auto', ...values })
        this.tweens.add(tween)
        if (!this.active) { tween.pause(); this.pausedTweens.add(tween) }
        return tween
    }

    resize() {
        if (this.disposed || !this.renderer) return
        const width = Math.max(1, this.container.clientWidth)
        const height = Math.max(1, this.container.clientHeight)
        this.renderer.setSize(width, height, false)
        this.camera.onWindowResize(width, height)
        this.grid.onWindowResize(width, height, this.renderer.getPixelRatio())
        this.car?.onWindowResize(height * this.renderer.getPixelRatio())
    }

    render(time) {
        if (this.disposed || !this.active) return
        if (this.car && this.props.update(time / 1000)) {
            this.car.update(this.props)
            this.car.carChassis.getWorldPosition(this.worldPosition)
            this.camera.setFocusPos(this.worldPosition.x, 1, this.worldPosition.z)
        }
        this.grid.update(this.car ? this.props : undefined)
        this.camera.update()
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
        if (active) {
            const now = performance.now() / 1000
            this.props.time.prev = this.props.time.prevBreak = now
            for (const tween of this.pausedTweens) tween.resume()
            this.pausedTweens.clear()
            this.frameId = requestAnimationFrame((time) => this.render(time))
        } else {
            cancelAnimationFrame(this.frameId)
            this.props.keys.length = 0
            this.props.joyVec.set(0, 0)
            for (const tween of this.tweens) {
                if (tween.isActive() && !tween.paused()) { tween.pause(); this.pausedTweens.add(tween) }
            }
        }
    }

    start() {
        if (this.disposed || this.started || this.status !== 'ready') return false
        this.started = true
        this.status = 'running'
        this.container.focus({ preventScroll: true })
        this.tween(this.grid.color, { r: 0, g: 0, b: 0, duration: 1 })
        this.tween(this.grid.uniProgress, { value: 0, duration: 1 })
        this.tween(this.camera.rotTarget, { x: -20, y: 0, duration: 1 })
        this.tween(this.camera, { distTarget: 10, distActual: 10, duration: 1 })
        // Since r155, directional light intensity is in physically based units.
        this.tween(this.light, { intensity: Math.PI, duration: 3 })
        this.tween(this.props, { speed: 12, duration: 3 })
        this.options.onStart?.()
        return true
    }

    pause() { this.paused = true; this.updateActivity() }
    resume() { this.paused = false; this.updateActivity() }

    reset() {
        if (this.disposed || !this.car || !this.started) return
        for (const tween of this.tweens) tween.kill()
        this.tweens.clear()
        this.pausedTweens.clear()
        this.props = new CarProps()
        const now = performance.now() / 1000
        this.props.time.prev = this.props.time.prevBreak = now
        this.camera.setRotation(-20, 0, 0)
        this.camera.setDistance(10)
        this.grid.color.setRGB(0, 0, 0)
        this.grid.uniProgress.value = 0
        this.grid.uniOrigin.value = this.props.pos
        this.light.intensity = Math.PI
        this.car.carWheels.wheelFL.rotation.set(0, 0, 0)
        this.car.carWheels.wheelFR.rotation.set(0, 0, 0)
        this.car.carWheels.wheelBL.rotation.set(0, 0, 0)
        this.car.carWheels.wheelBR.rotation.set(0, 0, 0)
        for (const name of ['brakeFL', 'brakeFR', 'brakeBL', 'brakeBR']) this.car.carWheels[name].rotation.y = 0
        this.setLights({ headlights: true, highBeams: false })
    }

    setInput({ throttle = 0, steering = 0, brake = false } = {}) {
        if (this.disposed) return
        const clamp = (value) => THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, -1, 1)
        this.props.joyVec.set(clamp(steering), brake ? -1 : clamp(throttle))
    }

    setLights({ headlights, highBeams } = {}) {
        if (this.disposed || !this.car) return
        const lights = this.car.carLights
        if (headlights !== undefined) lights.uniLightsOther.y = headlights ? 1 : 0
        if (highBeams !== undefined) lights.uniLightsOther.z = highBeams ? 1 : 0
        lights.flareHeadMat.uniforms.brightness.value = lights.uniLightsOther.y || lights.uniLightsOther.z ? 1 : 0
    }

    getState() {
        return {
            status: this.status, started: this.started, paused: this.paused,
            speed: this.props.speed, braking: Boolean(this.props.braking), steering: this.props.wAngleInner,
            leftSignal: Boolean(this.car?.carLights.uniLightsTurn.y),
            rightSignal: Boolean(this.car?.carLights.uniLightsTurn.z),
        }
    }

    dispose() {
        if (this.disposed) return
        this.disposed = true
        this.status = 'disposed'
        cancelAnimationFrame(this.frameId)
        this.resizeObserver?.disconnect()
        this.removeInput?.()
        if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility)
        for (const tween of this.tweens) tween.kill()
        this.tweens.clear()
        this.pausedTweens.clear()
        this.assets?.dispose(this.scene)
        this.grid?.rippleGen.dispose()
        this.scene?.clear()
        this.renderer?.dispose()
        this.renderer?.forceContextLoss()
        this.renderer?.domElement.remove()
        if (this.positionChanged) this.container.style.position = this.originalPosition
        if (this.originalTabIndex === null) this.container.removeAttribute('tabindex')
        else this.container.setAttribute('tabindex', this.originalTabIndex)
        this.car = this.grid = this.assets = this.scene = this.renderer = null
    }
}

export function createFF91Experience(container, options = {}) {
    if (!container?.appendChild) throw new TypeError('FF 91 requires a DOM container.')
    const experience = new FF91Experience(container, options)
    try { experience.initialize(); return experience }
    catch (error) { experience.dispose(); throw error }
}
