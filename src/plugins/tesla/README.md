# Tesla 声浪实验室

从 EV Engine Lab 移植的 TvT.js 案例，并新增基于 `ff91Drive` 的 Model Y 三维试驾。使用宿主已有依赖；声浪页面使用 Vue 和浏览器原生 Web Audio、Geolocation API，三维页面使用 Three.js 和 `ff91Drive` 的通用模块，未新增 npm 依赖。

## 入口

预览目录中的「Tesla 声浪实验室」，对应 `/plugins/tesla/index`。默认打开仪表盘，页面导航由入口组件接入宿主路由，音频组件本身不修改全局 hash。

| 路由 | 视图 |
| --- | --- |
| `/plugins/tesla/index` | 仪表盘：12 套声浪、音量/强度、换挡音效、GPS 与桌面演示 |
| `/plugins/tesla/index?view=diagnostics` | 浏览器能力、提示音、定位信号与诊断结果导出 |
| `/plugins/tesla/index?view=tesla` | 车机展示：GPS 时速、模拟转速与挡位 |
| `/plugins/tesla/index?view=tesla3d` | 三维车机：实时车辆动作、车内仪表、声浪与状态运镜 |
| `/plugins/tesla/drive` | Model Y Performance 三维试驾 |

## 三维车机展示

从仪表盘右上角「三维车机」进入，或直接使用 `?view=tesla3d`。三维车机加载完成后直接驻车，默认整车外部视角。顶部提供「设置」、车内/车外视角切换，以及「键盘模拟/使用 GPS」按钮；「设置」返回仪表盘，车内/车外只在手动点击时切换。

