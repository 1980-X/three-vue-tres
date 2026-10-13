<!--
 * @Description: 
 * @Version: 1.668
 * @Autor: 地虎降天龙
 * @Date: 2024-12-03 15:24:57
 * @LastEditors: 地虎降天龙
 * @LastEditTime: 2026-01-28 09:54:44
-->
<template>
    <primitive v-bind="$attrs" :object="root" :dispose="null"
        :position="normalizeVec3(props.position)" :rotation="normalizeVec3(props.rotation)"
        :scale="normalizeVec3(props.scale, [1, 1, 1])" :renderOrder="props.renderOrder" />
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { useLoop } from '@tresjs/core'
import * as Photons from '../../common/photons.module.js'
import { watch, onBeforeUnmount } from 'vue'

defineOptions({ inheritAttrs: false })

type Vec3Array = [number, number, number]
type Vec3Object = { x: number; y: number; z: number }
type Vec3 = Vec3Array | Vec3Object

const props = withDefaults(defineProps<{
    position?: Vec3 | number
    rotation?: Vec3 | number
    scale?: Vec3 | number
    renderOrder?: number
    hasPointLight?: boolean
    flickerLightIntensity?: number
    flickerLightIntensityFlux?: number
    flickerLightColor?: string
    lightDistance?: number
    lightDecay?: number
    lightCastShadow?: boolean
}>(), {
    renderOrder: 2000,
    hasPointLight: true,
    flickerLightIntensity: 2,
    flickerLightIntensityFlux: 0.4,
    flickerLightColor: '#f5d26b',
    lightDistance: 0,
    lightDecay: 1,
    lightCastShadow: false,
})

