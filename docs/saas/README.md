# Digital Twin Venue SaaS — 需求文档索引

> 状态：设计已评审通过（会话 2026-10-27）  
> 仓库策略：同仓演进（`apps/*` + 既有 TvT 引擎）  
> 实现计划：待本目录审阅通过后，再走 `writing-plans`

## 文档分类

| 目录 | 内容 |
| --- | --- |
| [00-overview](00-overview/) | 愿景、术语、一期范围、路线图 |
| [01-exhibition](01-exhibition/) | 展馆领域、双轨内容、后台与访客 |
| [02-platform](02-platform/) | 多租户、角色权限、API 边界 |
| [03-deploy](03-deploy/) | gpu001 部署；腾讯云预留 |
| [99-out-of-scope.md](99-out-of-scope.md) | 明确不做 |

设计总入口（brainstorming 约定）：[`../superpowers/specs/2026-10-27-digital-twin-venue-saas-design.md`](../superpowers/specs/2026-10-27-digital-twin-venue-saas-design.md)

## 阅读顺序

1. `00-overview/vision-and-scope.md`  
2. `00-overview/roadmap.md`  
3. `01-exhibition/domain-model.md` → `admin-and-viewer.md`  
4. `02-platform/tenancy-and-rbac.md` → `api-surface.md`  
5. `03-deploy/gpu001.md` → `tencent-reserved.md`  
6. `99-out-of-scope.md`
