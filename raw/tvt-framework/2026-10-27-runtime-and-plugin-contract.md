# TvT.js runtime modes and plugin contract (code + OpenSpec)

> Source: Local files `.env`, `.env.predev`, `.env.predev.one`, `src/app.jsx`, `openspec/specs/{framework-foundation,runtime-modes,plugin-system,external-integrations}/spec.md`, `skills/tvt-js-plugin-builder/SKILL.md`
> Collected: 2026-10-27
> Published: Unknown

## Environment flags observed

### .env (ordinary project mode scripts: yarn dev / yarn build)

- FES_APP_PLUGINS=false
- FES_APP_PREINDEX=false

### .env.predev (preview center: yarn pre.dev / pre.build)

- FES_APP_PLUGINS=true
- FES_APP_PREINDEX=true

### .env.predev.one (single-plugin: yarn pre.dev.one)

- FES_APP_PLUGINS=true
- FES_APP_PREINDEX=true
- FES_APP_PLSNAME='gaussianSplatting'

## Routing behavior from src/app.jsx patchRoutes / modifyRoute

- When FES_APP_PLUGINS === 'false': does not auto-add plugin pages routes; logs 项目开发模式: 配置 不自动增加插件plugins里面各个pages的页面路由; also strips layout on default index route.
- When plugins enabled: import.meta.glob('./plugins/**/pages/**/*.vue') registers under /plugins parent with suspenseLayout.
- Optional FES_APP_PLSNAME filters glob to ./plugins/${FES_APP_PLSNAME}/pages/
- Supported path depths only:
  - length === 4 → /plugins/${pluginName}/${page}
  - length === 5 → /plugins/${pluginName}/${group}/${page}
  - deeper: skipped (function returns)
- When FES_APP_PREINDEX === 'true': replaces index route component with plugins/preview.vue

## OpenSpec framework-foundation anchors

- Identity: 三维可视化快速落地框架, not a single business app
- Code-first fact source over docs when conflict
- Stack anchor: Vue 3、Fes.js 4、Tres.js 5、three.js 0.180.x、Vite build

## OpenSpec plugin-system contract summary

- Namespace consistency: src/plugins/<plugin>, public/plugins/<plugin>, route prefix /plugins/<plugin>, config.js name
- Pages only under pages/ with two supported hierarchies
- config.js is metadata source; preview vs child[].preview
- require dependency declaration
- index.js for shared exports
- PLS alias for cross-plugin imports
- Scaffold: pluginMaker / node pluginMaker/index.cjs create

## OpenSpec external-integrations coverage

- qiankun micro-frontend (public path injection, lifecycle, host state bridge)
- uni-app / mini-program WebView compatibility expectations
- zone3Deditor export-friendly plugins
- GoView low-code UI combination constraints

## AI / Spec collaboration (README_zh + skills)

- openspec/ for framework baseline specs
- skills/tvt-js-plugin-builder for plugin scaffolding rules
- External products mentioned in README: dcser.icegl.cn dynamic components; opensource.icegl.cn preview; zone3deditor.icegl.cn scene editor; hunyuan3D image-to-3D practice