function normalizeVec3(
    value: Vec3 | number | undefined,
    defaultValue: Vec3Array = [0, 0, 0]
): Vec3Array {
    if (typeof value === 'number') {
        return [value, value, value]
    }

    if (!value) return defaultValue
    return Array.isArray(value)
        ? [value[0] ?? defaultValue[0], value[1] ?? defaultValue[1], value[2] ?? defaultValue[2]]
        : [value.x ?? defaultValue[0], value.y ?? defaultValue[1], value.z ?? defaultValue[2]]
}
const root = new THREE.Group()
const textures = new Set<THREE.Texture>()
const textureLoader = new THREE.TextureLoader()
const loadTexture = (path: string) => {
    const texture = textureLoader.load(path)
    textures.add(texture)
    return texture
}
const setupEmbers = () => {
    const embersRoot = new THREE.Object3D()
    const scale = 1

    const texturePath = './plugins/digitalCity/image/fireF/ember.png'
    const embersTexture = loadTexture(texturePath)
    const embersAtlas = new Photons.Atlas(embersTexture, texturePath)
    embersAtlas.addFrameSet(1, 0.0, 0.0, 1.0, 1.0)
    const embersRenderer = new Photons.AnimatedSpriteRenderer(true, embersAtlas, true, 1)

    const embersParticleSystem = new Photons.ParticleSystem(embersRoot, embersRenderer)
    embersParticleSystem.init(150)

    embersParticleSystem.setEmitter(new Photons.ConstantParticleEmitter(6))

    const sizeInitializerGenerator = new Photons.RandomGenerator(
        THREE.Vector2,
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(scale * 0.15, scale * 0.15),
        0.0,
        0.0,
        false,
    )
    embersParticleSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(3.0, 1.0, 0.0, 0.0, false))
    embersParticleSystem.addParticleStateInitializer(new Photons.SizeInitializer(sizeInitializerGenerator))
    embersParticleSystem.addParticleStateInitializer(
        new Photons.BoxPositionInitializer(new THREE.Vector3(0.05 * scale, 0.0, 0.05 * scale), new THREE.Vector3(-0.025 * scale, 0.0, -0.025 * scale)),
    )
    embersParticleSystem.addParticleStateInitializer(
        new Photons.RandomVelocityInitializer(
            new THREE.Vector3(0.4 * scale, 0.5 * scale, 0.4 * scale),
            new THREE.Vector3(-0.2 * scale, 0.8 * scale, -0.2 * scale),
            0.6 * scale,
            0.8 * scale,
            false,
        ),
    )

    const embersOpacityOperator = embersParticleSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator())
    embersOpacityOperator.addElements([
        [0.0, 0.0],
        [0.7, 0.25],
        [0.9, 0.75],
        [0.0, 1.0],
    ])

    const embersColorOperator = embersParticleSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true))
    embersColorOperator.addElementsFromParameters([
        [[1.0, 0.7, 0.0], 0.0],
        [[1.0, 0.6, 0.0], 0.5],
        [[1.0, 0.4, 0.0], 1.0],
    ])

    const acceleratorOperatorGenerator = new Photons.SphereRandomGenerator(
        Math.PI * 2.0,
        0.0,
        Math.PI,
        -Math.PI / 2,
        20.0,
        -8,
        scale,
        scale,
        scale,
        0.0,
        0.0,
        0.0,
    )

    embersParticleSystem.addParticleStateOperator(new Photons.AccelerationOperator(acceleratorOperatorGenerator))

    embersParticleSystem.setSimulateInWorldSpace(false)
    embersParticleSystem.start()

    return embersParticleSystem
}
const setupBaseFlame = () => {
    const baseFlameRoot = new THREE.Object3D()
    const scale = 1

    const texturePath = './plugins/digitalCity/image/fireF/base_flame.png'
    const baseFlameTexture = loadTexture(texturePath)
    const baseFlameAtlas = new Photons.Atlas(baseFlameTexture, texturePath)
    baseFlameAtlas.addFrameSet(18, 0.0, 0.0, 128.0 / 1024.0, 128.0 / 512.0)
    const baseFlameRenderer = new Photons.AnimatedSpriteRenderer(true, baseFlameAtlas, true)

    const baseFlameParticleSystem = new Photons.ParticleSystem(baseFlameRoot, baseFlameRenderer)
    baseFlameParticleSystem.init(50)

    baseFlameParticleSystem.setEmitter(new Photons.ConstantParticleEmitter(10))

    baseFlameParticleSystem.addParticleSequence(0, 18)
    const baseFlameParticleSequences = baseFlameParticleSystem.getParticleSequences()

    baseFlameParticleSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.0, 0.0, 0.0, 0.0, false))
    baseFlameParticleSystem.addParticleStateInitializer(
        new Photons.RotationInitializer(new Photons.RandomGenerator(0, Math.PI / 2.0, -Math.PI / 2.0, 0.0, 0.0, false)),
    )
    baseFlameParticleSystem.addParticleStateInitializer(new Photons.RotationalSpeedInitializer(1.0, -1.0, 0.0, 0.0, false))
    baseFlameParticleSystem.addParticleStateInitializer(
        new Photons.SizeInitializer(
            new Photons.RandomGenerator(
                THREE.Vector2,
                new THREE.Vector2(0.25 * scale, 0.25 * scale),
                new THREE.Vector2(0.5 * scale, 0.5 * scale),
                0.0,
                0.0,
                false,
            ),
        ),
    )

    baseFlameParticleSystem.addParticleStateInitializer(
        new Photons.BoxPositionInitializer(new THREE.Vector3(0.05 * scale, 0.0, 0.05 * scale), new THREE.Vector3(-0.025 * scale, 0.0, -0.025 * scale)),
    )
    baseFlameParticleSystem.addParticleStateInitializer(
        new Photons.RandomVelocityInitializer(
            new THREE.Vector3(0.05 * scale, 0.4 * scale, 0.05 * scale),
            new THREE.Vector3(-0.025 * scale, 0.8 * scale, -0.025 * scale),
            0.35 * scale,
            0.5 * scale,
            false,
        ),
    )
    baseFlameParticleSystem.addParticleStateInitializer(new Photons.SequenceInitializer(baseFlameParticleSequences))

    baseFlameParticleSystem.addParticleStateOperator(new Photons.SequenceOperator(baseFlameParticleSequences, 0.07, false))

    const baseFlameOpacityOperator = baseFlameParticleSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator())
    baseFlameOpacityOperator.addElements([
        [0.0, 0.0],
        [0.3, 0.25],
        [0.3, 0.5],
        [0.0, 1.0],
    ])

    const baseFlameSizeOperator = baseFlameParticleSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true))
    baseFlameSizeOperator.addElementsFromParameters([
        [[0.6, 0.6], 0.0],
        [[1.0, 1.0], 0.4],
        [[1.0, 1.0], 1.0],
    ])

    const baseFlameColorOperator = baseFlameParticleSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true))
    baseFlameColorOperator.addElementsFromParameters([
        [[1.0, 1.0, 1.0], 0.0],
        [[1.5, 1.5, 1.5], 0.5],
        [[1.0, 1.0, 1.0], 1.0],
    ])

    baseFlameParticleSystem.addParticleStateOperator(
        new Photons.AccelerationOperator(
            new Photons.RandomGenerator(THREE.Vector3, new THREE.Vector3(0.0, 0.0, 0.0), new THREE.Vector3(0.0, 1.5 * scale, 0.0), 0.0, 0.0, false),
        ),
    )

    baseFlameParticleSystem.setSimulateInWorldSpace(false)
    baseFlameParticleSystem.start()

    return baseFlameParticleSystem
}
const setupBrightFLame = () => {
    const brightFlameRoot = new THREE.Object3D()
    const scale = 1

    const texturePath = './plugins/digitalCity/image/fireF/bright_flame.png'
    const brightFlameTexture = loadTexture(texturePath)
    const brightFlameAtlas = new Photons.Atlas(brightFlameTexture, texturePath)
    brightFlameAtlas.addFrameSet(16, 0.0, 0.0, 212.0 / 1024.0, 256.0 / 1024.0)
    const brightFlameRenderer = new Photons.AnimatedSpriteRenderer(true, brightFlameAtlas, true)

    const brightFlameParticleSystem = new Photons.ParticleSystem(brightFlameRoot, brightFlameRenderer)
    brightFlameParticleSystem.init(20)

    brightFlameParticleSystem.setEmitter(new Photons.ConstantParticleEmitter(5))

    brightFlameParticleSystem.addParticleSequence(0, 16)
    const brightFlameParticleSequences = brightFlameParticleSystem.getParticleSequences()

    brightFlameParticleSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.0, 0.0, 0.0, 0.0, false))
    brightFlameParticleSystem.addParticleStateInitializer(
        new Photons.RotationInitializer(new Photons.RandomGenerator(0, Math.PI, -Math.PI / 2.0, 0.0, 0.0, false)),
    )
    brightFlameParticleSystem.addParticleStateInitializer(new Photons.RotationalSpeedInitializer(Math.PI / 2.0, -Math.PI / 4.0, 0.0, 0.0, false))
    brightFlameParticleSystem.addParticleStateInitializer(
        new Photons.SizeInitializer(
            new Photons.RandomGenerator(THREE.Vector2, new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.0, 0.0), 0.2 * scale, 0.65 * scale, false),
        ),
    )
    brightFlameParticleSystem.addParticleStateInitializer(
        new Photons.BoxPositionInitializer(new THREE.Vector3(0.1 * scale, 0.0, 0.1 * scale), new THREE.Vector3(-0.05 * scale, 0.0, -0.05 * scale)),
    )
    brightFlameParticleSystem.addParticleStateInitializer(
        new Photons.RandomVelocityInitializer(
            new THREE.Vector3(0.02 * scale, 0.4 * scale, 0.02 * scale),
            new THREE.Vector3(-0.01 * scale, 0.4 * scale, -0.01 * scale),
            0.1 * scale,
            0.2 * scale,
            false,
        ),
    )
    brightFlameParticleSystem.addParticleStateInitializer(new Photons.SequenceInitializer(brightFlameParticleSequences))

    brightFlameParticleSystem.addParticleStateOperator(new Photons.SequenceOperator(brightFlameParticleSequences, 0.1, false))

    const brightFlameOpacityOperator = brightFlameParticleSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator())
    brightFlameOpacityOperator.addElements([
        [0.0, 0.0],
        [0.6, 0.2],
        [0.5, 0.75],
        [0.0, 1.0],
    ])

    const brightFlameSizeOperator = brightFlameParticleSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true))
    brightFlameSizeOperator.addElementsFromParameters([
        [[0.3, 0.3], 0.0],
        [[1.0, 1.0], 0.4],
        [[1.0, 1.0], 0.55],
        [[0.65, 0.65], 0.75],
        [[0.1, 0.1], 1.0],
    ])

    const brightFlameColorOperator = brightFlameParticleSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true))
    brightFlameColorOperator.addElementsFromParameters([
        [[1.0, 1.0, 1.0], 0.0],
        [[2.0, 2.0, 2.0], 0.3],
        [[2.0, 2.0, 2.0], 0.4],
        [[0.9, 0.6, 0.3], 0.65],
        [[0.75, 0.0, 0.0], 1.0],
    ])

    brightFlameParticleSystem.addParticleStateOperator(
        new Photons.AccelerationOperator(
            new Photons.RandomGenerator(THREE.Vector3, new THREE.Vector3(0.0, 0.0, 0.0), new THREE.Vector3(0.0, 1.5 * scale, 0.0), 0.0, 0.0, false),
        ),
    )

    brightFlameParticleSystem.setSimulateInWorldSpace(false)

    brightFlameParticleSystem.start()
    return brightFlameParticleSystem
}
const particleSystems = [setupEmbers(), setupBaseFlame(), setupBrightFLame()]
particleSystems.forEach((system, index) => {
    root.add(system.owner)
    // 保持原先余烬、底焰、亮焰的合成顺序，避免动态包围球引起透明层排序跳变。
    system.particleSystemRenderer.mesh.renderOrder = index
    // 粒子位置由着色器计算，普通 Mesh.raycast 无法命中真实火焰。
    system.particleSystemRenderer.mesh.raycast = () => {}
})

