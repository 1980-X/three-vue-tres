# 插件能力版图

> Sources: src/plugins/*/config.js inventory 2026-10-27; docs/preview-catalog.md
> Raw: [codebase-inventory](../../raw/tvt-framework/2026-10-27-codebase-inventory.md)
> Updated: 2026-10-27

## Overview

39 个插件覆盖渲染基础、水与海洋、GIS/城市、工业与家居、编辑器/AI、XR/物理、微前端与本仓定制车机/户型案例。预览中心另按 Blocks / Scenes / Applications / Tools 分类（文档计数 217 / 62 / 25 / 31）。

## 按主题分组（目录名）

### 渲染与特效

basic、postProcessing、projectionShadow、tsl、shadertoyToThreejs、skyBox、rayMarchingAndThreejs、visualArts、volumeRendering、gaussianSplatting、resourceManager、useViewportGizmo

### 水 / 海洋

water（10 页；含光谱海面、Snell 水下等较深实现）

### GIS / 城市

AMapGIS、simpleGIS、geokit、digitalCity（36 页，最多）、digitalPark、earthSample、heatMap

### 行业与空间

industry4、medical、eCommerce、floor（27 页）、floorplan3D（户型设计工坊，可导出 JSON/PNG/GLB）

### 编辑器 / AI / 低代码

tresEditor、zoneFreeScene（编辑器直出免费场景）、hunyuan3D（混元图生 3D）、goView、loadDynamicComponent、heroSection

### XR / 物理

webxr（web VR/AR）、cannonPhysics

### 集成与 UI

qiankunTvt、uniAppView、tvtMqtt、UIdemo

### 本仓突出定制案例

- **tesla**：Tesla 声浪实验室（Model Y / Model 3 车机等；复用 ff91Drive 公共资源）
- **ff91Drive**：FF 91 交互试驾（已移除 VR 与全屏）

## PC Web「VR 展馆」适用性

框架适合桌面浏览器展馆式漫游与数字孪生场景；头显路径可参考 `webxr`，但展馆主路径仍是 Web 3D 漫游而非必须 WebXR。

## See Also

- [插件系统契约](plugin-system.md)
- [TvT.js 项目总览](overview.md)
