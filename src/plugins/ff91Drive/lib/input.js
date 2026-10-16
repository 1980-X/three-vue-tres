import { MathUtils, Plane, Raycaster, Vector2, Vector3 } from 'three'

/** Pointer controls belong to the container; keyboard input belongs to its focus. */
export function bindInput(element, experience, onJoystick = () => {}) {
    const listeners = []
    const pointers = new Map()
    const ray = new Raycaster()
    const ground = new Plane(new Vector3(0, 1, 0), 0)
    const point = new Vector3()
    const mouse = new Vector2()
    let gesture = null
    let pinch = null
    let hasGyro = false
    const listen = (target, type, listener, options) => {
        target.addEventListener(type, listener, options)
        listeners.push(() => target.removeEventListener(type, listener, options))
    }
    const hideJoystick = () => onJoystick({ visible: false, x: 0, y: 0, dx: 0, dy: 0 })
    const clear = () => {
        experience.props.keys.length = 0
        experience.props.joyVec.set(0, 0)
        gesture = pinch = null
        pointers.clear()
        hideJoystick()
    }
    const ripple = (event) => {
        const rect = element.getBoundingClientRect()
        mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2)
        ray.setFromCamera(mouse, experience.camera.camera)
        if (ray.ray.intersectPlane(ground, point)) experience.grid.moveRippleOrigin(point.x, point.z)
    }
    const beginGesture = (pointer) => {
        const rect = element.getBoundingClientRect()
        const drive = pointer.pointerType !== 'mouse' && (hasGyro || pointer.x - rect.left < rect.width / 2)
        gesture = { mode: drive ? 'drive' : 'orbit', start: pointer, last: pointer }
        if (drive) onJoystick({ visible: true, x: pointer.x - rect.left, y: pointer.y - rect.top, dx: 0, dy: 0 })
    }
    listen(element, 'pointerdown', (event) => {
        if (experience.paused || !experience.active) return
        if (event.pointerType === 'mouse' && event.button !== 0) return
        if (event.target.closest('button, a, input, select, textarea')) return
        event.preventDefault()
        element.focus({ preventScroll: true })
        if (element.setPointerCapture) element.setPointerCapture(event.pointerId)
        const pointer = { x: event.clientX, y: event.clientY, pointerType: event.pointerType }
        pointers.set(event.pointerId, pointer)
        if (!experience.started) {
            gesture = { mode: 'intro', start: pointer, last: pointer }
            ripple(event)
            return
        }
        if (pointers.size === 1) beginGesture(pointer)
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()]
            pinch = { length: Math.hypot(a.x - b.x, a.y - b.y), distance: experience.camera.distTarget }
            experience.props.joyVec.set(0, 0)
            hideJoystick()
        }
    })
    listen(element, 'pointermove', (event) => {
        if (experience.paused || !experience.active) { clear(); return }
        if (!pointers.has(event.pointerId)) return
        const pointer = { x: event.clientX, y: event.clientY, pointerType: event.pointerType }
        pointers.set(event.pointerId, pointer)
        if (!experience.started) { ripple(event); return }
        if (pointers.size > 1 && pinch) {
            const [a, b] = [...pointers.values()]
            const length = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
            const range = experience.camera.options.distRange
            experience.camera.distTarget = MathUtils.clamp(pinch.distance * pinch.length / length, range.min, range.max)
        } else if (gesture?.mode === 'orbit') {
            experience.camera.orbitBy((pointer.x - gesture.last.x) * 0.25, (pointer.y - gesture.last.y) * 0.25)
        } else if (gesture?.mode === 'drive') {
            const movement = new Vector2(pointer.x - gesture.start.x, pointer.y - gesture.start.y).clampLength(0, 40)
            experience.props.onJoystickMove(movement)
            const rect = element.getBoundingClientRect()
            onJoystick({ visible: true, x: gesture.start.x - rect.left, y: gesture.start.y - rect.top, dx: movement.x, dy: movement.y })
        }
        if (gesture) gesture.last = pointer
    })
    const release = (event, cancelled = false) => {
        const pointer = pointers.get(event.pointerId)
        const travel = pointer && gesture ? Math.hypot(pointer.x - gesture.start.x, pointer.y - gesture.start.y) : 0
        pointers.delete(event.pointerId)
        if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId)
        experience.props.joyVec.set(0, 0)
        pinch = null
        hideJoystick()
        if (!cancelled && !experience.paused && !experience.started && travel < 6) experience.start()
        if (pointers.size === 1) beginGesture([...pointers.values()][0])
        else gesture = null
    }
    listen(element, 'pointerup', (event) => release(event))
    listen(element, 'pointercancel', (event) => release(event, true))
    listen(element, 'lostpointercapture', (event) => {
        if (pointers.has(event.pointerId)) release(event, true)
    })
    listen(element, 'keydown', (event) => {
        if (event.target.closest('button, a, input, select, textarea')) return
        if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); experience.start() }
        else if (experience.started && !experience.paused && event.keyCode >= 37 && event.keyCode <= 40) experience.props.onKeyDown(event)
    })
    listen(element, 'keyup', (event) => experience.props.onKeyUp(event))
    listen(element, 'focusout', (event) => { if (!element.contains(event.relatedTarget)) clear() })
    listen(window, 'blur', clear)
    listen(element, 'wheel', (event) => {
        if (!experience.started || experience.paused) return
        event.preventDefault()
        const scale = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? 40 : 0.2
        experience.camera.dolly(event.deltaY * scale)
    }, { passive: false })
    if (experience.options.gyroscope !== false) {
        const orient = () => {
            const angle = window.screen.orientation?.angle ?? window.orientation ?? 0
            experience.camera.onDeviceReorientation(-angle)
            experience.camera.defaultEuler.set(Math.PI / 2, Math.PI, (180 + angle) * Math.PI / 180)
        }
        orient()
        listen(window, 'orientationchange', orient)
        if (window.screen.orientation?.addEventListener) listen(window.screen.orientation, 'change', orient)
        listen(window, 'deviceorientation', (event) => {
            if (!experience.active || !window.matchMedia('(pointer:coarse)').matches) return
            if ([event.alpha, event.beta, event.gamma].every(Number.isFinite)) {
                hasGyro = true
                experience.camera.onGyroMove(event.alpha, event.beta, event.gamma)
            }
        })
    }
    listen(element, 'contextmenu', (event) => event.preventDefault())
    return () => { clear(); for (const remove of listeners) remove() }
}