const isVisible = () => {
    let object: THREE.Object3D | null = root
    while (object) {
        if (!object.visible) return false
        object = object.parent
    }
    return true
}
const bounds = new THREE.Box3()
const worldScale = new THREE.Vector3()
const particleCenter = new THREE.Vector3()
const hitPoint = new THREE.Vector3()
root.raycast = (raycaster, intersects) => {
    if (!isVisible()) return
    root.updateWorldMatrix(true, false)
    worldScale.setFromMatrixScale(root.matrixWorld)
    bounds.makeEmpty()
    // 贴片始终朝向相机，按世界坐标包围，避免旋转或非等比缩放后漏选。
    particleSystems.forEach((system) => {
        for (let i = 0; i < system.activeParticleCount; i++) {
            const state = system.particleStates.getState(i)
            particleCenter.copy(state.position).applyMatrix4(root.matrixWorld)
            const radius = Math.hypot(state.size.x * worldScale.x, state.size.y * worldScale.y)
            bounds.expandByPoint(hitPoint.copy(particleCenter).addScalar(-radius))
            bounds.expandByPoint(hitPoint.copy(particleCenter).addScalar(radius))
        }
    })
    if (bounds.isEmpty() || !raycaster.ray.intersectBox(bounds, hitPoint)) return
    const distance = raycaster.ray.origin.distanceTo(hitPoint)
    if (distance >= raycaster.near && distance <= raycaster.far) {
        intersects.push({ distance, point: hitPoint.clone(), object: root })
    }
}