设置面板的「展示车型」可选择 Model Y Performance 或 Model 3 Performance，默认 Model Y。选择随其他设置保存在本机，重新进入三维车机时按所选车型加载；通过 `applySettings({ modelId: 'model3' })` 也可切换，已经打开的三维车机会重新加载所选模型并释放旧资源。两款车型的 CDN 地址、车轮命名、屏幕节点与灯光材质集中在 `engine/vehicles.ts`，共用车辆动作、GPS/键盘输入、声浪和运镜逻辑。Model 3 使用 [提供的 CDN 模型](https://opensource.cdn.icegl.cn/model/industry4/tesla/model3-2024-performance.glb)，模型文件不复制进仓库。

PC 预览时点击「键盘模拟」，焦点自动进入场景：`↑ / W` 加速，`↓ / S / 空格` 刹车，`← / A` 左转，`→ / D` 右转，可同时按加速和转向。键盘复用现有桌面模拟动力模型，车辆、车灯、车内仪表、声浪和运镜共同跟随模拟状态。进入模拟会先停止 GPS 定位，点击「使用 GPS」则清空模拟输入、停止模拟并重新连接定位，两种输入不混用。松键、失焦、切后台、切换模式或卸载均释放控制；浏览器的 Ctrl/Alt/Command 快捷键不被接管。

三维车辆与仪表、声浪共用 `EngineController`，每 50 ms 更新一次状态；模型每帧根据该状态更新四轮滚动、前轮转向、加减速俯仰、刹车灯和移动地面，不另外运行手动驾驶物理。声浪沿用仪表盘所选音色、音量、强度、模拟转速和挡位；音频加载或播放被浏览器限制时，定位和三维车辆仍独立更新。首次播放如果需要用户手势，点按场景即可启用或重试，提示显示在车内屏幕中。

优先读取 GPS 的 `heading`；缺失时，根据通过位置过滤的坐标和足够长的移动距离推算航向。低速、精度不足、航向跳变或数据过期时不触发转弯；有效航向的变化同时控制车轮、车身转向、同侧转向灯和镜头。制动根据减速度与现有动力总成的制动估计触发。这些是 GPS 推算的动作，不代表读取了实车方向盘、制动踏板或转向灯总线信号。定位延迟时按声浪控制器相同的衰减规则逐渐减速，定位中断时停止运动并清除转向、制动状态。

原仪表的双表盘、速度、模拟转速、挡位、加速度、负载、定位与音频状态直接绘制到原车内屏幕处的 CanvasTexture，Model Y 使用 `Display` 的前屏区域，Model 3 使用独立的 `Screen_Front`。根据模型自身变换和几何计算前屏位置、倾角及座舱镜头，不需要截取 DOM；屏幕略微放大，使用不受场景灯光染色的高亮材质，并降低本视图车窗的不透明度。数据有变化才上传纹理。车外视角保留起步、加速、制动和转弯的状态运镜；车内视角跟随车辆座舱方便读取仪表，停车或匀速都不会自动改变所选的车内/车外视角。

拖动可环绕镜头，滚轮或双指可缩放，操作后保留手动视角 6 秒，再恢复自动运镜。按 `Esc` 返回设置，也可使用浏览器返回。缓存停用、页面隐藏和卸载时沿用引擎的暂停/清理，并释放三维场景、车内屏幕纹理及镜头监听；返回前台后重新连接定位。

## Model Y 三维页面

手动 `drive` 页默认使用 [Model Y CDN 模型](https://opensource.cdn.icegl.cn/model/industry4/tesla/modely-2025-performance.glb)，车型地址集中在 `engine/vehicles.ts`，运行时不再依赖本地 `models/` 目录。保留车身材质和节点层级，通过模型现有的 `Wheel_*_Spatial`、`Wheel_*_Assembly` 实现前轮转向和四轮滚动，轴距、轮距和轮胎半径从模型读取。点击「开始试驾」后以演示车速行驶；方向键加速、制动、转向，拖拽环绕，滚轮缩放。触屏左侧驾驶、右侧转动镜头，双指缩放；「重置」恢复视角并停车。

前大灯与日行灯常亮，尾部示宽灯保持低亮度；按下方向键「下」制动时，后部灯带和高位刹车灯变亮；左右转向时，同侧前后琥珀色转向灯按 1 秒周期闪烁，松开后关闭。灯光使用 GLB 原有灯罩/灯带几何；光晕复用 `ff91Drive/textures/flareHead.jpg`，按观察角度衰减并进行深度测试。阴影材质关闭色调映射，保持贴图白边在乘法混合中为中性色，避免整块矩形变暗。

开场和地面共用 `public/plugins/tesla/textures/tesla-mark.svg` 的 T 形矢量标识；开场为大幅地面标识，开始后淡出，行驶地面使用统一方向的红色 T 字纹样，保留移动和波纹。深红天空、酒红山脉、霓虹地平线与扫描光带由 Tesla 专属环境着色器生成，山脉轮廓来自原天空盒，并同步生成车辆的环境反射；红色和洋红轮廓光与界面配色保持一致。主题代码仅在 `tesla` 内，不修改 `ff91Drive` 原场景。

相机、驾驶状态、键鼠/触屏输入和 GPU 地面波纹通过 `PLS/ff91Drive` 复用。Roboto 字体、天空盒源图、接触阴影、车灯光晕和操作图标直接引用 `public/plugins/ff91Drive/`；不再加载 FF 点阵贴图和独立的旧反射贴图。GLB 自带贴图，几何使用 Draco 压缩；加载器复用 `public/draco/` 的现有解码器，解析完成后释放解码工作线程。页面隐藏或缓存停用时暂停，卸载时释放模型、贴图、环境反射目标、波纹渲染目标及监听。

两个模型保持原文件名及全部节点名称、顺序、层级、变换、网格和材质绑定；贴图原始字节、Model Y 的动画通道和采样数据保持一致。压缩清理了未被材质使用的 UV，未对有效表面减面；Model Y 另外移除了 14,532 个零面积退化三角形。位置、法线和有效 UV 分别使用 16 / 12 / 16 bit 量化，属于有损几何压缩。

| 模型 | 原始字节 | 压缩后字节 | 节点数 |
| --- | ---: | ---: | ---: |
| `model3-2024-performance.glb` | 4,499,332 | 628,700 | 155 |
| `modely-2025-performance.glb` | 8,821,956 | 994,316 | 137 |

`config.js.require` 声明 `ff91Drive`，单插件资源保留依赖该字段；安装 Tesla 插件时也需保留该插件。手动试驾入口使用文字预览卡片。手动 `drive` 页继续独立运行，三维车机通过 `EngineApp` 连接原声浪控制器。共享场景与贴图来源说明见 `src/plugins/ff91Drive/NOTICE.md`，Roboto 许可见同目录 `OFL.txt`。

## 文件边界

- `pages/index.vue`：声浪实验室的 Fes 路由适配入口。
- `pages/drive.vue`、`lib/drive-*.js`、`lib/model-y*.js`：三维页面、最小资源加载、场景生命周期、T 字地面、深红环境与两款 Tesla 模型的共用适配。
- `components/EngineApp.vue`：应用组件，负责视图切换和生命周期。
- `views/Tesla3DView.vue`、`lib/live-drive.js`、`lib/vehicle-screen.js`：三维车机入口、实时车辆状态适配、状态运镜与车内屏幕绘制。
- `views/`、`components/`：四个视图和原生 SVG 仪表、图标、波形。
- `engine/`：声音、运动估算、动力总成、定位、诊断与车型配置；不引用宿主路由或其他插件。
- `data/profiles.json`：12 套配置；`assets/`：本地字体。
- `public/plugins/tesla/`：12 张音色图片、案例预览图和 T 形标识；车型模型从上述 CDN 地址加载。
- 声浪音频：87 个 WAV 从 `https://opensource.cdn.icegl.cn/sound/tesla/` 加载，仓库不包含 `sounds` 目录。

音频 CDN 根目录集中在 `engine/assets.ts`。配置中保留 `sounds/<音色>/<文件>.wav` 相对路径，解析时去掉 `sounds/` 前缀，例如 `sounds/amg-gt3/idle.wav` 对应 `https://opensource.cdn.icegl.cn/sound/tesla/amg-gt3/idle.wav`；分层采样和换挡音效使用相同规则。

所有样式限定在 `.tesla-engine` 根节点内，字体与动画有独立命名。未移植原项目的 `App.vue`、`main.ts`、`host.css`、构建配置或 `node_modules`。卡片使用原项目已有的截图，不代表本次移植后的浏览器验证。

## 作为组件复用

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { TeslaEngine } from 'PLS/tesla'

const page = ref<'dashboard' | 'diagnostics' | 'tesla' | 'tesla3d'>('dashboard')
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

通过组件 ref 可调用 `start()`、`stop()`、`setProfile(id)`、`setMode('gps' | 'demo')`、`applySettings(patch)`、`getState()`。`applySettings` 接收 `modelId`（`modely` / `model3`）、`volume`、`intensity`（0–100）、`shiftSounds`、`processingMode`（`smooth` / `adaptive`）、`pollMs`（0 / 250）。桌面手动演示的方向键/空格仅在仪表盘内获取焦点后生效。

切换视图、停用缓存页面或卸载会停止当前音频、定位和定时器；缓存停用时销毁内部视图，清理诊断与按键监听。重新激活后重建视图，车机展示页按原逻辑尝试自动连接，仪表盘等待点击启动。

GPS 需要 HTTPS 或 localhost；浏览器可能要求点按才能启用音频。位置在本地处理，转速与挡位为模拟值。设置保存在当前浏览器，不包含坐标。

## 来源与验证边界

保留了原项目的 `engine/reference/` 数值核心和配置来源字段。算法说明见 [docs/algorithm-notes.md](docs/algorithm-notes.md)，资源来源、原始文件大小及 SHA-256 见 [docs/asset-sources.json](docs/asset-sources.json)；音频通过 `url` 记录 CDN 地址，本地资源通过 `localPath` 记录文件路径。替换 WAV 时同步维护配置中的分层 RPM、负载、增益和路径。

本次按仓库 `AGENTS.md` 要求跳过 build/debug 和浏览器验证，只进行源码、路径、资源完整性及 diff 检查。原项目的验证记录不作为此次宿主集成或实车使用的验证结果。
