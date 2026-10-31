# AI 出模 Agent 工作台

> 展馆 Admin 内嵌；国内多 LLM + 双轨出模（Three.js JSON→GLB / 混元）。  
> **不**替代 TvT 引擎插件演示页；密钥仅服务端。

## 真源

| 文档 | 路径 |
| --- | --- |
| 设计（已批准） | [`../superpowers/specs/2026-10-31-ai-mesh-agent-workbench-design.md`](../superpowers/specs/2026-10-31-ai-mesh-agent-workbench-design.md) |
| 实现计划 | [`../superpowers/plans/2026-10-31-ai-mesh-agent-workbench.md`](../superpowers/plans/2026-10-31-ai-mesh-agent-workbench.md) |
| 可勾选 Todo | [`todos-ai-mesh.md`](todos-ai-mesh.md) |
| 里程碑 | [`milestones.md`](milestones.md)（AI Mesh P1–P5） |

## 与展馆主栈关系

复用 `dtv_session`、CSRF、Asset/StoragePort、`:18700` 单入口；新增表与路由挂在 `apps/api` / `apps/admin`。
