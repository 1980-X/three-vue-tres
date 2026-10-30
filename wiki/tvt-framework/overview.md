# TvT.js 项目总览

> Sources: Local inventory 2026-10-27; README/package identity
> Raw: [codebase-inventory](../../raw/tvt-framework/2026-10-27-codebase-inventory.md); [runtime-and-plugin-contract](../../raw/tvt-framework/2026-10-27-runtime-and-plugin-contract.md); [local-fork-and-agent-tooling](../../raw/tvt-framework/2026-10-27-local-fork-and-agent-tooling.md)
> Updated: 2026-10-27

## Overview

本仓库是 ICEGL 出品的 **TvT.js**（目录名 `three-vue-tres`）：以 Vue 3 + Three.js + TresJS + Fes.js 为底座的 Web 3D / 数字孪生工程框架，Apache-2.0，可免费商用。它不是单一业务 App，而是插件化案例库 + 工程脚手架；本机 fork 同步 GitHub 上游并双推 joy-x Gitea。

## 技术锚点

| 项 | 值 |
| --- | --- |
| npm name / version | `TvT.js` / `1.0.0` |
| Node | `>=18.18` |
| Vue | 3.5.21 |
| three | 0.180.0 |
| @tresjs/core / cientos | 5.2.1 |
| @fesjs/fes | 4.0.0-beta.1 |
| 包管理 | yarn 1.22.22 |
| 许可 | Apache License 2.0 |

OpenSpec `framework-foundation` 将栈锚点表述为 Vue 3、Fes.js 4、Tres.js 5、three.js 0.180.x 与 Vite 构建链路；与文档冲突时以代码为准。

## 规模（2026-10-27 实测）

- 工作树约 **145M**（不含 `node_modules` / `.git`）
- **39** 个插件目录（各有 `config.js`）
- **248** 个插件页面 `pages/**/*.vue`
- `public/plugins` 顶层 **43** 项
- 预览目录文档（2026-10-09）：Blocks 217 / Scenes 62 / Applications 25 / Tools 31

## 定位与交付路径

README 强调链路：**需求 → Spec → AI 协同 → 场景验证 → 插件或源码交付**。配套包括 `openspec/`、`skills/tvt-js-plugin-builder`、动态组件服务 dcser、在线预览 opensource.icegl.cn、区域场景编辑器 zone3deditor、混元 3D 图生实践等（后几项多为仓外产品）。

## 本机 fork 要点

- GitHub fork parent：`hawk86104/three-vue-tres`；remote `upstream` 只读拉取
- `origin` = `1980-X/three-vue-tres`；`joyx` = `wilber/three-vue-tres`（joy-x `:18622`）
- `AGENTS.md`：**禁止**未明示时自动跑 build/dev/preview 等验证

## See Also

- [插件系统](plugin-system.md)
- [运行模式](runtime-modes.md)
- [能力版图](capability-map.md)
- [本机远程与运维习惯](local-fork-ops.md)
- [Agent 工具链](agent-tooling.md)