let flickerLight: Photons.FlickerLight | null = null
const clearLight = () => {
    if (!flickerLight) return
    flickerLight.light.dispose()
    flickerLight.dispose()
    flickerLight = null
}
watch(
    () => [props.hasPointLight, props.flickerLightIntensity, props.flickerLightIntensityFlux,
        props.flickerLightColor, props.lightDistance, props.lightDecay, props.lightCastShadow],
    () => {
        if (!props.hasPointLight) {
            clearLight()
            return
        }
        if (!flickerLight) {
            flickerLight = new Photons.FlickerLight(root, props.flickerLightIntensity,
                props.flickerLightIntensityFlux, new THREE.Color(props.flickerLightColor), props.lightDistance, props.lightDecay)
            const shadow = flickerLight.light.shadow
            shadow.mapSize.set(1024, 1024)
            shadow.camera.near = 0.1
            shadow.camera.far = 5000
            shadow.bias = 0.000009
            shadow.radius = 3
        }
        flickerLight.intensity = props.flickerLightIntensity
        flickerLight.intensityFlux = props.flickerLightIntensityFlux
        flickerLight.light.color.set(props.flickerLightColor)
        flickerLight.light.distance = props.lightDistance
        flickerLight.light.decay = props.lightDecay
        flickerLight.light.castShadow = props.lightCastShadow
    },
    { immediate: true },
)

let lastUpdateTime = performance.now() / 1000
let disposed = false
// 保留旧的手动更新入口；绘制统一由场景完成，不再额外调用 renderer.render。
const curRender = () => {
    if (disposed) return
    const currentTime = performance.now() / 1000
    const delta = Math.min(currentTime - lastUpdateTime, 0.1)
    lastUpdateTime = currentTime
    if (!isVisible()) return
    particleSystems.forEach((system) => {
        system.update(currentTime, delta)
        system.owner.visible = system.activeParticleCount > 0
    })
    flickerLight?.update(currentTime)
}
const { onBeforeRender } = useLoop()
const { off } = onBeforeRender(curRender)
onBeforeUnmount(() => {
    disposed = true
    off()
    root.removeFromParent()
    clearLight()
    particleSystems.forEach((system) => {
        system.pause()
        system.particleSystemRenderer.dispose()
        system.particleSystemRenderer.material.dispose()
    })
    textures.forEach((texture) => texture.dispose())
    textures.clear()
    root.clear()
})
defineExpose({ root, curRender })

</script>
