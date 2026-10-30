# 插件系统契约

> Sources: OpenSpec plugin-system; src/app.jsx; tvt-js-plugin-builder skill
> Raw: [runtime-and-plugin-contract](../../raw/tvt-framework/2026-10-27-runtime-and-plugin-contract.md); [codebase-inventory](../../raw/tvt-framework/2026-10-27-codebase-inventory.md)
> Updated: 2026-10-27

## Overview

TvT.js 以插件为业务单元：源码在 `src/plugins/<name>/`，静态资源在 `public/plugins/<name>/`，路由前缀 `/plugins/<name>/…`，元数据在 `config.js`。页面由 `import.meta.glob` 发现，仅正式支持两层路径。

## 命名空间

同一插件标识须一致出现在：

- 目录 `src/plugins/<plugin>`
- 资源 `public/plugins/<plugin>`
- 路由 `/plugins/<plugin>/…`
- `config.js` 的 `name`

## 路由发现

启用 `FES_APP_PLUGINS=true` 时，`src/app.jsx` 的 `patchRoutes`：

1. 扫描 `./plugins/**/pages/**/*.vue`
2. 可选 `FES_APP_PLSNAME` 过滤到单插件
3. 注册：
   - `pages/foo.vue` → `/plugins/<plugin>/foo`
   - `pages/group/foo.vue` → `/plugins/<plugin>/group/foo`
4. 更深目录不作为正式契约（直接跳过）

`FES_APP_PLUGINS=false` 时不自动挂插件页路由（普通项目模式）。

## 元数据与依赖

- `config.js`：`preview` 或分组插件的 `child[].preview`（含 `catalog`、`src`、`type`、`name`、`title` 等）
- `require`：跨插件依赖，影响检查与单插件资源保留
- `index.js`：对外共享组件/工具时才需要
- 脚手架：`node pluginMaker/index.cjs create <pluginName>`；AI 侧优先遵循 `skills/tvt-js-plugin-builder`

## 实测规模

当前仓 **39** 插件、**248** 页面；页面数最多的包括 digitalCity 36、floor 27、basic 21。

## See Also

- [运行模式](runtime-modes.md)
- [能力版图](capability-map.md)
- [TvT.js 项目总览](overview.md)
