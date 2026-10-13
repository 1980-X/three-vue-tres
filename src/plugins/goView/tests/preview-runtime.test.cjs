// 独立运行：node --test src/plugins/goView/tests/preview-runtime.test.cjs
// 使用真实 Vue/Pinia 生命周期和 Axios 拦截器；网络、轮询时钟及 VChart 绘图引擎替换为可控对象。
const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')
const { parse, compileScript } = require('@vue/compiler-sfc')
const { createRenderer, h, reactive, nextTick, onMounted, onBeforeUnmount } = require('vue')
const { createPinia, getActivePinia } = require('pinia')
require('naive-ui')
global.window = {
    localStorage: { getItem: () => null, setItem() {} }, $message: { error() {} },
    innerWidth: 1200, innerHeight: 800, addEventListener() {}, removeEventListener() {},
}
const root = path.resolve(__dirname, '../../../..')
let api, intervals, requests
const originalInterval = global.setInterval
const originalClear = global.clearInterval
const mounted = new Set()

const node = (type, text = '') => ({
    type, text, children: [], props: {}, style: {}, parent: null, isConnected: true,
    closest() { return this }, addEventListener() {}, removeEventListener() {},
})
const renderer = createRenderer({
    createElement: node, createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) {
        if (child.parent) this.remove(child)
        child.parent = parent
        const index = parent.children.indexOf(anchor)
        parent.children.splice(index < 0 ? parent.children.length : index, 0, child)
    },
    remove(child) {
        const index = child.parent?.children.indexOf(child) ?? -1
        if (index >= 0) child.parent.children.splice(index, 1)
        child.parent = null
    },
    setText: (el, text) => { el.text = text },
    setElementText: (el, text) => { el.text = text; el.children = [] },
    patchProp: (el, key, _old, value) => { el.props[key] = value },
    parentNode: el => el.parent,
    nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1],
})
const flush = async () => { await nextTick(); await new Promise(setImmediate); await nextTick() }
const response = (config, data = [requests.length]) => ({ config, data: { data }, status: 200, statusText: 'OK', headers: {} })
const config = () => ({ editCanvasConfig: { width: 800, height: 600 }, componentList: [] })
const component = (id = 'chart') => Object.assign(new api.PublicConfigClass(), {
    id, chartConfig: { key: 'Text', chartKey: 'VText', chartFrame: 'common' }, option: {},
})
const ajax = (id = 'chart') => {
    const chart = component(id)
    Object.assign(chart.request, { requestDataType: 1, requestUrl: '/data', requestInterval: 1 })
    return chart
}
function mount(setup, data = config(), render, components = {}) {
    let store, value
    const Child = { setup() { value = setup(api.useChartEditStore()); return render || (() => h('div')) } }
    const app = renderer.createApp({ setup() {
        store = api.provideChartEditStore()
        api.getSessionStorageInfo(data, store)
        return () => h(Child)
    } })
    const container = node('root')
    const hostPinia = createPinia()
    app.use(hostPinia)
    for (const [name, definition] of Object.entries(components)) app.component(name, definition)
    app.component('VTestChart', { props: ['chartConfig'], setup(props) {
        api.useChartDataFetch(props.chartConfig, api.useChartEditStore)
        return () => h('span', props.chartConfig.id)
    } })
    app.mount(container)
    const result = { store, value, container, hostPinia, unmount() { app.unmount(); mounted.delete(result) } }
    mounted.add(result)
    return result
}

