# FF 91 交互试驾 · TvT.js 插件

插件名：`ff91Drive`，版本：`1.0.0`。

参考页面：https://vr.ff.com/us/ 。车辆、环境贴图、材质、灯光和地面波纹从现有复刻移植；已去除 VR、立体渲染和全屏功能。

这是使用宿主 Three.js 的原生 Vue 组件，不通过 iframe 或远程网页嵌入。组件自行管理一个 WebGLRenderer，放在普通 Vue DOM 容器内使用，不放进 `<TresCanvas>` 子树。

## 安装

把 `ff91Drive.zip` 放到 TvT.js 项目的 `pluginMaker/install/`，在项目根目录执行：

```sh
node pluginMaker/index.cjs install ff91Drive
```

如果项目尚无 `pluginMaker/install` 目录，先创建该目录。
也可将 ZIP 中的 `src/plugins/ff91Drive`、`public/plugins/ff91Drive` 按原目录解压到项目根目录。
官方安装器遇到同名插件会停止；更新前请先备份原目录。

在 TvT.js 预览页的“我的插件”中找到“FF 91 交互试驾”。本地路由为：

```text
/plugins/ff91Drive/index
```

仓库默认使用 hash 路由，对应浏览器地址形如 `/#/plugins/ff91Drive/index`。

## 作为组件复用

```vue
<template>
    <div style="position: relative; width: 100%; height: 600px">
        <FF91Drive ref="drive" locale="zh" @ready="onReady" @error="onError" />
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { FF91Drive } from 'PLS/ff91Drive'

const drive = ref(null)
const onReady = () => drive.value.start()
const onError = (error) => console.error('FF 91:', error)
</script>
```

不设置 `auto-start` 时，点击画面或按 Enter 开始。

### Props

| 属性 | 默认值 | 作用 |
| --- | --- | --- |
| `asset-base` | 自动定位 `plugins/ff91Drive/` | 静态资源基址，可指定 CDN 或子目录地址，需以 `/` 结尾 |
| `auto-start` | `false` | 资源加载完成后开始 |
| `show-controls` | `true` | 显示桌面左下角操作提示 |
| `pixel-ratio` | `1` | 渲染像素比，范围 0.5～2；1 对应原页面 |
| `locale` | `en` | `en` / `zh`，设置提示语言 |
| `paused` | `false` | 从父组件控制暂停 |
| `gyroscope` | `true` | 在系统已允许的触屏设备上使用陀螺仪控制相机 |

组件事件：`ready(api)`、`progress(0～1)`、`start`、`error(Error)`、`dispose`。

### 暴露方法

```js
drive.value.start()
drive.value.pause()
drive.value.resume()
drive.value.reset() // 开始后重置车速、位置、视角和车灯
drive.value.setInput({ throttle: 1, steering: 0.4, brake: false })
drive.value.setInput({}) // 释放程序控制的油门、方向和刹车
drive.value.setLights({ headlights: true, highBeams: false })
const state = drive.value.getState()
```

`steering` 为 -1～1，正值向左；`throttle` 为 -1～1，负值制动；`brake: true` 优先制动。
`getState()` 返回状态、车速（m/s）、刹车、方向和左右转向灯状态。
请在 `ready` 后调用驾驶、复位和车灯方法。

### 直接使用场景控制器

```js
import { createFF91Experience } from 'PLS/ff91Drive'

const api = createFF91Experience(container, {
    assetBase: '/plugins/ff91Drive/',
    onProgress: (ratio) => console.log(ratio),
    onError: (error) => console.error(error),
})
await api.ready
api.start()

// 页面或业务退出时必须调用；Vue 组件会自动处理。
api.dispose()
```

容器必须有明确的宽、高。此底层控制器不附加 Vue 的加载提示、操作图标和摇杆 DOM；完整界面请使用 `FF91Drive`。

## 操作和效果

