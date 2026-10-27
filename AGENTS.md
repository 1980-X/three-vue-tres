# Codex 项目规则

## 编码规范

- 代码架构简单，逻辑清晰，每次生成代码量精简。保证人类可以较好的review。

## 验证命令

- 在修改本项目代码后，不要自动运行构建或调试命令。
- 这包括 `npm run build`、`npm run dev`、`npm run serve`、`npm run preview`、`./package.json` 的 scripts 中的命令、Vite 的 dev/preview 命令、本地服务器启动，以及基于浏览器的调试或截图。
- 只有当用户在当前对话中明确要求进行这些验证时，才可以运行这些命令。
- 允许进行只读检查，例如查看 diff 或源码文件。
- 在汇报已完成的工作时，需要说明：由于该项目规则要求，已跳过 build/debug 验证。

## Learned User Preferences

- 用户要「简答」「简报」时回答须短可读，先给结论。
- 说「双推」时同时推 `joyx`（Gitea）与 `origin`（GitHub）；未点名其他远端时勿只推一侧。
- GitHub 侧须保持与上游 `hawk86104/three-vue-tres` 的 fork 关联；日常用只读 `upstream` 拉更新，勿往 upstream 推。
- 模糊/创意需求先走 `/brainstorming`，设计获批准前不落码、不脚手架。
- 展馆 SaaS 文档一期优先：平台总览+路线图、展馆 SaaS、部署与环境规范；城市/工厂孪生只进路线图不进一期详规。
- 展馆一期按多租户商业 SaaS（强隔离）设计；内容双轨（全景展馆 + TvT/编辑器 3D 场景）同一后台可发布。

## Learned Workspace Facts

- 本仓产品名 **TvT.js**（目录 `three-vue-tres`）：ICEGL 开源 Web 3D / 数字孪生工程框架，Vue 3 + Three.js + TresJS + Fes.js，插件在 `src/plugins/`，Apache-2.0。
- Git remotes：`origin` → `git@github.com:1980-X/three-vue-tres.git`（fork）；`joyx` → `git@joy-x:wilber/three-vue-tres.git`；`upstream` → `git@github.com:hawk86104/three-vue-tres.git`（仅 fetch，push=DISABLE）。
- 本机 Gitea（joy-x）：Web `http://192.168.1.84:18600/`，Git SSH 别名 `joy-x` 端口 **18622**；业务仓走 SSH，勿把 Gitea 密码/PAT 写入仓库或记忆。
- ops-hub 仓 `wilber/ops-hub` 的 `infra-agent-start` 分支含 Gitea 开发者接入瘦包；可用 `install-to-project.sh` 装 `gitea-dev`。
- 项目 `.cursor/` 已 vendor Superpowers、`gitea-dev`、continual-learning、karpathy-llm-wiki；仓内知识库在 `raw/` 与 `wiki/`（主题 `tvt-framework`）。