beforeEach(async () => {
    if (!api) {
        const bundle = await esbuild.build({
            stdin: { contents: `
                export * from './src/plugins/goView/stores/chartEditStore';
                export * from './src/plugins/goView/lib/utils/storage';
                export * from './src/plugins/goView/lib/gHooks/useChartDataFetch.hook';
                export * from './src/plugins/goView/lib/gHooks/useChartDataPondFetch.hook';
                export * from './src/plugins/goView/lib/gHooks/useChartInteract.hook';
                export * from './src/plugins/goView/lib/gHooks/useLifeHandler.hook';
                export * from './src/plugins/goView/lib/gApi/http';
                export { default as axios } from './src/plugins/goView/lib/gApi/axios';
                export { PublicConfigClass } from './src/plugins/goView/lib/packages/public/publicConfig';
                export { default as Capsule } from './src/plugins/goView/lib/packages/components/Charts/Bars/CapsuleChart/index.vue';
                export { default as CapsuleConfig } from './src/plugins/goView/lib/packages/components/Charts/Bars/CapsuleChart/config';
                export { default as GoVChart } from './src/plugins/goView/lib/gComponents/GoVChart/index.vue';
                export { default as GoView } from './src/plugins/goView/components/goViewCom.vue';
                export { default as LegacyView } from './src/plugins/goView/components/viewChart.vue';
                export { default as InputsSelect } from './src/plugins/goView/lib/packages/components/Informations/Inputs/InputsSelect/index.vue';
                export { default as SelectConfig } from './src/plugins/goView/lib/packages/components/Informations/Inputs/InputsSelect/config';
                export { default as InputsPagination } from './src/plugins/goView/lib/packages/components/Informations/Inputs/InputsPagination/index.vue';
                export { default as PaginationConfig } from './src/plugins/goView/lib/packages/components/Informations/Inputs/InputsPagination/config';
            `, resolveDir: root, loader: 'ts' },
            bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
            alias: { PLS: path.join(root, 'src/plugins') }, define: { 'import.meta.env': '{}' },
            plugins: [{ name: 'vue-and-chart-double', setup(build) {
                // Color 5 使用 ESM；打包这一小段依赖，保持与浏览器中的默认导入行为一致。
                build.onResolve({ filter: /^color(?:-string|-convert|-name)?$/ }, args => ({ path: require.resolve(args.path), external: false }))
                build.onResolve({ filter: /^@visactor\/vchart$/ }, () => ({ path: 'vchart', namespace: 'double' }))
                build.onLoad({ filter: /.*/, namespace: 'double' }, () => ({ contents: `
                    export class VChart {
                        constructor(spec, options) { this.spec = spec; this.options = options; this.events = {}; this.released = 0; global.__charts.push(this) }
                        on(name, callback) { this.events[name] = callback }
                        renderSync() {}
                        updateSpec(spec) { this.spec = spec }
                        release() { this.released++; this.events = {} }
                    }
                    VChart.useRegisters = () => {};
                    VChart.ThemeManager = { themeExist: () => true, setCurrentTheme() {} };
                ` }))
                build.onResolve({ filter: /useComInstall.hook$/ }, () => ({ path: 'install', namespace: 'install-double' }))
                build.onLoad({ filter: /.*/, namespace: 'install-double' }, () => ({ resolveDir: root, contents: "import { ref } from 'vue'; export const useComInstall = () => ({ show: ref(true) })" }))
                build.onResolve({ filter: /^\.\/register$/ }, args => args.importer.replace(/\\/g, '/').endsWith('GoVChart/index.vue')
                    ? { path: 'register', namespace: 'register-double' } : undefined)
                build.onLoad({ filter: /.*/, namespace: 'register-double' }, () => ({ contents: 'export const registerChartsAndComponents = () => {}' }))
                build.onLoad({ filter: /\.vue$/ }, args => {
                    const { descriptor } = parse(fs.readFileSync(args.path, 'utf8'), { filename: args.path })
                    return { contents: compileScript(descriptor, { id: args.path, inlineTemplate: true }).content, loader: 'ts' }
                })
            } }],
        })
        const loaded = new Module(path.join(root, 'goview-regression.cjs'), module)
        loaded.filename = path.join(root, 'goview-regression.cjs')
        loaded.paths = Module._nodeModulePaths(root)
        loaded._compile(bundle.outputFiles[0].text, loaded.filename)
        api = loaded.exports
    }
    intervals = new Map()
    requests = []
    global.__charts = []
    global.setInterval = (fn, delay) => { const id = Symbol(); intervals.set(id, { fn, delay }); return id }
    global.clearInterval = id => intervals.delete(id)
    api.axios.defaults.adapter = async request => { requests.push(request); return response(request) }
})
afterEach(() => {
    for (const instance of mounted) instance.unmount()
    global.setInterval = originalInterval
    global.clearInterval = originalClear
    delete global.__charts
})

