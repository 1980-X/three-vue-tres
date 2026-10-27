# 架构

> 产品边界见 [`../saas/`](../saas/README.md)。冲突时：**产品/范围以 saas 为准；实现细节以本 spec 为准。**

## 1. 目标与非目标

**目标：** 在本仓同仓演进多租户展馆 SaaS（`apps/api`、`apps/admin`、`apps/viewer`），TvT.js 作为 3D 引擎；全景轨独立播放器；gpu001 上独立 Compose 栈、**宿主机只暴露一个入口端口**。

**非目标（一期）：** 微信小程序、计费、城市/工厂孪生详规、腾讯云真实发版、用 Fes 案例 `preview.vue` 充当 SaaS 壳、iframe 嵌旧预览页作为正式访客方案。

## 2. 同仓目录（逻辑）

```text
three-vue-tres/
  apps/
    api/                 # Fastify + Postgres
    admin/               # React 管理后台（静态构建，由 nginx 托管）
    viewer/              # React 访客端（全景 + TvT 3D/WebXR）
  deploy/gpu001/         # compose、nginx 配置、env 示例
  src/plugins/…          # 既有 TvT 引擎/案例；供 viewer 别名引用，非 SaaS 壳
  docs/saas/             # 需求
  docs/spec/             # 本 Spec
```

保留 `yarn pre.dev` 等案例预览供引擎开发；**不**作为多租户后台入口。

## 3. 钉死技术栈

| 层 | 选型 |
| --- | --- |
| API | **Node.js + Fastify** |
| Admin | **React**（独立 Vite 应用，不挂 Fes 案例壳） |
| Viewer | **React** + 同仓 **别名/包引用** TvT/`src`（方案 A） |
| 全景 | **`@photo-sphere-viewer/core`**（及官方所需插件包） |
| DB | **PostgreSQL** |
| 入口 | **专用 nginx 容器** |
| 认证 | 见 [ADR 0001](adrs/0001-auth-mechanism.md)（**Accepted**：HttpOnly Cookie + PG Session） |
| 包管理 | 与仓库一致：**yarn**；apps 可用 workspace（实现计划细化） |

## 4. 逻辑模块

```text
admin (React) ──┐
                ├──► api (Fastify) ──► PostgreSQL
viewer (React) ─┘         │
                          └──► StoragePort ──► LocalFsAdapter（一期）
                                            └── CosAdapter（接口预留，后接）
```

- API **不**解析 Three 场景图业务逻辑；只存元数据与文件句柄。  
- Viewer 按 `VenueKind` 选择 **全景 Runtime** 或 **TvT Engine**（含 WebXR 探测与降级）。

## 5. 容器拓扑

一期固定五容器（同 compose project，名称需隔离，例如 `dtv-saas`）：

| 容器 | 职责 | 宿主机端口 |
| --- | --- | --- |
| `saas-nginx` | 反向代理、静态托管路由、TLS 终止位（见 §19） | **唯一映射：`18700:80`** |
| `saas-api` | Fastify | **不映射** |
| `saas-admin` | 内网静态服务（如 nginx alpine），仅 docker 网络；**不映射**宿主机 | **不映射** |
| `saas-viewer` | 同上 | **不映射** |
| `saas-db` | Postgres | **不映射** |

一期 **不做 Redis**。禁止再增加第二个宿主机 publish 端口。

```text
                    ┌─────────────────────────────────────┐
   :18700 only      │  saas-nginx                         │
  ───────────────►  │  /api/*  → saas-api:3000            │
                    │  /admin/*→ saas-admin (内网静态)     │
                    │  /v/*    → saas-viewer (内网静态)    │
                    │  /assets/*→ api or static volume     │
                    │  /health → saas-api:/health          │
                    └─────────────┬───────────────────────┘
                                  │ docker network only
                    ┌─────────────┴──────────────────────┐
                    │ saas-api  saas-admin  saas-viewer  │
                    │ saas-db                            │
                    └────────────────────────────────────┘
```

## 6. 请求路径

| 浏览器路径 | 后端 |
| --- | --- |
| `/admin/*` | Admin SPA |
| `/v/:publicId` 等 | Viewer SPA |
| `/api/*`、`/auth/*`、`/public/*`、`/platform/*` | `saas-api` |
| `/assets/*` 或签名 URL | 受控资产（发布可见 / 鉴权） |

管理 API 一律鉴权 + `tenant_id` 作用域；公开访客只读 Publication 快照。

## 7. 单端口硬约束

