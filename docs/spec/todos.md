# Todos（单次 Agent 会话粒度，可勾选）

> 格式：`- [ ] (Mx) 任务 — 验收：…`  
> 完成并验证后改 `- [x]`；**文档润色不算完成**。  
> 建议会话时长 30–90 分钟；过大请拆。

---

## M0

- [ ] (M0) 创建 `apps/api` Fastify 空服务与 `/health` — 验收：容器内可访问 health JSON
- [ ] (M0) 创建 `apps/admin` React+Vite+Ant Design 壳，`basename=/admin` — 验收：构建产物可被 nginx 以 `/admin/` 打开
- [ ] (M0) 创建 `apps/viewer` React+Vite 壳，路由 `/v/:publicId` — 验收：占位页经 nginx `/v/demo` 可打开
- [ ] (M0) 编写 `deploy/gpu001/docker-compose.yml`（五服务 + 标签 + 仅 `18700:80`） — 验收：`docker compose -p dtv-saas config` 通过且无其它 ports
- [ ] (M0) 编写 `deploy/gpu001/nginx/default.conf` 路由 `/admin` `/v` `/api` `/health` — 验收：compose up 后三路径非 502
- [ ] (M0) 添加 `deploy/gpu001/.env.example`（含 `HOST_PORT=18700`、`DATABASE_URL`、`STORAGE_ROOT` 等） — 验收：无密钥；键名覆盖架构清单
- [ ] (M0) 挂载 `/mnt/storage/dtv-saas`（或文档等价本地 data）到 api — 验收：容器内路径可写探测文件

## M1

- [ ] (M1) 完成并合并 [ADR0001 认证机制](adrs/0001-auth-mechanism.md) 为 Accepted — 验收：Decision 节非空且与实现一致
- [ ] (M1) Prisma schema：Tenant、Member、PlatformAdmin、Project、ProjectMember — 验收：`migrate deploy` 成功
- [ ] (M1) 实现 `/auth/login|logout|me` + 登录限流 — 验收：错误凭据 401；超频 429；登出后 `/auth/me` 401
- [ ] (M1) 实现 `/platform/tenants` 代建 — 验收：超管可建租户+owner；非超管 403
- [ ] (M1) 实现 `/api/projects` CRUD 与成员角色 API — 验收：viewer 只读；跨 tenant 403
- [ ] (M1) AuditLog 写入：登录失败、角色变更 — 验收：库中可见对应行
- [ ] (M1) Admin 登录页 + 项目列表（接真实 API） — 验收：未登录跳转登录并回跳

## M2

- [ ] (M2) Prisma：Asset、Venue、VenueTrack、Hotspot、Tour — 验收：迁移成功
- [ ] (M2) LocalFs StoragePort + `POST/GET/DELETE` assets multipart — 验收：字段含 mime/size/sha256/storage_key；删库后文件不在
- [ ] (M2) Venue + VenueTrack CRUD API（含 primary 约束） — 验收：双轨可建；非 primary 可删
- [ ] (M2) Hotspot / Tour CRUD API（挂 track） — 验收：级联随 venue/track 删除
- [ ] (M2) Admin 资产库页（上传列表删除） — 验收：编辑角色可操作
- [ ] (M2) Admin 展馆编辑页（轨/热点/导览表单列表） — 验收：无拖拽画布也能完成录入
- [ ] (M2) Admin 内嵌草稿预览（调登录态草稿 API） — 验收：预览与保存数据一致

## M3

- [ ] (M3) Prisma Publication + `publish`/`unpublish` 幂等 — 验收：重复 publish 不乱增 version；重复 unpublish 成功
- [ ] (M3) `GET /public/venues/:publicId` 仅 published — 验收：草稿/下架不可读内容
- [ ] (M3) Viewer 接公开 API + 统一下架页文案 — 验收：下架见固定中文页
- [ ] (M3) Viewer 全景轨：`@photo-sphere-viewer/core` — 验收：published 全景可看
- [ ] (M3) Viewer 3D 轨：同仓别名加载 TvT 场景包 — 验收：published 3D 可漫游
- [ ] (M3) hybrid：`?track=` 切轨可分享 — 验收：刷新保持当前轨
- [ ] (M3) WebXR 入口按钮 + 降级 — 验收：无 XR 时按钮隐藏仍可桌面浏览
- [ ] (M3) 手机窄屏冒烟（微信内置浏览器可选） — 验收：可打开并浏览已发布馆

## M4

- [ ] (M4) 添加 `.gitea/workflows/deploy-gpu001.yml`（master push 自动部署） — 验收：push 触发且 compose 更新
- [ ] (M4) 生产 env 对照 `.env.example` 清单（无遗漏键） — 验收：文档/示例键集合一致
- [ ] (M4) 确认无 db/api 宿主机端口、标签齐全 — 验收：`docker ps` 仅 18700 映射属本栈
- [ ] (M4) 登记 ops-hub `port-map`：**18700 = dtv-saas nginx** — 验收：INDEX/port-map 有条目（无密钥）
- [ ] (M4) 回滚说明按 deploy 文做一次演练记录（可选短笔记） — 验收：能切回上一镜像/commit 起栈

---

## 统计

- 约 **33** 条（落在推荐的 25–35 区间）  
- ADR 认证阻塞 **M1** 收尾  

## 修订

- 2026-10-27：按推荐生成可勾选 Todo 与里程碑回链。