test('所有仓库内旧配置可加载，默认值补全且不修改原 JSON', () => {
    const instance = mount(() => {})
    const files = fs.readdirSync(path.join(root, 'src/plugins'), { recursive: true }).filter(file => file.endsWith('.json'))
    let count = 0
    for (const file of files) {
        let data
        try { data = JSON.parse(fs.readFileSync(path.join(root, 'src/plugins', file), 'utf8')) } catch { continue }
        if (!data.editCanvasConfig || !Array.isArray(data.componentList)) continue
        const original = JSON.stringify(data)
        api.getSessionStorageInfo(data, instance.store)
        assert.equal(instance.store.componentList.length, data.componentList.length, file)
        assert.ok(instance.store.editCanvasConfig.vChartThemeName, file)
        assert.equal(JSON.stringify(data), original, file)
        const check = (loaded, saved) => saved.forEach((item, index) => {
            assert.equal(loaded[index].id, item.id, file)
            assert.equal(loaded[index].chartConfig.key, item.chartConfig.key, file)
            assert.ok(loaded[index].status && loaded[index].styles && loaded[index].request, file)
            if (item.isGroup) check(loaded[index].groupList, item.groupList)
        })
        check(instance.store.componentList, data.componentList)
        count++
    }
    assert.ok(count >= 17, `配置数量异常：${count}`)
    assert.throws(() => api.getSessionStorageInfo({}, instance.store), /editCanvasConfig/)
})

test('两个预览实例状态隔离，重新加载配置清除上一次状态', () => {
    const first = mount(store => store)
    const second = mount(store => store)
    assert.equal(first.value, first.store)
    assert.notEqual(first.store, second.store)
    first.store.editCanvasConfig.width = 123
    first.store.requestGlobalConfig.requestParams.Header.token = 'old'
    assert.equal(second.store.editCanvasConfig.width, 800)
    api.getSessionStorageInfo(config(), first.store)
    assert.equal(first.store.editCanvasConfig.width, 800)
    assert.equal(first.store.requestGlobalConfig.requestParams.Header.token, undefined)
})

test('加载和更新 GoView 配置不会切换宿主 Pinia，卸载释放独立状态', () => {
    const instance = mount(() => {})
    assert.ok(getActivePinia() === instance.hostPinia, '初始化后保留宿主 Pinia')
    void instance.store.getEditCanvasConfig
    assert.ok(getActivePinia() === instance.hostPinia, '读取 getter 后保留宿主 Pinia')
    api.getSessionStorageInfo(config(), instance.store)
    assert.ok(getActivePinia() === instance.hostPinia, '重新加载后保留宿主 Pinia')
    const id = instance.store.$id
    instance.unmount()
    assert.equal(instance.hostPinia.state.value[id], undefined)
})

test('联动能更新嵌套分组与数据池，已删除的联动目标不会抛错', () => {
    const { store } = mount(() => {})
    const target = component('target')
    target.request.requestParams.Params.city = ''
    target.request.requestParams.Header.city = ''
    store.componentList = [{ id: 'group', isGroup: true, groupList: [target] }]
    store.requestGlobalConfig.requestDataPond = [{ dataPondId: 'pond', dataPondRequestConfig: structuredClone(target.request) }]
    const source = component()
    source.events.interactEvents = ['target', 'pond', 'deleted'].map(id => ({
        interactOn: 'click', interactComponentId: id, interactFn: { city: 'name' },
    }))
    api.useChartInteract(source, () => store, { name: '重庆' }, 'click')
    assert.equal(store.componentList[0].groupList[0].request.requestParams.Params.city, '重庆')
    assert.equal(store.requestGlobalConfig.requestDataPond[0].dataPondRequestConfig.requestParams.Header.city, '重庆')
})

