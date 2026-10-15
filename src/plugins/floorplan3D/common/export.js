import { createModel, disposeModel } from './model'
import { validatePlan } from './plan'

export function download(blob, filename) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportPlan(plan) {
    const snapshot = validatePlan(plan)
    download(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }), `${snapshot.name}.json`)
}

export async function exportGLB(plan) {
    const snapshot = validatePlan(plan)
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js')
    const model = createModel(snapshot)
    try {
        model.updateMatrixWorld(true)
        const data = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true })
        download(new Blob([data], { type: 'model/gltf-binary' }), `${snapshot.name}.glb`)
    } finally {
        disposeModel(model)
    }
}

export async function exportPlanPNG(svg, name) {
    const clone = svg.cloneNode(true)
    clone.querySelectorAll('[data-export-ignore]').forEach((element) => element.remove())
    const bounds = svg.viewBox.baseVal
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', '2200')
    clone.setAttribute('height', String(Math.round(2200 * bounds.height / bounds.width)))
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    try {
        const image = new Image()
        image.src = url
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        canvas.getContext('2d').drawImage(image, 0, 0)
        const result = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (!result) throw new Error('图片导出失败，请重试。')
        download(result, `${name}-平面图.png`)
    } finally {
        URL.revokeObjectURL(url)
    }
}

export async function readPlanFile(file) {
    if (!file || file.size > 2 * 1024 * 1024) throw new Error('请选择小于 2 MB 的户型方案 JSON。')
    let input
    try {
        input = JSON.parse(await file.text())
    } catch {
        throw new Error('JSON 文件无法读取，请检查文件内容。')
    }
    return validatePlan(input)
}
