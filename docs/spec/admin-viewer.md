# Admin / Viewer

> 需求见 [`../saas/01-exhibition/admin-and-viewer.md`](../saas/01-exhibition/admin-and-viewer.md)。  
> 技术：Admin/Viewer 均为 **React**；入口仅 **`:18700`**。

## 1. 约定（已钉死）

| 项 | 决定 |
| --- | --- |
| Admin 基路径 | `/admin/`（React Router `basename=/admin`） |
| Viewer 公开路径 | `/v/:publicId` |
| hybrid 切轨 | 查询参数 **`?track=<trackId>`** |
| Admin 组件库 | **Ant Design** |
| 界面语言 | **仅中文** |
| 展馆编辑一期 | 表单 + 热点/导览 **列表编辑**；不做可视化拖拽画布 |
| 3D 草稿预览 | Admin **内嵌**精简 Viewer，登录态拉草稿 API |
| 手机 | Viewer **响应式**；无独立手机包 |
| WebXR | 3D 轨显示「进入 VR」；不支持则隐藏，桌面/触控漫游 |
| 未登录 /admin | 跳转登录页，登录后 **回跳原 URL** |
| 下架/不可用 | Viewer **统一文案页**：「展馆已下架或不可用」 |

## 2. Admin 信息架构

建议路由（均在 `/admin` 下）：

| 路径 | 页面 |
| --- | --- |
| `/login` | 登录 |
| `/` | 项目列表 |
| `/projects/:projectId` | 项目概览 |
| `/projects/:projectId/members` | 成员与角色 |
| `/projects/:projectId/assets` | 资产库 |
| `/projects/:projectId/venues` | 展馆列表 |
| `/projects/:projectId/venues/:venueId` | 展馆编辑（轨 / 热点 / 导览 / 预览 / 发布） |

### 角色与按钮

与 data-model / api 一致：`viewer` 只读；`editor+` 可编辑与默认发布；`admin+` 管成员；删除展馆等危险操作 `admin+`。

### 展馆编辑（一期）

1. 基本信息（标题、封面资产）  
2. **VenueTrack** 列表：增删改、设 primary、`track_kind`、入口资产、`config_json` 表单字段  
3. 当前轨下热点表：增删改 `payload_json` 关键字段（坐标、动作类型等用表单项，原始 JSON 可高级折叠）  
4. 导览表：步骤列表编辑  
5. **预览：** 内嵌 Viewer（草稿）  
6. **发布 / 下架：** 展示 `publicId` 与完整访客 URL（`http://<host>:18700/v/{publicId}`）

### 平台超管（可同应用隐藏路由或同仓小子应用）

- 代建租户等：走 `/platform/*`；入口可放 `/admin/platform/*`，仅 PlatformAdmin 可见。

## 3. Viewer 行为

### 加载

1. 读 `publicId` → `GET /public/venues/:publicId`  
2. 非 published → **统一下架/不可用页**（不暴露内部原因）  
3. 按快照中 primary track（或 `?track=`）选择运行时：  
   - `panorama` → `@photo-sphere-viewer/core`  
   - `scene3d` → TvT Engine（同仓别名）  

### hybrid

- 默认 primary track  
- UI 提供切轨；切换时更新 `?track=`，可分享当前轨链接  

### WebXR

- 仅 `scene3d`（或 hybrid 当前轨为 3D）且能力探测成功时显示「进入 VR」  
- 失败/不支持：不展示按钮，保持桌面漫游  

### 响应式

- PC / 手机 Web（含微信内置浏览器）同一 SPA  
- 触控：热点点击、简单导览；不要求一期手势与 PC 完全对等，但须可完成「进入并浏览」  

## 4. 与 nginx 对齐

| URL | 应用 |
| --- | --- |
| `/admin/*` | Admin SPA |
| `/v/*` | Viewer SPA |
| API | `/auth` `/api` `/public` `/platform`（Admin/Viewer 前端请求同源 `:18700`） |

开发、生产均 **不** 另开宿主机端口。

## 5. 不做（一期）

- 可视化拖拽场景编辑器  
- 微信小程序壳  
- 多语言  
- 匿名草稿链接 / preview-token  
- 访客侧详细错误码展示  

## 修订

- 2026-10-27：全部按推荐钉死路径、Ant Design、列表编辑、内嵌预览、统一下架页。