test('AJAX 参数变化后重绑轮询，卸载停止轮询并忽略迟到响应', async () => {
    const target = reactive(ajax())
    const updates = []
    const instance = mount(() => api.useChartDataFetch(target, api.useChartEditStore, data => updates.push(data)))
    await flush()
    assert.equal(requests.length, 1)
    assert.equal(intervals.size, 1)
    await [...intervals.values()][0].fn()
    assert.equal(requests.length, 2)
    target.request.requestParams.Header.city = 'CQ'
    await flush()
    assert.equal(requests.length, 3)
    assert.equal(intervals.size, 1)
    let complete
    api.axios.defaults.adapter = request => new Promise(resolve => { complete = () => resolve(response(request, ['late'])) })
    const pending = [...intervals.values()][0].fn()
    await flush()
    instance.unmount()
    assert.equal(intervals.size, 0)
    const before = updates.length
    complete()
    await pending
    assert.equal(updates.length, before)
})

test('数据池共享一次请求，Header/Body 联动有效，卸载释放轮询', async () => {
    const data = config()
    data.requestGlobalConfig = { requestDataPond: [{ dataPondId: 'pond', dataPondRequestConfig: ajax().request }] }
    const updates = [[], []]
    const instance = mount(() => {
        const controller = api.useChartDataPondFetch()
        for (let index = 0; index < 2; index++) {
            const target = component(String(index))
            Object.assign(target.request, { requestDataType: 2, requestDataPondId: 'pond' })
            api.useChartDataFetch(target, api.useChartEditStore, value => updates[index].push(value))
        }
        onMounted(() => controller.initDataPond(api.useChartEditStore))
        onBeforeUnmount(controller.clearMittDataPondMap)
    }, data)
    await flush()
    assert.equal(requests.length, 1)
    assert.deepEqual(updates[0], updates[1])
    assert.equal(updates[0].length, 1)
    assert.equal(intervals.size, 1)
    instance.store.requestGlobalConfig.requestDataPond[0].dataPondRequestConfig.requestParams.Header.city = 'CQ'
    await flush()
    assert.equal(requests.length, 2)
    instance.store.requestGlobalConfig.requestDataPond[0].dataPondRequestConfig.requestParams.Body.json = '{}'
    await flush()
    assert.equal(requests.length, 3)
    instance.unmount()
    assert.equal(intervals.size, 0)
})

test('轮询间隔 0 禁止轮询，不会回退到全局间隔', async () => {
    const target = ajax()
    target.request.requestInterval = 0
    mount(() => api.useChartDataFetch(target, api.useChartEditStore))
    await flush()
    assert.equal(requests.length, 1)
    assert.equal(intervals.size, 0)
})

test('请求保留动态表达式、合并全局参数、正确编码表单与绝对 URL', async () => {
    const { store } = mount(() => {})
    const request = ajax().request
    request.requestHttpType = 'post'
    request.requestParamsBodyType = 'x-www-form-urlencoded'
    request.requestUrl = 'https://example.test/data'
    request.requestParams.Body['x-www-form-urlencoded'] = { city: '重庆 & 成都', value: 'javascript:return ++global.__value' }
    store.requestGlobalConfig.requestOriginUrl = 'https://origin.test'
    store.requestGlobalConfig.requestParams.Params.global = 'yes'
    global.__value = 0
    const original = JSON.stringify(request)
    await api.customizeHttp(request, store.requestGlobalConfig)
    await api.customizeHttp(request, store.requestGlobalConfig)
    assert.equal(requests[0].url, 'https://example.test/data')
    assert.equal(requests[0].params.global, 'yes')
    assert.equal(new URLSearchParams(requests[0].data).get('city'), '重庆 & 成都')
    assert.equal(new URLSearchParams(requests[1].data).get('value'), '2')
    assert.equal(JSON.stringify(request), original)
    delete global.__value
})

