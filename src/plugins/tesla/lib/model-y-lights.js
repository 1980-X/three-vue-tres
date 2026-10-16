import { BufferGeometry, Float32BufferAttribute, Matrix4, Points, ShaderMaterial, Vector2, Vector3, AdditiveBlending } from 'three'

const lampVertex = /* glsl */`
attribute vec3 vehiclePosition;
varying vec3 lampPosition;
void main() {
    lampPosition = vehiclePosition;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const lampFragment = /* glsl */`
uniform vec3 lights;
uniform vec2 rearZones;
varying vec3 lampPosition;
void main() {
    float signal = lampPosition.x < 0.0 ? lights.y : lights.z;
    vec3 amber = vec3(1.0, 0.24, 0.005);
    vec3 color;
    if (lampPosition.z < 0.0) {
        color = vec3(0.88, 0.94, 1.0);
        if (abs(lampPosition.x) > 0.55 && lampPosition.y > 0.68 && signal > 0.5) color = amber;
    } else {
        bool highStop = lampPosition.y > rearZones.y;
        if (highStop && lights.x < 0.5) discard;
        color = vec3(1.0, 0.008, 0.012) * mix(0.22, 1.0, lights.x);
        if (!highStop && abs(lampPosition.x) > 0.43 && lampPosition.y > rearZones.x && signal > 0.5) color = amber;
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
}`

const flareVertex = /* glsl */`
uniform vec3 lights;
uniform float vpH;
attribute float turnOnly;
attribute vec3 vehiclePosition;
varying vec3 flareColor;
varying float opacity;
void main() {
    float signal = vehiclePosition.x < 0.0 ? lights.y : lights.z;
    vec3 amber = vec3(1.0, 0.24, 0.005);
    #ifdef FRONT_LIGHT
        flareColor = turnOnly > 0.5 ? amber : vec3(0.88, 0.94, 1.0);
        float brightness = turnOnly > 0.5 ? signal : 1.0;
        float size = turnOnly > 0.5 ? 0.32 : 0.65;
    #else
        flareColor = mix(vec3(1.0, 0.008, 0.012), amber, signal);
        float brightness = max(mix(0.08, 1.0, lights.x), signal);
        float size = 0.4;
    #endif
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec3 direction = normalize(cameraPosition - worldPosition.xyz);
    vec3 facing = normalize(mat3(modelMatrix) * normal);
    opacity = smoothstep(0.25, 0.95, dot(direction, facing)) * brightness;
    vec4 viewPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = max(0.0, vpH * size * opacity / -viewPosition.z);
}`

const flareFragment = /* glsl */`
uniform sampler2D sprite;
varying vec3 flareColor;
varying float opacity;
void main() {
    if (opacity < 0.001) discard;
    gl_FragColor = vec4(texture2D(sprite, gl_PointCoord).rgb * flareColor, opacity);
    #include <colorspace_fragment>
}`

// Locate each lamp in the common vehicle frame, including the GLB's own transforms.
function lampPoint(positions, select, front) {
    const selected = []
    let edge = front ? Infinity : -Infinity
    for (let i = 0; i < positions.count; i++) {
        const point = new Vector3().fromBufferAttribute(positions, i)
        if (!select(point)) continue
        selected.push(point)
        edge = front ? Math.min(edge, point.z) : Math.max(edge, point.z)
    }
    const face = selected.filter((point) => Math.abs(point.z - edge) < 0.03)
    if (!face.length) return null
    const center = face.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(face.length)
    center.z = edge + (front ? -0.02 : 0.02)
    return center
}

export function createModelYLights(model, cargo) {
    const lights = { value: new Vector3() } // brake, left indicator, right indicator
    const vpH = { value: 1 }
    const rearZones = { value: new Vector2(cargo.vehicle.rearTurnHeight, cargo.vehicle.highStopHeight) }
    model.updateWorldMatrix(true, true)
    const inverseRoot = new Matrix4().copy(model.matrixWorld).invert()
    const materials = new Map()
    const glowMeshes = []
    let direction = 0
    let blinkTime = 0
    const material = (front, flare = false) => {
        const key = `${front}:${flare}`
        if (!materials.has(key)) materials.set(key, new ShaderMaterial({
            uniforms: { lights, vpH, rearZones, sprite: { value: cargo.flareHead } },
            defines: front ? { FRONT_LIGHT: 1 } : {},
            vertexShader: flare ? flareVertex : lampVertex,
            fragmentShader: flare ? flareFragment : lampFragment,
            toneMapped: false,
            ...(flare
                ? { transparent: true, blending: AdditiveBlending, depthTest: true, depthWrite: false }
                : { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
        }))
        return materials.get(key)
    }
    const glow = (mesh, front, toVehicle) => {
        const positions = mesh.geometry.getAttribute('vehiclePosition')
        const inverse = toVehicle.clone().invert()
        const vertices = [], normals = [], turns = [], vehiclePositions = []
        for (const side of [-1, 1]) {
            for (const turnOnly of front ? [0, 1] : [0]) {
                const point = lampPoint(positions, (p) => side * p.x > (turnOnly ? 0.74 : 0.43)
                    && (front ? p.z < 0 && (turnOnly ? p.y > 0.68 : p.y < 0.65) : p.z > 0 && p.y < cargo.vehicle.highStopHeight), front)
                if (!point) continue
                vehiclePositions.push(...point.toArray())
                point.applyMatrix4(inverse)
                vertices.push(...point.toArray())
                normals.push(...new Vector3(side * 0.25, 0, front ? -1 : 1).transformDirection(inverse).toArray())
                turns.push(turnOnly)
            }
        }
        if (!turns.length) return
        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
        geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
        geometry.setAttribute('turnOnly', new Float32BufferAttribute(turns, 1))
        geometry.setAttribute('vehiclePosition', new Float32BufferAttribute(vehiclePositions, 3))
        const points = new Points(geometry, material(front, true))
        points.renderOrder = 1
        glowMeshes.push([mesh, points])
    }
    // Add glow children after traversal so they cannot be mistaken for model meshes.
    model.traverse((node) => {
        if (!node.isMesh) return
        const sources = Array.isArray(node.material) ? node.material : [node.material]
        const rules = sources.map(source => cargo.vehicle.lights.find(rule => rule.material === source.name
            && rule.nodes.some(name => node.name === name || node.parent?.name === name)))
        if (!rules.some(Boolean)) return
        const toVehicle = inverseRoot.clone().multiply(node.matrixWorld)
        node.geometry = node.geometry.clone()
        node.geometry.setAttribute('vehiclePosition', node.geometry.getAttribute('position').clone().applyMatrix4(toVehicle))
        if (rules.some(rule => rule?.glow)) {
            glow(node, true, toVehicle)
            glow(node, false, toVehicle)
        }
        const adapted = sources.map((source, index) => rules[index] ? material(false) : source)
        node.material = Array.isArray(node.material) ? adapted : adapted[0]
    })
    for (const [parent, points] of glowMeshes) parent.add(points)

    return {
        resize(height) { vpH.value = height },
        update(state) {
            const nextDirection = Math.sign(state.wAngleTarg)
            blinkTime = nextDirection === direction ? blinkTime + state.time.delta : 0
            direction = nextDirection
            const lit = blinkTime % 1 < 0.5
            lights.value.set(state.braking ? 1 : 0, direction > 0 && lit ? 1 : 0, direction < 0 && lit ? 1 : 0)
        },
        reset() { direction = blinkTime = 0; lights.value.set(0, 0, 0) },
    }
}
