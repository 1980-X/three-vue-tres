# 展馆领域模型

所有业务对象均隶属某一 `tenantId`；列表与读写默认带租户作用域。

## 对象关系（逻辑）

```text
Tenant
  └── Member (Role)
  └── Project
        └── Asset*
        └── Venue
              ├── Hotspot*
              ├── Tour*
              └── Publication* (发布快照；访客只读最新/指定公开版)
```

## Venue

| 字段概念 | 说明 |
| --- | --- |
| kind | `panorama` \| `scene3d` \| `hybrid` |
| title / cover | 展示信息 |
| draft | 可编辑草稿状态 |
| primaryTrack | hybrid 时的主轨；一期允许「一馆一主轨 + 可选副入口」 |

### 双轨语义

| 轨 | 资产 | 运行时 |
| --- | --- | --- |
| panorama | 360 图/视频等 | viewer 全景 Runtime |
| scene3d | TvT/编辑器导出的场景包或受管场景引用 | viewer 加载 TvT Engine；可启用 WebXR |
| hybrid | 两轨资产可并存 | 主轨默认进入；副入口可切换（不做复杂编排引擎） |

## Asset

- 按 `tenantId` + `projectId` 隔离存储路径  
- 类型区分：`panorama_image` / `panorama_video` / `scene_package` / `audio` / `other`  
- API 只存元数据与存储句柄；**不**在服务端解析 Three 场景图业务逻辑  

## Hotspot / Tour

- 概念两轨共用；具体坐标/字段可按轨扩展  
- 热点动作：信息面板、跳转展馆内锚点、打开媒体等（一期能力清单在实现计划细化，需求层要求可配置、可随 Publication 快照冻结）  

## Publication

- 发布时生成不可变快照（展馆配置 + 热点/导览 + 资产引用版本）  
- 分配 `publicId`；状态：`published` \| `unpublished`  
- 一期建议保留「当前版 + 上一版」便于回滚；更长历史为二期  