test('Axios 失败正确拒绝 Promise（上游 06e0cde）', async () => {
    api.axios.defaults.adapter = async () => { throw new Error('network regression') }
    await assert.rejects(api.axios.get('/failed'), /network regression/)
})

test('胶囊图清空数据后旧柱条全部移除（上游 34b808a）', async () => {
    const chart = reactive(new api.CapsuleConfig())
    const instance = mount(() => {}, config(), () => h(api.Capsule, { chartConfig: chart }))
    const count = el => (el.props.class === 'capsule-item' ? 1 : 0) + el.children.reduce((sum, child) => sum + count(child), 0)
    await flush()
    assert.ok(count(instance.container) > 0)
    chart.option.dataset.source = []
    await flush()
    assert.equal(count(instance.container), 0)
})

test('VChart 语义事件通过实例转发，替换配置有效，卸载只释放一次', async () => {
    const state = reactive({ option: { category: 'unknown', dataset: [{ id: 'data', values: [] }] } })
    const emitted = []
    const instance = mount(() => {}, config(), () => h(api.GoVChart, {
        option: state.option, onDimensionHover: value => emitted.push(value),
    }))
    await flush()
    const chart = global.__charts[0]
    assert.ok(chart)
    chart.events.dimensionHover({ value: 1 })
    assert.deepEqual(emitted, [{ value: 1 }])
    state.option = { category: 'unknown', dataset: [{ id: 'new', values: [{ x: 2 }] }] }
    await flush()
    assert.equal(chart.spec.data[0].id, 'new')
    assert.equal(global.__charts.length, 1)
    instance.unmount()
    assert.equal(chart.released, 1)
})

test('真实预览入口支持替换 JSON、隐藏/恢复与无效配置恢复，兼容旧入口', async () => {
    const initial = config()
    const chart = ajax('first')
    chart.chartConfig.chartKey = 'VTestChart'
    initial.componentList = [chart]
    const state = reactive({ data: initial, visible: true })
    const instance = mount(() => {}, config(), () => h(api.LegacyView, { dataJson: state.data, showAllCom: state.visible }))
    const settle = async () => { await new Promise(resolve => setTimeout(resolve, 5)); await flush() }
    await settle()
    assert.equal(intervals.size, 1)
    assert.equal(requests.length, 1)
    const replacement = structuredClone(initial)
    replacement.componentList[0].id = 'replacement'
    replacement.componentList[0].request.requestUrl = '/replacement'
    state.data = replacement
    await settle()
    assert.equal(intervals.size, 1)
    assert.equal(requests.at(-1).url, '/replacement')
    state.visible = false
    await settle()
    assert.equal(intervals.size, 0)
    state.visible = true
    await settle()
    assert.equal(intervals.size, 1)
    state.data = {}
    await settle()
    assert.equal(intervals.size, 0)
    const alerts = el => (el.props.role === 'alert' ? 1 : 0) + el.children.reduce((sum, child) => sum + alerts(child), 0)
    assert.equal(alerts(instance.container), 1)
    state.data = initial
    await settle()
    assert.equal(alerts(instance.container), 0)
    assert.equal(intervals.size, 1)
    instance.unmount()
    assert.equal(intervals.size, 0)
})

