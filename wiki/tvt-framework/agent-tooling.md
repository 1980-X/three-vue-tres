# 本仓 Agent 工具链

> Sources: .cursor tree; skills/tvt-js-plugin-builder; install actions 2026-10-27
> Raw: [local-fork-and-agent-tooling](../../raw/tvt-framework/2026-10-27-local-fork-and-agent-tooling.md); [runtime-and-plugin-contract](../../raw/tvt-framework/2026-10-27-runtime-and-plugin-contract.md)
> Updated: 2026-10-27

## Overview

本仓用两套 skill 入口：上游自带的 `skills/tvt-js-plugin-builder`，以及项目级 `.cursor/skills/`（Superpowers、gitea-dev、continual-learning、karpathy-llm-wiki）。hooks 在会话开始注入 Superpowers、shell 前拦截危险 git/docker、会话结束触发 continual-learning。

## 上游工程 skill

- `skills/tvt-js-plugin-builder/`：新建插件/案例、preview 元数据、pluginMaker、单插件构建、qiankun/uni-app/GoView/zone 约束

## `.cursor` 已装 skills（约 17 个目录）

- **Superpowers**：brainstorming、writing-plans、executing-plans、TDD、systematic-debugging、verification-before-completion、worktrees、code-review 系列、using-superpowers 等
- **gitea-dev**：joy-x SSH/Git 业务仓操作
- **continual-learning**：委托 `agents-memory-updater` 维护 `AGENTS.md` Learned；stop hook + state
- **karpathy-llm-wiki**：本 wiki（`raw/` + `wiki/`）的 ingest/query/lint

配套：`.cursor/rules/gitea-dev.mdc`、`.cursor/agents/agents-memory-updater.md`。

## hooks.json 合成

- `sessionStart` → `./.cursor/hooks/session-start`（Superpowers）
- `beforeShellExecution` → `.cursor/hooks/git-shell-guard.sh`
- `stop` → `.cursor/hooks/continual-learning-stop.sh`（loop_limit 1）

## OpenSpec

`openspec/specs/` 手工基线：framework-foundation、runtime-modes、plugin-system、preview-center、plugin-lifecycle、external-integrations。尚未强制绑定 OpenSpec CLI。

## See Also

- [本机远程与协作习惯](local-fork-ops.md)
- [插件系统契约](plugin-system.md)
