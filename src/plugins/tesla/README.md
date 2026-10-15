# Tesla 声浪实验室

从 EV Engine Lab 移植的独立 TvT.js 案例。仅使用宿主已有的 Vue 和浏览器原生 Web Audio、Geolocation API；未新增 npm 依赖，也不依赖其他插件。

## 入口

预览目录中的「Tesla 声浪实验室」，对应 `/plugins/tesla/index`。默认打开仪表盘，页面导航由入口组件接入宿主路由，音频组件本身不修改全局 hash。

| 路由 | 视图 |
| --- | --- |
| `/plugins/tesla/index` | 仪表盘：12 套声浪、音量/强度、换挡音效、GPS 与桌面演示 |
| `/plugins/tesla/index?view=diagnostics` | 浏览器能力、提示音、定位信号与诊断结果导出 |
| `/plugins/tesla/index?view=tesla` | 车机展示：GPS 时速、模拟转速与挡位 |

## 文件边界

- `pages/index.vue`：唯一的 Fes 路由适配入口。
- `components/EngineApp.vue`：应用组件，负责视图切换和生命周期。
- `views/`、`components/`：三个视图和原生 SVG 仪表、图标、波形。
- `engine/`：声音、运动估算、动力总成、定位与诊断；不引用宿主路由或其他插件。
- `data/profiles.json`：12 套配置；`assets/`：本地字体。
- `public/plugins/tesla/`：12 张音色图片及案例预览图。
- 声浪音频：87 个 WAV 从 `https://opensource.cdn.icegl.cn/sound/tesla/` 加载，仓库不包含 `sounds` 目录。

音频 CDN 根目录集中在 `engine/assets.ts`。配置中保留 `sounds/<音色>/<文件>.wav` 相对路径，解析时去掉 `sounds/` 前缀，例如 `sounds/amg-gt3/idle.wav` 对应 `https://opensource.cdn.icegl.cn/sound/tesla/amg-gt3/idle.wav`；分层采样和换挡音效使用相同规则。

所有样式限定在 `.tesla-engine` 根节点内，字体与动画有独立命名。未移植原项目的 `App.vue`、`main.ts`、`host.css`、构建配置或 `node_modules`。卡片使用原项目已有的截图，不代表本次移植后的浏览器验证。

## 作为组件复用

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { TeslaEngine } from 'PLS/tesla'

const page = ref<'dashboard' | 'diagnostics' | 'tesla'>('dashboard')
const engine = ref<InstanceType<typeof TeslaEngine> | null>(null)
</script>

<template>
  <TeslaEngine
    ref="engine"
    :page="page"
    asset-base="./plugins/tesla/"
    storage-key="my-scene:engine:v1"
    @navigate="page = $event"
  />
</template>
```

`assetBase` 默认 `./plugins/tesla/`，可指定图片资源部署目录；音频使用上述独立 CDN 目录。`page` 默认 `dashboard`；`storageKey` 默认 `tvt:tesla:engine:v1`，独立实例可使用不同键。资源目录和存储键在创建实例时读取；更换时通过 Vue `key` 重建实例。`--ev-min-height`、`--ev-display-height` 可调整嵌入高度。

通过组件 ref 可调用 `start()`、`stop()`、`setProfile(id)`、`setMode('gps' | 'demo')`、`applySettings(patch)`、`getState()`。`applySettings` 接收 `volume`、`intensity`（0–100）、`shiftSounds`、`processingMode`（`smooth` / `adaptive`）、`pollMs`（0 / 250）。桌面手动演示的方向键/空格仅在仪表盘内获取焦点后生效。

切换视图、停用缓存页面或卸载会停止当前音频、定位和定时器；缓存停用时销毁内部视图，清理诊断与按键监听。重新激活后重建视图，车机展示页按原逻辑尝试自动连接，仪表盘等待点击启动。

GPS 需要 HTTPS 或 localhost；浏览器可能要求点按才能启用音频。位置在本地处理，转速与挡位为模拟值。设置保存在当前浏览器，不包含坐标。

## 来源与验证边界

保留了原项目的 `engine/reference/` 数值核心和配置来源字段。算法说明见 [docs/algorithm-notes.md](docs/algorithm-notes.md)，资源来源、原始文件大小及 SHA-256 见 [docs/asset-sources.json](docs/asset-sources.json)；音频通过 `url` 记录 CDN 地址，本地资源通过 `localPath` 记录文件路径。替换 WAV 时同步维护配置中的分层 RPM、负载、增益和路径。

本次按仓库 `AGENTS.md` 要求跳过 build/debug 和浏览器验证，只进行源码、路径、资源完整性及 diff 检查。原项目的验证记录不作为此次宿主集成或实车使用的验证结果。
