# TvT.js / three-vue-tres codebase inventory

> Source: Local repository `/home/wilber/project/three-vue-tres` (package.json, src/plugins/*/config.js, docs/preview-catalog.md, LICENSE, git remotes, directory listing)
> Collected: 2026-10-27
> Published: Unknown

## Product identity

- package.json name: `TvT.js`
- package.json version: `1.0.0`
- description: An open-source framework for rapid implementation of 3D visualization projects
- author field: 地虎降天龙
- license file: Apache License Version 2.0, January 2004
- README_zh positioning: ICEGL 开源的 Web 3D 工程生态；Three.js、Vue 3、TresJS、Fes.js 技术底座；面向数字孪生、工业可视化、在线三维编辑器和项目插件化交付；永久开源且免费商用
- Node engines: `>=18.18`
- packageManager: yarn@1.22.22

## Core dependency versions (package.json dependencies)

- vue: 3.5.21
- three: 0.180.0
- @tresjs/core: 5.2.1
- @tresjs/cientos: 5.2.1
- @fesjs/fes: 4.0.0-beta.1
- pinia: 2.3.1
- naive-ui: 2.43.1

## npm scripts (package.json)

- dev, build
- pre.dev, pre.dev.one, pre.build, pre.build.one
- both (concurrently runs dev and pre.dev)
- plugin.marker
- pre.build.icegl
- analyze
- test:unit
- postinstall (patch-package)

## Repository size / scale (host measurement 2026-10-27)

- Working tree size excluding node_modules and .git: 145M
- Plugin directories under src/plugins with config.js: 39
- Vue pages under src/plugins/**/pages/**/*.vue: 248
- public/plugins top-level entries: 43

## Plugin inventory (directory name, page count, config title)

- AMapGIS | 2 | AMapGIS
- UIdemo | 14 | UI界面相关
- basic | 21 | 原生功能展示
- cannonPhysics | 2 | Cannon物理引擎
- digitalCity | 36 | 数字城市
- digitalPark | 1 | 数字园区
- eCommerce | 6 | 电商场景
- earthSample | 2 | 地球的简单例子
- ff91Drive | 1 | FF 91 交互试驾
- floor | 27 | 地面地板实例
- floorplan3D | 2 | 户型设计工坊
- gaussianSplatting | 6 | 高斯泼渐
- geokit | 15 | 地理渲染开发工具
- goView | 3 | goView低代码UI
- heatMap | 2 | 热力图实例
- heroSection | 3 | 粒子球
- hunyuan3D | 1 | 结合混元3D图生模型
- industry4 | 14 | 工业4.0
- loadDynamicComponent | 2 | loadDynamicComponent
- medical | 3 | 医疗行业
- postProcessing | 2 | 后处理原理剖析
- projectionShadow | 2 | projectionShadow
- qiankunTvt | 3 | 微前端qiankun
- rayMarchingAndThreejs | 4 | 基于Threejs的光线行进
- resourceManager | 2 | resourceManager
- shadertoyToThreejs | 5 | shadertoyToThree
- simpleGIS | 12 | 简单的GIS例子
- skyBox | 8 | skyBox
- tesla | 2 | Tesla 声浪实验室
- tresEditor | 3 | tres3D编辑器
- tsl | 5 | tsl
- tvtMqtt | 2 | 接入mtqq最佳实践
- uniAppView | 2 | uniapp小程序
- useViewportGizmo | 1 | useViewportGizmo
- visualArts | 14 | 视觉艺术
- volumeRendering | 1 | volumeRendering
- water | 10 | 水相关
- webxr | 3 | web VR/AR 场景
- zoneFreeScene | 4 | 编辑器直出免费项目

TOTAL plugins: 39 ; TOTAL pages: 248

Top page-count plugins: digitalCity 36, floor 27, basic 21, geokit 15, UIdemo 14, industry4 14, visualArts 14, simpleGIS 12, water 10, skyBox 8

## Preview catalog migration counts (docs/preview-catalog.md, dated 2026-10-09 in that doc)

- Blocks 基础能力: 217
- Scenes 场景案例: 62
- Applications 行业应用: 25
- Tools 创作与工程: 31

## Notable custom / industry demos (config intro excerpts)

- tesla title Tesla 声浪实验室: 支持 GPS 声浪、桌面演示、兼容性诊断、二维及三维车机展示。三维车机可选择 Model Y 或 Model 3…音频由 CDN 加载，三维场景复用 ff91Drive 公共资源。
- ff91Drive title FF 91 交互试驾: FF 91 原生 Three.js 试驾场景…已移除 VR 与全屏功能。referenceSource Faraday Future FF 91 https://vr.ff.com/us/
- floorplan3D title 户型设计工坊: 二维户型布置、三维空间预览与独立方案展示…referenceSource floorplan-3d https://github.com/wy51ai/floorplan-3d
- zoneFreeScene: 基于TVT区域场景编辑器直接编辑导出的场景
- webxr: 基于Web的VR/AR应用程序的组件和工具集
- water: 河流、水域、海洋等场景
- hunyuan3D: 腾迅混元3D图生模型…本地部署

## Key top-level directories

- src/ (app.jsx, common, components, pages, plugins, stores)
- public/plugins/
- pluginMaker/
- openspec/specs/
- skills/tvt-js-plugin-builder/
- docs/preview-catalog.md
- preview/ (marketing media)
- .cursor/ (project agent skills/hooks/rules)
