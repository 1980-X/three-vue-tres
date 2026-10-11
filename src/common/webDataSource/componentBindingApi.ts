// 配置参数写回父级响应式状态，组件公开的方法和属性继续从实例读取。
export const createComponentBindingApi = (instance: any, properties: Record<string, any>) => {
    const props = instance.$props ?? {}
    const api = Object.create(instance)
    const keys = new Set([...Object.keys(props), ...Object.keys(properties)])

    keys.forEach(key => {
        Object.defineProperty(api, key, {
            enumerable: true,
            get: () => properties[key] === undefined ? props[key] : properties[key],
            set: value => { properties[key] = value },
        })
    })

    return api
}
