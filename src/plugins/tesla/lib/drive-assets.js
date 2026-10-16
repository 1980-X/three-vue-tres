import { CubeTextureLoader, SRGBColorSpace, TextureLoader } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export function resolvePluginBase(name) {
    const publicPath = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ || import.meta.env.BASE_URL || './'
    return new URL(`plugins/${name}/`, new URL(publicPath, document.baseURI)).href
}

function collectResources(object, resources) {
    object?.traverse((node) => {
        if (node.geometry) resources.add(node.geometry)
        for (const material of [node.material].flat().filter(Boolean)) {
            resources.add(material)
            for (const value of Object.values(material)) if (value?.isTexture) resources.add(value)
        }
    })
}

export function loadDriveAssets(onProgress = () => {}) {
    const sharedBase = resolvePluginBase('ff91Drive')
    const resources = new Set()
    const controller = new AbortController()
    const cargo = {}
    let disposed = false
    let completed = 0
    const abort = () => new DOMException('Model Y loading cancelled', 'AbortError')
    const progress = () => { if (!disposed) onProgress(++completed / 5) }
    const texture = (name, cube = false, source) => new Promise((resolve, reject) => {
        const loader = cube ? new CubeTextureLoader() : new TextureLoader()
        const url = source || (cube
            ? ['xp', 'xn', 'yp', 'yn', 'zp', 'zn'].map((face) => `${sharedBase}textures/${name}/${face}.jpg`)
            : `${sharedBase}textures/${name}.jpg`)
        cargo[name] = loader.load(url, (loaded) => {
            if (disposed) { loaded.dispose(); reject(abort()); return }
            progress()
            resolve(loaded)
        }, undefined, () => reject(new Error(`无法加载场景贴图：${name}`)))
        if (cube) cargo[name].colorSpace = SRGBColorSpace
        resources.add(cargo[name])
    })
    const textures = [
        texture('envSkybox', true), texture('shadow'), texture('flareHead'),
        texture('teslaMark', false, `${resolvePluginBase('tesla')}textures/tesla-mark.svg`),
    ]
    const modelUrl = `${resolvePluginBase('tesla')}models/modely-2025-performance.glb`
    const model = fetch(modelUrl, { signal: controller.signal })
        .then((response) => {
            if (!response.ok) throw new Error(`无法加载 Model Y 模型（${response.status}）`)
            return response.arrayBuffer()
        })
        .then((buffer) => {
            if (disposed) throw abort()
            return new GLTFLoader().parseAsync(buffer, new URL('.', modelUrl).href)
        })
        .then(({ scene }) => {
            if (disposed) {
                const pending = new Set()
                collectResources(scene, pending)
                for (const resource of pending) resource.dispose()
                throw abort()
            }
            cargo.model = scene
            collectResources(scene, resources)
            progress()
        })

    return {
        cargo,
        ready: Promise.all([...textures, model]).then(() => {
            if (disposed) throw abort()
            return cargo
        }),
        dispose(scene) {
            if (disposed) return
            disposed = true
            controller.abort()
            collectResources(scene, resources)
            for (const resource of resources) resource.dispose()
            resources.clear()
        },
    }
}
