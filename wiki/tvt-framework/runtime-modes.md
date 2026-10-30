# 运行模式与脚本

> Sources: .env* ; package.json scripts ; src/app.jsx modifyRoute ; OpenSpec runtime-modes
> Raw: [runtime-and-plugin-contract](../../raw/tvt-framework/2026-10-27-runtime-and-plugin-contract.md)
> Updated: 2026-10-27

## Overview

通过环境文件 + npm scripts 切换三种主模式，而不是改业务代码开关。核心变量：`FES_APP_PLUGINS`、`FES_APP_PREINDEX`、`FES_APP_PLSNAME`。

## 模式对照

| 模式 | 脚本 | 环境文件要点 | 行为 |
| --- | --- | --- | --- |
| 普通项目 | `yarn dev` / `yarn build` | `.env`：`PLUGINS=false`，`PREINDEX=false` | 不自动挂全插件路由；默认 index 去 layout |
| 预览中心 | `yarn pre.dev` / `pre.build` | `.env.predev`：二者均为 `true` | 自动挂插件路由；`/` 换成 `plugins/preview.vue` |
| 单插件 | `yarn pre.dev.one` / `pre.build.one` | `.env.predev.one`：另设 `FES_APP_PLSNAME` | 示例现值：`gaussianSplatting` |
| 双开 | `yarn both` | — | concurrently 跑 `dev` + `pre.dev` |

另有 `plugin.marker`、`analyze`、`pre.build.icegl`、`test:unit`、`postinstall`（patch-package）。

## 预览首页替换

`FES_APP_PREINDEX=true` 时，`modifyRoute` 把默认 index 组件替换为 `./plugins/preview.vue`，用于开源案例展示中心。

## See Also

- [插件系统契约](plugin-system.md)
- [TvT.js 项目总览](overview.md)
