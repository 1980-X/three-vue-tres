# 总里程碑（可勾选）

> 语法：`- [ ]` / `- [x]`  
> **仅实现或验证完成才勾选**；文档润色不算。  
> 展馆任务明细见 [`todos.md`](todos.md)；AI 出模见 [`todos-ai-mesh.md`](todos-ai-mesh.md)。冲突以 [`architecture.md`](architecture.md) / AI design 为准。

---

## 进度总览 — 展馆 SaaS

- [x] **M0** 同仓脚手架 + Compose（单端口 `18700`）
- [x] **M1** 租户 / 成员 / RBAC + 认证 ADR 落地 + 代建租户
- [x] **M2** 展馆草稿 + 资产 + VenueTrack 双轨编辑
- [x] **M3** 发布 / 下架 + 访客 Viewer（PC / 手机 / WebXR 降级）
- [x] **M4** Gitea Actions 自动部署 + 生产 env 无遗漏 + port-map 登记

## 进度总览 — AI 出模 Agent

- [ ] **P1** LLM 多厂商 Registry + 超管配置 / 测连通
- [ ] **P2** Agent SSE + **Three.js JSON→GLB**（硬性）+ 工作台预览
- [ ] **P3** 混元轨 A + MeshProvider 预留 + `mesh_jobs`
- [ ] **P4** Asset 入库 + 挂 VenueTrack 闭环
- [ ] **P5** MCP/CLI 薄封装（可选）

指针：[`ai-mesh-agent.md`](ai-mesh-agent.md)。

---

## M0 — 脚手架与单端口栈

**总验收：** `docker compose -p dtv-saas` 可起 nginx/api/admin/viewer/db；宿主机 **仅** `18700`；容器均带 `com.joyx.project=dtv-saas`；`/admin/`、`/v/`、`/health` 经 nginx 可达（health **不是** `/api/health`）。

## M1 — 租户与权限

**总验收：** PlatformAdmin 可代建租户；成员可登录；项目成员角色生效；跨租户 API 返回 403；登录接口有限流；**ADR0001 已选定并实现**。

## M2 — 草稿与双轨内容

**总验收：** 可上传 Asset（含 sha256 等字段）；可建 Venue + VenueTrack（含 primary）；可编辑热点/导览；Admin 内嵌预览草稿；物理删除资产时文件同步删除。

## M3 — 发布与访客

**总验收：** publish/unpublish 幂等符合 api.md；公开 `GET /public/venues/:publicId` 仅已发布；Viewer 全景与 3D 可切换轨；手机可浏览；WebXR 按钮按能力显示；下架见统一文案页。

## M4 — CI/CD 与生产清单

**总验收：** joy-x 上 `master` push 触发自动部署；生产 `.env` 键相对 `.env.example` 无遗漏；ops-hub（或约定文档）登记 **18700**；无第二宿主机端口、无 db/api publish。

---

## AI Mesh — 分期验收摘要

| 阶段 | 总验收 |
| --- | --- |
| P1 | 智谱/Kimi/DS（+兼容代理）可并存配置；Key 脱敏；probe 中文错误 |
| P2 | 无混元 Key 亦可经 Agent 出草模 GLB 并预览 |
| P3 | MOCK/真机混元出 GLB；可与轨 B 交替 |
| P4 | 入库后 Assets 可见并可挂轨 |
| P5 | Cursor MCP 调同一 Tool；无第二套业务逻辑 |

## 修订

- 2026-10-31：追加 AI Mesh P1–P5（设计已批准；实现计划已写）。  
- 2026-10-30：M4 勾选（工作流进仓；push 触发待双推 joy-x 后观察 Actions）。  
- 2026-10-27：按推荐固定 M0–M4、双层验收、ADR 挂 M1、port-map 挂 M4。
