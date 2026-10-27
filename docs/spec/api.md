# API

> 需求级表面见 [`../saas/02-platform/api-surface.md`](../saas/02-platform/api-surface.md)。  
> 运行时：**Fastify**；入口经 nginx **`:18700`**。认证机制见 [ADR 0001](adrs/0001-auth-mechanism.md)。

## 1. 约定（已钉死）

| 项 | 决定 |
| --- | --- |
| 错误体 | `{ "error": { "code": "snake_case", "message": "中文可读" } }` |
| 分页 | `page`（从 1）、`pageSize`（默认 20，**最大 100**）；列表响应含 `items` + `total` |
| 前缀 | `/auth`、`/api`、`/public`、`/platform` |
| URL 版本 | 一期 **无** `/v1` |
| OpenAPI | 本文 Markdown 为准；实现阶段可再挂 Swagger |
| 上传 | `multipart` 直传 api；预留预签名形状、一期不实现 |
| 草稿预览 | 仅登录态草稿 API；**无** preview-token |
| 限流 | **登录接口必限流**；其余一期可粗限或暂无 |

所有 `/api/*`：必须登录，且 **强制 `tenant_id` 作用域**（不可由客户端指定其它租户）。

## 2. 错误码（最低集）

| code | HTTP | 含义 |
| --- | --- | --- |
| `unauthorized` | 401 | 未登录或会话失效 |
| `forbidden` | 403 | 无权限或跨租户 |
| `not_found` | 404 | 资源不存在 |
| `validation_error` | 400 | 参数不合法 |
| `conflict` | 409 | 状态冲突（如未下架就删馆） |
| `rate_limited` | 429 | 登录等限流 |
| `internal_error` | 500 | 未预期错误（message 不泄露内部细节） |

## 3. 认证 `/auth`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/auth/login` | 租户成员；body: email、password、（可选 tenant 标识）；**限流** |
| POST | `/auth/platform/login` | **平台超管**（`PlatformAdmin`）；与成员登录分离；**限流** |
| POST | `/auth/logout` | 登出（两类会话均可） |
| GET | `/auth/me` | 当前用户 + 可访问项目摘要（或超管身份） |

具体 Cookie/Session 以 [ADR0001](adrs/0001-auth-mechanism.md) 为准；**登出后管理 API 不可用**。一期无 JWT。

## 4. 平台超管 `/platform`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/platform/tenants` | 代建租户（可同时建 owner 成员） |
| PATCH | `/platform/tenants/:id` | 启用/禁用等 |
| GET | `/platform/tenants` | 分页列表 |

仅 `PlatformAdmin`。

## 5. 租户业务 `/api`

### 5.1 项目

| 方法 | 路径 | 最低角色 |
| --- | --- | --- |
| GET | `/api/projects` | 登录成员（仅自己有权限的项目） |
| POST | `/api/projects` | tenant owner / 约定管理员 |
| GET | `/api/projects/:projectId` | project viewer+ |
| PATCH | `/api/projects/:projectId` | admin+ |
| DELETE | `/api/projects/:projectId` | owner/admin；**物理删**（须无未下架对外馆或先级联策略，与 data-model 一致） |

### 5.2 项目成员

| 方法 | 路径 | 最低角色 |
| --- | --- | --- |
| GET | `/api/projects/:projectId/members` | viewer+ |
| POST | `/api/projects/:projectId/members` | admin+（邀请/添加） |
| PATCH | `/api/projects/:projectId/members/:memberId` | admin+（改 role） |
| DELETE | `/api/projects/:projectId/members/:memberId` | admin+ |

改角色须写 **AuditLog**。

### 5.3 资产

| 方法 | 路径 | 最低角色 |
| --- | --- | --- |
| GET | `/api/projects/:projectId/assets` | viewer+（分页、可按 kind 筛） |
| POST | `/api/projects/:projectId/assets` | editor+；`multipart`；写入 `storage_key/mime/byte_size/sha256` |
| GET | `/api/projects/:projectId/assets/:assetId` | viewer+ |
| DELETE | `/api/projects/:projectId/assets/:assetId` | editor+；**物理删库 + 删文件** |

**预留（一期可不实现处理器）：**  
`POST /api/projects/:projectId/assets/presign` → 将来 COS；响应形状预留在代码接口，路由可先 501。

### 5.4 展馆与轨

| 方法 | 路径 | 最低角色 |
| --- | --- | --- |
| GET | `/api/projects/:projectId/venues` | viewer+ |
| POST | `/api/projects/:projectId/venues` | editor+ |
| GET | `/api/venues/:venueId` | viewer+（含 tracks 摘要） |
| PATCH | `/api/venues/:venueId` | editor+ |
| DELETE | `/api/venues/:venueId` | admin+；须先无 `published` Publication（否则 `conflict`） |
| GET/POST | `/api/venues/:venueId/tracks` | 读 viewer+ / 写 editor+ |
| PATCH/DELETE | `/api/venues/:venueId/tracks/:trackId` | editor+ |
| GET/POST | `/api/venues/:venueId/tracks/:trackId/hotspots` | 同上 |
| PATCH/DELETE | `.../hotspots/:hotspotId` | editor+ |
| GET/POST | `/api/venues/:venueId/tracks/:trackId/tours` | 同上 |
| PATCH/DELETE | `.../tours/:tourId` | editor+ |

草稿读取均需登录；**无**匿名草稿、**无** preview-token。

### 5.5 发布

| 方法 | 路径 | 最低角色 |
| --- | --- | --- |
| POST | `/api/venues/:venueId/publish` | editor+（可配置收紧为 admin+） |
| POST | `/api/venues/:venueId/unpublish` | editor+ |
| GET | `/api/venues/:venueId/publications` | viewer+（历史版本列表，不含大宗 snapshot 可截断） |

**幂等：**

- `publish`：若当前内容与最新 published 快照等价，可 **不增加 version**，返回现有 published。  
- `unpublish`：已是 unpublished 时返回成功（幂等）。

成功发布/下架写 **AuditLog**。

## 6. 公开 `/public`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/public/venues/:publicId` | 仅 `status=published` 的快照；否则 **HTTP 404**（Viewer 展示统一下架文案页） |

不提供公开租户/项目/资产列表。资产字节通过快照内 URL（发布期可访问或短签），禁止枚举未发布对象。

## 7. 健康

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 供 nginx/编排探测；可含 db 就绪；**不**当对外监控商业 API |

## 8. 不做（一期）

- `/v1` 前缀  
- 计费、套餐  
- 微信登录 / 小程序  
- 完整 OpenAPI 必交付  
- 除登录外的精细限流产品化  

## 修订

- 2026-10-27：按推荐钉死错误体、分页、multipart、无 preview-token、publish 幂等、登录限流。
