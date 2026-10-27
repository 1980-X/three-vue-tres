# 总里程碑（可勾选）

> 语法：`- [ ]` / `- [x]`  
> **仅实现或验证完成才勾选**；文档润色不算。  
> 任务明细见 [`todos.md`](todos.md)。冲突以 [`architecture.md`](architecture.md) 为准。

---

## 进度总览

- [ ] **M0** 同仓脚手架 + Compose（单端口 `18700`）
- [ ] **M1** 租户 / 成员 / RBAC + 认证 ADR 落地 + 代建租户
- [ ] **M2** 展馆草稿 + 资产 + VenueTrack 双轨编辑
- [ ] **M3** 发布 / 下架 + 访客 Viewer（PC / 手机 / WebXR 降级）
- [ ] **M4** Gitea Actions 自动部署 + 生产 env 无遗漏 + port-map 登记

全部勾选后，可将 [`README.md`](README.md) 中「可进入实现」相关状态勾上（若仍有 Reader Testing，先完成 Stage 3）。

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

## 修订

- 2026-10-27：按推荐固定 M0–M4、双层验收、ADR 挂 M1、port-map 挂 M4。
