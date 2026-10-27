# 数据模型

> 产品对象见 [`../saas/01-exhibition/domain-model.md`](../saas/01-exhibition/domain-model.md)。  
> ORM：**Prisma**；DB：**PostgreSQL**。冲突时实现细节以本文为准。

## 1. 约定（已钉死）

| 项 | 决定 |
| --- | --- |
| 主键 | **UUID**（字符串，Prisma `Uuid` / `@db.Uuid`） |
| 删除 | **物理删除**（无 `deletedAt`）；外键策略见各表 |
| 表名 | `snake_case` |
| Model 名 | `PascalCase` |
| 时间 | 库内 **UTC**；API **ISO-8601** |
| 租户作用域 | 业务表含 `tenant_id`；查询默认强制过滤 |
| 界面文案 | 中文不进库字段名 |

## 2. 实体一览

```text
Tenant
  ├── Member (租户级账号；登录主体)
  ├── Project
  │     ├── ProjectMember (project_id + member_id + role)
  │     ├── Asset
  │     └── Venue
  │           ├── VenueTrack*     # 一馆多轨（含 hybrid）
  │           ├── Hotspot*       # 可挂 track 或 venue
  │           ├── Tour*
  │           └── Publication*
  └── AuditLog
PlatformSuperadmin（或 Member.platformRole）— 代建租户
```

## 3. 表定义（逻辑字段）

### Tenant

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid pk | |
| name | string | 展示名 |
| slug | string unique | 可选短名 |
| status | enum | `active` \| `disabled` |
| created_at / updated_at | datetime | |

### Member

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid pk | |
| tenant_id | uuid fk | 所属租户 |
| email | string | 租户内唯一 |
| password_hash | string | 算法随 ADR0001 |
| display_name | string | |
| is_tenant_owner | bool | 租户拥有者标记（可与项目角色并存） |
| created_at / updated_at | datetime | |

> 平台超管：钉死独立表 **`PlatformAdmin`**（id、email、password_hash）；禁止与租户 `Member` 混表。

### Project

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid pk | |
| tenant_id | uuid fk | |
| name | string | |
| created_at / updated_at | datetime | |

### ProjectMember

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid pk | |
| project_id | uuid fk | on delete cascade |
| member_id | uuid fk | on delete cascade |
| role | enum | **`owner` \| `admin` \| `editor` \| `viewer`** |
| unique | (project_id, member_id) | |

### Asset

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid pk | |
| tenant_id | uuid fk | |
| project_id | uuid fk | |
| kind | enum | `panorama_image` \| `panorama_video` \| `scene_package` \| `audio` \| `other` |
| title | string | |
| storage_key | string | 存储路径键 |
| mime | string | |
| byte_size | bigint | |
| sha256 | string | |
| created_at / updated_at | datetime | |

物理删除 Asset 时：**同步删除存储对象**（同一事务或补偿任务，实现须定义失败重试）。

### Venue

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid pk | |
| tenant_id | uuid fk | |
| project_id | uuid fk | |
| title | string | |
| cover_asset_id | uuid fk? | |
| status | enum | `draft` \| 其它编辑态（发布态以 Publication 为准） |
| created_at / updated_at | datetime | |

> **kind 不单列在 Venue 上死写死一种时：** 以 `VenueTrack` 集合表达；可冗余 `primary_track_id` 便于列表展示。

### VenueTrack（复杂多轨）

一馆多轨；`hybrid` = 至少两条 track。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid pk | |
| venue_id | uuid fk | on delete cascade |
| tenant_id | uuid fk | 冗余便于隔离查询 |
| track_kind | enum | `panorama` \| `scene3d` |
| title | string | |
| sort_order | int | |
| is_primary | bool | 默认进入轨；同一 venue 仅一条 primary（应用层或部分唯一索引保证） |
| entry_asset_id | uuid fk? | 全景主图或场景包 |
| config_json | json | 轨级配置（视野、起点和引擎参数等） |
| created_at / updated_at | datetime | |

### Hotspot

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid pk | |
| venue_id | uuid fk | cascade |
| track_id | uuid fk | **归属某 VenueTrack** |
| tenant_id | uuid fk | |
| title | string | |
| payload_json | json | 动作、坐标、媒体引用等 |
| sort_order | int | |

### Tour

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid pk | |
| venue_id | uuid fk | |
| track_id | uuid fk | |
| tenant_id | uuid fk | |
| title | string | |
| steps_json | json | 有序步骤（热点 id / 相机参数等） |

### Publication

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid pk | |
| tenant_id | uuid fk | |
| venue_id | uuid fk | |
| public_id | string unique | URL 段 |
| status | enum | `published` \| `unpublished` |
| snapshot | json | **整包快照**（venue + tracks + hotspots + tours + 资产引用） |
| version | int | 单调递增 |
| published_at | datetime? | |
| unpublished_at | datetime? | |
| created_at | datetime | |

物理删除 Venue 时：若仍存在 `status=published` 的 Publication → API **409 conflict**；必须先 unpublish 再删。

### AuditLog

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid pk | |
| tenant_id | uuid? | 平台级操作可空 |
| actor_type | enum | `member` \| `platform_admin` \| `system` |
| actor_id | uuid? | |
| action | string | 如 `venue.publish` |
| resource_type | string | |
| resource_id | string | |
| meta_json | json | 无密钥 |
| created_at | datetime | |

一期至少记录：登录失败、发布、下架、项目成员角色变更。

## 4. 索引（最低）

- `project(tenant_id)`  
- `asset(project_id)`、`asset(sha256)`（可选去重查询）  
- `venue(project_id)`  
- `venue_track(venue_id, sort_order)`  
- `publication(public_id)` unique、`publication(venue_id, version)`  
- `project_member(project_id, member_id)` unique  

## 5. 删除语义小结

- 一律 **物理 DELETE**。  
- Asset：删库记录 + 删文件。  
- Venue：须先确保无 `published` Publication（或自动 unpublish）。  
- Track / Hotspot / Tour：随 Venue cascade。  

## 6. 与 Storage / COS

- DB 只存 `storage_key` 等元数据。  
- 本地根：`/mnt/storage/dtv-saas`；COS 适配器仍用同一 `storage_key` 语义。

## 修订

- 2026-10-27：UUID；物理删；Publication JSON 快照；VenueTrack 多轨；AuditLog；项目角色枚举。
