# 本机远程与协作习惯

> Sources: git remotes; GitHub fork API; joy-x push 2026-10-27; AGENTS.md
> Raw: [local-fork-and-agent-tooling](../../raw/tvt-framework/2026-10-27-local-fork-and-agent-tooling.md)
> Updated: 2026-10-27

## Overview

本克隆同时对接 GitHub fork、只读上游 ICEGL 仓，以及局域网 joy-x Gitea。日常可双推；拉上游用 `upstream`。

## Remotes

| Remote | URL | 用途 |
| --- | --- | --- |
| origin | `git@github.com:1980-X/three-vue-tres.git` | 己方 GitHub fork，可推 |
| joyx | `git@joy-x:wilber/three-vue-tres.git` | 本机 Gitea，可推 |
| upstream | `git@github.com:hawk86104/three-vue-tres.git` | ICEGL 上游，**仅 fetch**（push=DISABLE） |

GitHub 侧 `1980-X/three-vue-tres` 的 `fork=true`，parent/source 均为 `hawk86104/three-vue-tres`。

## joy-x

- Web：http://192.168.1.84:18600/wilber/three-vue-tres（创建时为私有仓）
- SSH：`Host joy-x` → `192.168.1.84:18622`
- 业务仓约束见 `.cursor/rules/gitea-dev.mdc`（禁默认动 `~/service/gitea` compose；禁 force push main/master 除非用户明示）

## 相对上游的本地提交（截至 c4072ee4）

在共享 tip `a1de5820` 之上：

1. `16bb4e1a` Superpowers 项目 skills
2. `818e0470` gitea-dev skill/rule/hook
3. `c4072ee4` continual-learning + karpathy-llm-wiki

拉更新：`git fetch upstream` → `merge` 或 `rebase` `upstream/master`。

## AGENTS 验证闸门

未在本轮对话明示时，**不要**自动执行 `npm run build|dev|serve|preview`、Vite 本地服务、浏览器调试/截图；汇报完成时须说明已按规则跳过 build/debug 验证。

## See Also

- [Agent 工具链](agent-tooling.md)
- [TvT.js 项目总览](overview.md)
