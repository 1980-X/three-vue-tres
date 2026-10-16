import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, Vector3, AdditiveBlending } from 'three'

const lampVertex = /* glsl */`
varying vec3 lampPosition;
void main() {
    lampPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const lampFragment = /* glsl */`
uniform vec3 lights;
varying vec3 lampPosition;
void main() {
    float signal = lampPosition.x < 0.0 ? lights.y : lights.z;
    vec3 amber = vec3(1.0, 0.24, 0.005);
    #ifdef FRONT_LIGHT
        vec3 color = vec3(0.88, 0.94, 1.0);
        if (abs(lampPosition.x) > 0.55 && lampPosition.y > 0.68 && signal > 0.5) color = amber;
    #else
        bool highStop = lampPosition.y > 1.3;
        if (highStop && lights.x < 0.5) discard;
        vec3 color = vec3(1.0, 0.008, 0.012) * mix(0.22, 1.0, lights.x);
        if (!highStop && abs(lampPosition.x) > 0.43 && lampPosition.y > 1.04 && signal > 0.5) color = amber;
    #endif
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
}`

const flareVertex = /* glsl */`
uniform vec3 lights;
uniform float vpH;
attribute float turnOnly;
varying vec3 flareColor;
varying float opacity;
void main() {
    float signal = position.x < 0.0 ? lights.y : lights.z;
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

// Locate the exposed edge of each lamp in its existing geometry, in GLB coordinates.
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
    const materials = new Map()
    const glowMeshes = []
    let direction = 0
    let blinkTime = 0
    const material = (front, flare = false) => {
        const key = `${front}:${flare}`
        if (!materials.has(key)) materials.set(key, new ShaderMaterial({
            uniforms: { lights, vpH, sprite: { value: cargo.flareHead } },
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
    const glow = (mesh, front) => {
        const positions = mesh.geometry.getAttribute('position')
        const vertices = [], normals = [], turns = []
        for (const side of [-1, 1]) {
            for (const turnOnly of front ? [0, 1] : [0]) {
                const point = lampPoint(positions, (p) => side * p.x > (turnOnly ? 0.74 : 0.43)
                    && (front ? (turnOnly ? p.y > 0.68 : p.y < 0.65) : p.y < 1.2), front)
                if (!point) continue
                vertices.push(...point.toArray())
                normals.push(side * 0.25, 0, front ? -1 : 1)
                turns.push(turnOnly)
            }
        }
        if (!turns.length) return
        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
        geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
        geometry.setAttribute('turnOnly', new Float32BufferAttribute(turns, 1))
        const points = new Points(geometry, material(front, true))
        points.renderOrder = 1
        glowMeshes.push([mesh, points])
    }
    // Add glow children after traversal so they cannot be mistaken for model meshes.
    model.traverse((node) => {
        if (!node.isMesh) return
        const adapt = (source) => {
            const front = source.name === 'Glass_Lights' && node.parent?.name === 'Static_Exterior'
            if (!front && source.name !== 'Light_Off') return source
            if (front || node.parent?.name === 'Brake_Lights_Off') glow(node, front)
            return material(front)
        }
        node.material = Array.isArray(node.material) ? node.material.map(adapt) : adapt(node.material)
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
