import { MathUtils, Vector3 } from 'three'

// The display, wheels and camera all consume the controller's 20 Hz snapshot.
export function readVehicleTelemetry(state) {
    const motion = state?.motion
    const active = state?.status === 'starting' || state?.status === 'running' || state?.status === 'switching'
    const fresh = active && (motion?.quality === 'fresh' || motion?.quality === 'demo')
    const decay = active && motion?.quality === 'stale' ? Math.max(0, 1 - ((motion.ageS ?? 0) - 3.5) / 4.5) : fresh ? 1 : 0
    const speed = Math.max(0, Number(motion?.speedMps) || 0) * decay
    const acceleration = (Number(motion?.accelMps2) || 0) * decay
    const braking = fresh && ((state.engine.brake || 0) > .08 || speed > .28 && acceleration < (motion.quality === 'demo' ? -.35 : -.06))
    const turnRate = fresh && speed >= .8 ? -MathUtils.degToRad(motion.turnRateDegS || 0) : 0
    const steering = fresh && motion.quality === 'demo' ? MathUtils.clamp(Number(motion.steering) || 0, -1, 1) : null
    const turn = steering ?? turnRate
    const phase = speed < .28 ? 'parked' : braking ? 'braking' : turn > 0 ? 'left' : turn < 0 ? 'right' : acceleration > .35 ? 'accelerating' : 'driving'
    return { speed: speed < .28 ? 0 : speed, acceleration, braking, turnRate, steering, phase, fresh }
}

export function updateLiveDriveState(state, telemetry, delta) {
    state.time.delta = delta
    state.speed = telemetry.speed
    state.accel = telemetry.acceleration * delta
    state.braking = telemetry.braking ? 1 : 0
    state.frameDist = state.speed * delta
    const angle = telemetry.steering === null ? Math.atan2(telemetry.turnRate * state.vehicle.WheelBase, Math.max(state.speed, 1.5)) : telemetry.steering * state.vehicle.MaxTurn / (1 + state.speed / 12)
    state.wAngleTarg = MathUtils.clamp(angle, -state.vehicle.MaxTurn, state.vehicle.MaxTurn)
    state.wAngleInner = MathUtils.damp(state.wAngleInner, state.wAngleTarg, 8, delta)
    state.omega = telemetry.steering === null ? telemetry.turnRate : Math.tan(state.wAngleInner) * state.speed / state.vehicle.WheelBase
    state.theta += state.omega * delta
    state.wAngleSign = Math.abs(state.wAngleInner) > .001 ? Math.sign(state.wAngleInner) : 0
    state.wAngleOuter = state.wAngleSign ? Math.atan(state.vehicle.WheelBase / (state.vehicle.WheelBase / Math.tan(state.wAngleInner) + state.vehicle.WheelTrack * state.wAngleSign)) : 0
    state.velocity.set(Math.cos(state.theta) * state.frameDist, -Math.sin(state.theta) * state.frameDist)
    state.pos.add(state.velocity)
    state.longitMomentum = MathUtils.damp(state.longitMomentum, telemetry.acceleration, 6, delta)
    state.lateralMomentum = state.omega * state.speed
}