test('替换含数据池的配置后新订阅保留，旧轮询被清理', async () => {
    const initial = config()
    const chart = component()
    chart.chartConfig.chartKey = 'VTestChart'
    Object.assign(chart.request, { requestDataType: 2, requestDataPondId: 'pond' })
    initial.componentList = [chart]
    initial.requestGlobalConfig = { requestDataPond: [{ dataPondId: 'pond', dataPondRequestConfig: ajax().request }] }
    const state = reactive({ data: initial })
    const instance = mount(() => {}, config(), () => h(api.GoView, { dataJson: state.data }))
    await new Promise(resolve => setTimeout(resolve, 5))
    await flush()
    assert.equal(intervals.size, 1)
    const replacement = structuredClone(initial)
    replacement.requestGlobalConfig.requestDataPond[0].dataPondRequestConfig.requestUrl = '/new-pond'
    state.data = replacement
    await flush()
    assert.equal(intervals.size, 1)
    assert.equal(requests.at(-1).url, '/new-pond')
    await [...intervals.values()][0].fn()
    assert.equal(requests.at(-1).url, '/new-pond')
    instance.unmount()
    assert.equal(intervals.size, 0)
})

test('事件 components 注册表按实例隔离，卸载删除旧组件引用', async () => {
    const chart = component('same-id')
    chart.events.baseEvent.click = 'return components["same-id"]'
    const first = mount(() => api.useLifeHandler(chart))
    const second = mount(() => api.useLifeHandler(chart))
    const a = { value: 'first' }, b = { value: 'second' }
    first.value.vnodeBeforeMount({ component: a })
    second.value.vnodeBeforeMount({ component: b })
    assert.equal(await first.value.click(), a)
    assert.equal(await second.value.click(), b)
    first.value.vnodeBeforeUnmount({ component: a })
    assert.equal(await first.value.click(), undefined)
    assert.equal(await second.value.click(), b)
})

test('下拉框异步用户事件仍使用所属预览实例的 store', async () => {
    const data = config()
    const select = new api.SelectConfig()
    const target = component('target')
    target.request.requestParams.Params.value = ''
    select.events.interactEvents = [{ interactOn: 'change', interactComponentId: 'target', interactFn: { value: 'data' } }]
    data.componentList = [select, target]
    const NSelect = { emits: ['update:value'], setup(_props, { emit }) {
        return () => h('select-double', { onChoose: value => emit('update:value', value) })
    } }
    const create = () => {
        let source
        return mount(store => { source = store.componentList[0] }, data,
            () => h(api.InputsSelect, { chartConfig: source }), { NSelect })
    }
    const first = create(), second = create()
    const find = el => el.type === 'select-double' ? el : el.children.map(find).find(Boolean)
    await flush()
    find(first.container).props.onChoose('2')
    await flush()
    assert.equal(first.store.componentList[1].request.requestParams.Params.value, '2')
    assert.equal(second.store.componentList[1].request.requestParams.Params.value, '1')
})

test('分页组件的页码与每页条数事件都能触发联动', async () => {
    const data = config()
    const pagination = new api.PaginationConfig()
    const target = component('target')
    target.request.requestParams.Params = { page: '', size: '' }
    pagination.events.interactEvents = [{ interactOn: 'change', interactComponentId: 'target', interactFn: { page: 'data', size: 'data2' } }]
    data.componentList = [pagination, target]
    const NPagination = { emits: ['update:page', 'update:pageSize'], setup(_props, { emit }) {
        return () => h('pagination-double', {
            onChoosePage: page => emit('update:page', page),
            onChooseSize: size => emit('update:pageSize', size),
        })
    } }
    let source
    const instance = mount(store => { source = store.componentList[0] }, data,
        () => h(api.InputsPagination, { chartConfig: source }), { NPagination })
    const find = el => el.type === 'pagination-double' ? el : el.children.map(find).find(Boolean)
    find(instance.container).props.onChoosePage(3)
    await flush()
    find(instance.container).props.onChooseSize(50)
    await flush()
    assert.equal(instance.store.componentList[1].request.requestParams.Params.page, 3)
    assert.equal(instance.store.componentList[1].request.requestParams.Params.size, 50)
})