- **宿主机有且仅有 `18700`** 映射到 `saas-nginx:80`。  
- `saas-api`、`saas-db`、admin/viewer 上游 **禁止** `ports:` 发布到宿主机。  
- 不得占用或改写他栈已用端口（Gitea `18600`/`18622`、PlantVR `8189`、H5PL `18555` 等）。  
- 登记：实现落地后写入 ops-hub `port-map`（文档义务；密钥不进 Git）。

## 8. 开发 / 生产同构

- **开发与生产均强制只经 `18700`**，不为 Vite HMR 另开宿主机端口。  
- 开发：容器内或 compose 网络内使用 Vite；若需 HMR，经 nginx 反代 WebSocket，**不** `publish` 额外端口。  
- 生产：静态构建 + nginx；环境变量清单须覆盖开发已用能力（**生产模式无遗漏**），见 `deploy-gpu001.md`。

## 9. TvT 集成

- Viewer **同仓别名引用**引擎源码/包（禁止 iframe 嵌 `plugins/preview.vue` 作为正式方案）。  
- 案例插件市场与 SaaS 租户数据分离。  
- `scene_package` 资产由 API 存文件；viewer 加载。

## 10. VenueKind 运行时

| kind | 运行时 |
| --- | --- |
| `panorama` | `@photo-sphere-viewer/core` |
| `scene3d` | TvT Engine；WebXR 可开 |
| `hybrid` | 主轨默认；副入口切换（无复杂编排引擎） |

## 11. 存储

- 端口：`StoragePort`（upload/get/delete）。  
- 一期实现：`LocalFsAdapter` + bind（建议 `/mnt/storage/dtv-saas/...` 或项目 `data/`，路径含 `tenantId/projectId`）。  
- **COS：** 保留 `CosAdapter` 接口与配置位；一期可不接通真实 COS。

## 12. 多租户在架构上的落点

- DB 行级 `tenant_id`；服务层强制注入。  
- 对象键前缀 `tenants/{tenantId}/projects/{projectId}/...`。  
- 平台超管接口单独前缀，不与租户 API 混鉴权。

## 13. 草稿 vs 发布

- 草稿仅管理端（鉴权）可读。  
- 发布写入不可变 Publication 快照；`/public/*` 与访客 SPA 只读快照。  
- 下架/未发布：API 对 `/public/venues/:publicId` 返回 **404**；Viewer 将非成功响应一律展示**统一文案页**「展馆已下架或不可用」（不向访客区分细节）。

## 14. WebXR

- `scene3d`/`hybrid` 主轨为 3D 时：能力探测 → 支持则进 XR；否则桌面/触控漫游并提示。  
- 全景轨不依赖 WebXR。

## 15. 与 TvT 预览模式并存

- `yarn pre.dev` / `pre.dev.one` 继续服务引擎案例。  
- SaaS 用户入口仅为 `http://<host>:18700/admin` 与 `/v/...`。

## 16. 硬禁止

- 映射 db/api 到宿主机  
- 第二个业务入口宿主机端口  
- 改无关项目 NPM/compose/端口  
- runbook 默认 `docker system prune`  
- 密钥、Token、私钥写入 Git  
- 用案例预览壳冒充多租户后台  

## 17. 可观测性（最低）

- `GET /health`（**钉死此路径**；nginx 反代 `saas-api:/health`，可含 db 就绪）  
- API 结构化日志（request id、tenant id、无密钥）  
- Compose `healthcheck` 覆盖 nginx/api/db  

## 18. CI/CD 位置

- **Gitea Actions**（joy-x）构建镜像/产物并在 gpu001 部署 compose。  
- 细节与流水线步骤见 [`deploy-gpu001.md`](deploy-gpu001.md)。

## 19. TLS

- 一期默认：**局域网/Tailscale HTTP `:18700`**。  
- 若日后 HTTPS：在 `saas-nginx` 终止或前置 NPM；**仍只保留一个宿主机业务端口策略**（或改由 NPM 反代至 18700，不把 api 暴露出去）。  
- 文档须写清当前为 HTTP，避免 Agent 误加第二端口「为了 HTTPS」。

## 20. 失败模式（用户可见）

| 故障 | 期望 |
| --- | --- |
| api 挂 | `/api` 5xx 或维护提示；静态页可提示不可用 |
| db 挂 | health 失败；管理端不可用 |
| nginx 挂 | `:18700` 连不上 |
| 资产缺失 | 访客明确错误态，不白屏死循环 |

## 修订

- 2026-10-27：初稿；入口端口钉死 **18700**。