export function createDisplayCamera(container, camera, vehicle) {
    const pointers = new Map()
    const focus = new Vector3()
    const offset = new Vector3()
    let view = 'exterior'
    let manualUntil = 0
    let pinch = 0
    let cruiseTime = 0
    let cruiseBlend = 0
    const interact = () => { manualUntil = performance.now() + 6000 }
    const down = (event) => {
        if (event.target.closest('button') || event.button > 0) return
        event.preventDefault()
        container.focus({ preventScroll: true })
        container.setPointerCapture(event.pointerId)
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        pinch = 0
        interact()
    }
    const move = (event) => {
        const previous = pointers.get(event.pointerId)
        if (!previous) return
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()]
            const distance = Math.hypot(a.x - b.x, a.y - b.y)
            if (pinch && distance > 0) camera.distTarget *= pinch / distance
            pinch = distance
        } else camera.orbitBy((event.clientX - previous.x) * .25, (event.clientY - previous.y) * .25)
        interact()
    }
    const release = (event) => {
        if (pointers.delete(event.pointerId)) interact()
        if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId)
        pinch = 0
    }
    const clear = () => {
        for (const id of pointers.keys()) if (container.hasPointerCapture(id)) container.releasePointerCapture(id)
        pointers.clear()
        pinch = 0
    }
    const wheel = (event) => {
        event.preventDefault()
        camera.dolly(event.deltaY * (event.deltaMode === 1 ? 20 : .2))
        interact()
    }
    const listeners = [['pointerdown', down], ['pointermove', move], ['pointerup', release], ['pointercancel', release], ['lostpointercapture', release], ['wheel', wheel]]
    for (const [name, listener] of listeners) container.addEventListener(name, listener, { passive: false })
    window.addEventListener('blur', clear)
    return {
        clear,
        setView(next) {
            view = next === 'interior' ? 'interior' : 'exterior'
            manualUntil = 0
            cruiseBlend = 0
            clear()
        },
        update(state, telemetry, delta) {
            if (pointers.size || performance.now() < manualUntil) return
            const phase = telemetry.phase
            const cabin = view === 'interior' ? vehicle.getCabinView() : null
            const brakeBlend = telemetry.braking ? MathUtils.smoothstep(-telemetry.acceleration, .06, 1.2) : 0
            cruiseTime += delta
            const cruising = telemetry.fresh && state.speed > .28 && phase !== 'left' && phase !== 'right'
            cruiseBlend = MathUtils.damp(cruiseBlend, !cabin && cruising ? MathUtils.smoothstep(state.speed, .28, 4) * (1 - brakeBlend) : 0, 1.2, delta)
            let yaw, pitch, distance
            if (cabin) {
                focus.copy(cabin.target)
                offset.subVectors(cabin.position, focus)
                distance = offset.length()
                yaw = MathUtils.radToDeg(Math.atan2(-offset.x, offset.z))
                pitch = MathUtils.radToDeg(Math.asin(offset.y / distance))
            } else {
                focus.set(0, MathUtils.lerp(.95, .8, brakeBlend), 0)
                const angle = phase === 'left' ? 52 : phase === 'right' ? -38 : phase === 'parked' ? 55 : 12
                yaw = 90 - MathUtils.radToDeg(state.theta) + MathUtils.lerp(angle, 42, brakeBlend)
                pitch = MathUtils.lerp(phase === 'accelerating' ? 13 : 16, 9, brakeBlend)
                distance = MathUtils.lerp(phase === 'parked' ? 6.4 : 7.2 + Math.min(state.speed / 25, 1.6), 5.8, brakeBlend)
                // Slow, coordinated arcs reveal both rear quarters without camera roll.
                yaw += Math.sin(cruiseTime * .18) * 24 * cruiseBlend
                pitch += Math.sin(cruiseTime * .11 + .6) * 1.4 * cruiseBlend
                distance += Math.cos(cruiseTime * .11) * .18 * cruiseBlend
            }
            // Unwrap the azimuth so crossing north does not spin the camera around.
            const response = cabin ? 7 : 1.8
            camera.rotTarget.x += (MathUtils.euclideanModulo(yaw - camera.rotTarget.x + 180, 360) - 180) * (1 - Math.exp(-response * delta))
            camera.rotTarget.y = MathUtils.damp(camera.rotTarget.y, pitch, response, delta)
            camera.distTarget = distance * (camera.camera.aspect < 1 ? 1.25 : 1)
            camera.focusTarget.copy(focus)
            camera.distActual = MathUtils.damp(camera.distActual, camera.distTarget, 3, delta)
        },
        dispose() {
            clear()
            for (const [name, listener] of listeners) container.removeEventListener(name, listener)
            window.removeEventListener('blur', clear)
        },
    }
}
