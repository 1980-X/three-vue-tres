# API 表面（需求级）

实现技术（Nest/Fastify 等）在计划阶段选定；此处固定 **边界与资源**。

## 鉴权分区

| 分区 | 前缀（示意） | 说明 |
| --- | --- | --- |
| 认证 | `/auth/*` | 登录、登出、当前用户 |
| 超管 | `/platform/*` | 代建租户等；仅 superadmin |
| 租户业务 | `/api/*` | 需登录；自动租户作用域 |
| 公开 | `/public/*` | 无会话；仅已发布快照 |

## 租户业务资源（示意）

- `GET/POST /api/projects`  
- `GET/PATCH/DELETE /api/projects/:id`  
- `GET/POST /api/projects/:id/members`  
- `PATCH/DELETE .../members/:memberId`  
- `GET/POST /api/projects/:id/assets`（含上传）  
- `GET/POST /api/projects/:id/venues`  
- `GET/PATCH /api/venues/:id`（草稿）  
- `POST /api/venues/:id/preview-token`（可选：短时草稿预览）  
- `POST /api/venues/:id/publish`  
- `POST /api/venues/:id/unpublish`  

## 公开

- `GET /public/venues/:publicId` → 发布快照 JSON（只读）  
- 静态资产 URL 须鉴权或带签名/发布期可访问策略（计划阶段定；禁止未发布资产可枚举）  

## 与 TvT 边界

- API **不**执行场景图业务逻辑  
- `scene_package` 仅元数据 + 文件；加载在 `apps/viewer`  

## 明确无本期 API

- 计费、套餐、支付回调  
- 微信小程序码、小程序登录  
- 城市/工厂行业专用资源类型详规  
