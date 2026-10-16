import { BackSide, BoxGeometry, Color, Mesh, PMREMGenerator, Scene, ShaderMaterial } from 'three'

const vertexShader = /* glsl */`
varying vec3 skyDirection;
void main() {
    skyDirection = position;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clip.xyww;
}`

const fragmentShader = /* glsl */`
uniform samplerCube panorama;
uniform vec3 floorColor;
uniform vec3 mountainColor;
uniform vec3 skyColor;
uniform vec3 neonColor;
varying vec3 skyDirection;
void main() {
    vec3 direction = normalize(skyDirection);
    vec3 source = textureCube(panorama, vec3(-direction.x, direction.yz)).rgb;
    float lightness = dot(source, vec3(0.2126, 0.7152, 0.0722));
    float mountain = smoothstep(0.008, 0.09, lightness);
    float sky = smoothstep(0.06, 0.52, lightness);
    vec3 color = mix(floorColor, mountainColor, mountain);
    color = mix(color, skyColor, sky);
    float horizon = exp(-abs(direction.y - 0.035) * 12.0);
    color += neonColor * horizon * (0.035 + sky * 0.10);
    float scanline = pow(0.5 + 0.5 * cos(direction.y * 260.0), 18.0);
    color += neonColor * scanline * sky * horizon * 0.05;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
}`

// The visible panorama and vehicle reflections share the same crimson palette.
export function createDriveEnvironment(scene, renderer, panorama) {
    const sky = new Mesh(new BoxGeometry(2, 2, 2), new ShaderMaterial({
        uniforms: {
            panorama: { value: panorama },
            floorColor: { value: new Color('#14030b') },
            mountainColor: { value: new Color('#47091e') },
            skyColor: { value: new Color('#8b1237') },
            neonColor: { value: new Color('#ff1e55') },
        },
        vertexShader, fragmentShader, side: BackSide,
        depthWrite: false, depthTest: false, toneMapped: false,
    }))
    sky.frustumCulled = false
    sky.renderOrder = -100
    const captureScene = new Scene()
    captureScene.add(sky)
    const generator = new PMREMGenerator(renderer)
    let environment
    try {
        environment = generator.fromScene(captureScene, 0, 0.1, 100, { size: 128 })
    } catch (error) {
        sky.geometry.dispose()
        sky.material.dispose()
        throw error
    } finally { generator.dispose() }
    scene.add(sky)
    scene.environment = environment.texture
    scene.environmentIntensity = 0.6
    return {
        update(camera) { sky.position.copy(camera.position) },
        dispose() { environment.dispose() },
    }
}
