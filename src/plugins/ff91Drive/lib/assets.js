import { CubeTextureLoader, TextureLoader, ObjectLoader, NoColorSpace } from 'three'

export function resolveAssetBase(value) {
    const publicPath = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ || import.meta.env?.BASE_URL || './'
    const base = value || new URL('plugins/ff91Drive/', new URL(publicPath, document.baseURI)).href
    return new URL(base.endsWith('/') ? base : `${base}/`, document.baseURI).href
}

function collectObject(object, resources) {
    object?.traverse?.((node) => {
        if (node.geometry) resources.add(node.geometry)
        for (const material of [node.material].flat().filter(Boolean)) {
            resources.add(material)
            for (const value of Object.values(material)) if (value?.isTexture) resources.add(value)
            for (const uniform of Object.values(material.uniforms || {})) {
                if (uniform.value?.isTexture) resources.add(uniform.value)
            }
        }
    })
}

/** Per-instance assets. Pending image callbacks also respect disposal. */
export function loadAssets(base, onProgress = () => {}) {
    const resources = new Set()
    const cargo = {}
    const controller = new AbortController()
    const pending = []
    let disposed = false
    let completed = 0
    const total = 11
    const abort = () => new DOMException('FF 91 loading cancelled', 'AbortError')
    const progress = () => { if (!disposed) onProgress(++completed / total) }

    const texture = (name, cube = false) => {
        const loader = cube ? new CubeTextureLoader() : new TextureLoader()
        const url = cube
            ? ['xp', 'xn', 'yp', 'yn', 'zp', 'zn'].map((face) => `${base}textures/${name}/${face}.jpg`)
            : `${base}textures/${name}.${name === 'ledA' ? 'png' : 'jpg'}`
        pending.push(new Promise((resolve, reject) => {
            cargo[name] = loader.load(url, (loaded) => {
                if (disposed) { loaded.dispose(); reject(abort()); return }
                progress()
                resolve(loaded)
            }, undefined, () => reject(new Error(`Unable to load FF 91 texture: ${name}`)))
            cargo[name].colorSpace = NoColorSpace
            resources.add(cargo[name])
        }))
    }
    texture('envReflection', true)
    texture('envSkybox', true)
    for (const name of ['flareHead', 'flareTurn', 'lightTurn', 'lightStop', 'thread', 'shadow', 'ledA']) texture(name)
    for (const name of ['vrBodyCompiled', 'vrWheelBrakes']) {
        pending.push(fetch(`${base}meshes/${name}.json`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error(`Unable to load FF 91 model: ${name} (${response.status})`)
                return response.json()
            })
            .then((json) => {
                if (disposed) throw abort()
                cargo[name] = new ObjectLoader().parse(json)
                collectObject(cargo[name], resources)
                progress()
            }))
    }

    return {
        cargo,
        ready: Promise.all(pending).then(() => { if (disposed) throw abort(); return cargo }),
        dispose(scene) {
            if (disposed) return
            disposed = true
            controller.abort()
            collectObject(scene, resources)
            if (scene?.background?.isTexture) resources.add(scene.background)
            if (scene?.environment?.isTexture) resources.add(scene.environment)
            for (const resource of resources) resource.dispose()
            resources.clear()
            for (const key of Object.keys(cargo)) delete cargo[key]
        },
    }
}
