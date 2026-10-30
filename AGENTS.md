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
- 模糊/创意需求先走 `/brainstorming`，设计获批准前不落码、不脚手架；需求批准后可用 doc-coauthoring 收成可开工 Spec。
- 展馆文档一期优先：平台总览+路线图、展馆 SaaS、部署与环境规范；城市/工厂孪生只进路线图不进一期详规。
- 展馆一期按多租户强隔离（组织/角色/项目 + 内容运营闭环）；**不做**套餐/配额计费与自助付费；内容双轨（全景 + TvT/编辑器 3D）同一后台可发布。
- Spec 面向开发 Agent：中文、技术栈须钉死；`docs/spec/` 含可勾选 Todo 与总里程碑（按完成情况勾选）。
- 澄清题选项列表默认每题附推荐方案，便于直接「全部按推荐」或改编号。
- 展馆一期部署须经 Gitea CI/CD、独立容器化；宿主机只暴露一个入口端口；专用 nginx 做访问管理，其它服务端口不映射。

## Learned Workspace Facts

- 本仓产品名 **TvT.js**（目录 `three-vue-tres`）：ICEGL 开源 Web 3D / 数字孪生工程框架，Vue 3 + Three.js + TresJS + Fes.js，插件在 `src/plugins/`，Apache-2.0。
- Git remotes：`origin` → `git@github.com:1980-X/three-vue-tres.git`（fork）；`joyx` → `git@joy-x:wilber/three-vue-tres.git`；`upstream` → `git@github.com:hawk86104/three-vue-tres.git`（仅 fetch，push=DISABLE）。
- 本机 Gitea（joy-x）：Web `http://192.168.1.84:18600/`，Git SSH 别名 `joy-x` 端口 **18622**；业务仓走 SSH，勿把 Gitea 密码/PAT 写入仓库或记忆。
- ops-hub 仓 `wilber/ops-hub` 的 `infra-agent-start` 分支含 Gitea 开发者接入瘦包；可用 `install-to-project.sh` 装 `gitea-dev`。
- 项目 `.cursor/` 已 vendor Superpowers、`gitea-dev`、continual-learning、karpathy-llm-wiki；仓内知识库在 `raw/` 与 `wiki/`（主题 `tvt-framework`）。
- 展馆 SaaS 文档：`docs/saas/`（需求）+ `docs/spec/`（实现 Spec/ADR/可勾选 milestones·todos）；设计稿见 `docs/superpowers/specs/2026-10-27-digital-twin-venue-saas-design.md`。
- gpu001 展馆栈 Compose 项目名 **`dtv-saas`**，容器统一标签隔离（如 `com.joyx.project=dtv-saas`）；宿主机入口**有且仅有 `18700→saas-nginx`**；资产目录建议 `/mnt/storage/dtv-saas`。
- 展馆技术栈钉死：API Fastify、Admin/Viewer React（Ant Design）、全景 `@photo-sphere-viewer/core`、Postgres + Prisma；认证 ADR0001＝HttpOnly Cookie Session（PG）+ argon2id；核心表物理删除；媒资先本地，COS 接口预留。
- 展馆一期 CD：Gitea Actions 对 `master` 自动部署、镜像本机构建（Registry 预留）；不做备份专章；健康检查仅 `/health`→`saas-api`。