- 方向键：加速、刹车、左右转向。
- 鼠标拖动：环绕相机；滚轮：缩放。
- 触屏：左侧摇杆驾驶、右侧拖动相机、双指缩放。
- 已有陀螺仪授权的触屏设备：倾斜设备控制相机，触屏驾驶。插件不会自行弹出权限申请；无传感器数据时使用拖动相机。
- 前灯、方向相关光晕、LED 日行灯、尾灯矩阵、左右琥珀色转向灯闪烁、刹车灯与光晕。
- 轮胎转动、前后轮转向、车身惯性倾斜、环境反射和接触阴影。
- 开场网格标志、相机过渡、移动地面与 GPU 高度场波纹。

## 源码结构

```text
src/plugins/ff91Drive/
  config.js                    插件元数据与预览入口
  index.js                     组件和控制器导出
  pages/index.vue              TvT.js 路由入口
  components/FF91Drive.vue      界面、Props、事件和 Vue 生命周期
  lib/
    experience.js              场景、渲染循环、暂停、销毁、公共 API
    assets.js                  私有资源加载与释放
    input.js                   聚焦键盘、鼠标、触屏与陀螺仪
    vehicle-state.js           驾驶物理
    vehicle-body.js            车身材质与阴影
    lights.js                  灯光和闪烁
    wheels.js                  轮胎与刹车盘
    camera.js                  环绕相机
    ground.js / ripple.js      地面和双缓冲 GPU 波纹
    math.js                    数学和时钟
  shaders/                     14 个可编辑 GLSL 源文件
public/plugins/ff91Drive/
  meshes/ textures/ fonts/ preview/
```

## 框架兼容和资源路径

本次依据 `hawk86104/three-vue-tres` 的 `master` 提交
`4e67d65201fb7cb8fffee52045b6456fb0e84af6` 移植，读取了 `package.json`、`.fes.js`、`.fes.predev.one.js`、`src/app.jsx`、`src/common/utils.js`、预览入口、插件模板和 `pluginMaker/index.cjs`。

- 宿主依赖：Vue 3.5.21、Three.js 0.180.0、GSAP 3.13.0；这些依赖已在该仓库声明，不额外打包旧版库。
- `tvtstore: 'LOCAL'` 使本插件进入“我的插件”。
- `preview[].name: 'index'` 与 `pages/index.vue` 对应。
- `require: []`；没有依赖其他 TvT.js 插件或其公共资源。
- 支持普通页面和按插件选择的源码/资源布局。若手动启用单插件模式，将 `.env.predev.one` 中的 `FES_APP_PLSNAME` 设为 `'ff91Drive'`。
- 资源优先采用 qiankun 注入的公共路径，其次使用 Vite 基址。若部署在自定义 history 路由、CDN 或微前端子目录，显式传入 `asset-base`。
- 这是普通 TvT.js 页面插件，未声明为 zone3Deditor 可编辑场景或 GoView 动态组件。
- 浏览器需要 WebGL2、`EXT_color_buffer_float`、Pointer Events 和 ResizeObserver。

卸载会取消动画帧、观察器、输入与传感器监听，终止模型请求并释放纹理、几何体、材质、GPU 计算目标和 renderer。组件支持 Vue KeepAlive 暂停/恢复。

## 验证记录

已进行只读的 JavaScript 语法、模块路径、配置/路由、模型/纹理完整性、旧接口移除及 ZIP 目录检查。

遵照目标仓库 `AGENTS.md` 的“不要自动运行构建或调试命令”要求，本次没有运行构建、开发服务器、浏览器调试或截图。原始复刻页面此前通过的浏览器检查，不代表这次 r180 移植已经通过运行验证。

预览图片沿用之前复刻页面的截图。需在目标项目中确认加载、转向灯亮灭、刹车灯、缩放、触屏、重复挂载/卸载及单插件构建表现。

## 素材来源

参考代码、车辆和品牌素材来自 https://vr.ff.com/us/ ，资源校验记录见 `ASSETS.json`，权利说明见 `NOTICE.md`。框架本身的许可证不替代这些素材的权利归属。
