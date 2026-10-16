import { AdditiveBlending, Color, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'
import { DriveGround } from 'PLS/ff91Drive'

const vertexShader = /* glsl */`
uniform sampler2D heightmap;
uniform float vpH;
uniform vec2 origin;
varying float opacity;
void main() {
    float wave = -texture2D(heightmap, uv).r;
    vec3 point = position;
    point.xz = mod(point.xz - origin + RANGE, RANGE2) - RANGE;
    point.y = wave * 0.5;
    float fade = 1.0 - smoothstep(RANGE * 0.45, RANGE, length(point.xz));
    opacity = clamp(0.38 + abs(wave) * 0.35, 0.0, 0.85) * fade;
    float size = clamp((abs(cameraPosition.y) + 0.5) / 2.5, 0.0, 1.0) * 0.34;
    vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(vpH * size / max(-viewPosition.z, 0.1), 1.0, 96.0);
}`

const fragmentShader = /* glsl */`
uniform sampler2D led;
uniform vec3 color;
varying float opacity;
void main() {
    vec4 mark = texture2D(led, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
    if (mark.a < 0.02) discard;
    gl_FragColor = vec4(color * mark.rgb, mark.a * opacity);
    #include <colorspace_fragment>
}`

export function createTeslaGround(scene, renderer, mark) {
    const ground = new DriveGround(scene, renderer, mark)
    Object.assign(ground.gridMaterial, { vertexShader, fragmentShader, blending: AdditiveBlending, toneMapped: false })
    ground.gridMaterial.needsUpdate = true
    const logo = new Mesh(new PlaneGeometry(3.4, 3.4), new MeshBasicMaterial({
        map: mark, color: 0xff5278, transparent: true,
        blending: AdditiveBlending, depthWrite: false, toneMapped: false,
    }))
    logo.rotation.x = -Math.PI / 2
    logo.position.set(-0.5, 0.025, 0)
    scene.add(logo)
    const floorColor = new Color('#b51b40')
    const introColor = new Color('#ef7195')
    ground.setIntro = (progress) => {
        ground.uniProgress.value = progress
        ground.color.copy(floorColor).lerp(introColor, progress)
        ground.lightGrid.visible = Boolean(mark.image)
        logo.visible = progress > 0.001 && Boolean(mark.image)
        logo.material.opacity = progress
    }
    ground.setIntro(1)
    return ground
}
