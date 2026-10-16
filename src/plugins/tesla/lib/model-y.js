import { Box3, Group, Mesh, MeshBasicMaterial, MultiplyBlending, PlaneGeometry, Quaternion, Vector3 } from 'three'
import { createModelYLights } from './model-y-lights.js'
import { createVehicleScreen } from './vehicle-screen.js'

// Keep the supplied GLB hierarchy and body materials; animate its existing wheel pivots.
export function createModelY(scene, cargo, { dashboard = false } = {}) {
    const model = cargo.model
    model.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model)
    const center = bounds.getCenter(new Vector3())
    const wheels = cargo.vehicle.wheelIds.map((id) => {
        const pivot = model.getObjectByName(`Wheel_${id}_Spatial`)
        const assembly = model.getObjectByName(`Wheel_${id}_Assembly`)
        if (!pivot || !assembly) throw new Error(`${cargo.vehicle.name} 缺少车轮节点：${id}`)
        return {
            id, pivot, assembly, front: id.endsWith('F'), left: id.startsWith('L'),
            orientation: pivot.quaternion.clone(), rotation: assembly.quaternion.clone(),
            position: pivot.getWorldPosition(new Vector3()),
            radius: new Box3().setFromObject(pivot).getSize(new Vector3()).y / 2,
        }
    })
    const spec = {
        WheelBase: Math.abs(wheels[0].position.z - wheels[2].position.z),
        WheelTrack: Math.abs(wheels[0].position.x - wheels[1].position.x),
    }
    model.position.sub(new Vector3(center.x, bounds.min.y, center.z))
    const whole = new Group()
    const chassis = new Group()
    const aligned = new Group()
    aligned.rotation.y = -Math.PI / 2 // GLB faces -Z; the shared driving state faces +X.
    aligned.add(model)
    chassis.add(aligned)
    whole.add(chassis)
    scene.add(whole)

    // White must stay 1 for multiplication; ACES would darken the entire shadow quad.
    const shadow = new Mesh(new PlaneGeometry(6, 6), new MeshBasicMaterial({
        map: cargo.shadow, transparent: true, depthWrite: false,
        blending: MultiplyBlending, premultipliedAlpha: true, toneMapped: false,
    }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.002
    whole.add(shadow)

    const lights = createModelYLights(model, cargo)
    const screen = dashboard ? createVehicleScreen(model, cargo.vehicle) : null
    const turn = new Quaternion()
    const up = new Vector3(0, 1, 0)

    return {
        spec,
        setTelemetry(state, profile) { screen?.update(state, profile) },
        getCabinView() { return screen?.getCabinView() },
        dispose() { screen?.dispose() },
        resize(height) { lights.resize(height) },
        update(state) {
            whole.rotation.y = state.theta
            chassis.rotation.z = state.longitMomentum * 0.0015
            chassis.rotation.x = state.lateralMomentum * 0.002
            for (const wheel of wheels) {
                const inner = wheel.left === (state.wAngleSign > 0)
                const angle = wheel.front ? (inner ? state.wAngleInner : state.wAngleOuter) : 0
                wheel.pivot.quaternion.copy(wheel.orientation).premultiply(turn.setFromAxisAngle(up, angle))
                wheel.assembly.rotateZ((wheel.left ? 1 : -1) * (state.frameDist || 0) / wheel.radius)
            }
            lights.update(state)
        },
        reset() {
            whole.rotation.y = -Math.PI / 2
            chassis.rotation.set(0, 0, 0)
            for (const wheel of wheels) {
                wheel.pivot.quaternion.copy(wheel.orientation)
                wheel.assembly.quaternion.copy(wheel.rotation)
            }
            lights.reset()
        },
    }
}
