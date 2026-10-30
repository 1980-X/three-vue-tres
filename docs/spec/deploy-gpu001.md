# gpu001 部署与 CI/CD

> 冲突时以 [`architecture.md`](architecture.md) 为准。  
> 产品部署意图见 [`../saas/03-deploy/`](../saas/03-deploy/)。

## 1. 范围

- **一期唯一运行环境：** gpu001  
- **宿主机入口有且仅有：`18700` → `saas-nginx:80`**  
- 腾讯云发版：不做（见 saas 预留文）  
- **不做：** 文档内 curl 健康验收清单、备份 runbook  

## 2. Compose 项目与标签隔离

| 项 | 钉死值 |
| --- | --- |
| Compose project | `dtv-saas`（`docker compose -p dtv-saas`） |
| 网络名 | `dtv_saas_net`（示例，实现可微调但须项目内唯一） |

**所有本项目容器必须带统一标签**，避免与他栈混淆，例如：

```yaml
labels:
  com.joyx.project: dtv-saas
  com.joyx.stack: digital-twin-venue-saas
```

禁止与其它 compose 项目共用匿名容器、混用同一 project 名。

## 3. 服务与端口

| 服务名 | 角色 | 宿主机 ports |
| --- | --- | --- |
| `saas-nginx` | 入口反代 + 静态 | **`18700:80` 仅此一条** |
| `saas-api` | Fastify + Prisma | 不映射 |
| `saas-admin` | Admin 静态产物（卷或构建进 nginx 可访问路径） | 不映射 |
| `saas-viewer` | Viewer 静态产物 | 不映射 |
| `saas-db` | PostgreSQL | 不映射 |

容器须带 §2 标签。一期无 Redis。

## 4. 仓库内目录

```text
deploy/gpu001/
  docker-compose.yml
  nginx/
    default.conf          # /admin /v /api /public /assets /health
  .env.example            # 无密钥；变量名清单
  # .env                  # 本机/服务器持有，不进 Git
```

admin/viewer：**内网静态容器**（compose 服务 `saas-admin` / `saas-viewer`），由 `saas-nginx` 反代；**不**映射宿主机端口。

## 5. 资产目录

- Bind：**`/mnt/storage/dtv-saas`**  
- 布局建议：`/mnt/storage/dtv-saas/tenants/{tenantId}/projects/{projectId}/...`  
- 容器内只读/读写挂载点由 compose 声明；禁止只写容器可写层当唯一真源。

## 6. 数据库迁移

- ORM/迁移：**Prisma**  
- 迁移在 **api 镜像启动流程或 CI 部署步骤** 中执行（`prisma migrate deploy`）；禁止依赖「人进容器手改库」。  
- 空库/有库路径均须可重复执行。

## 7. 镜像策略

| 阶段 | 策略 |
| --- | --- |
| 一期 | **本机构建**（`docker compose build` / CI 在 gpu001 上 build） |
| 预留 | Gitea Container Registry（`192.168.1.84:18600`）推拉；一期可不启用 |

## 8. Gitea Actions（生产自动部署）

- Runner：gpu001 **默认** `gitea-act-runner`（沿用实例默认标签，不另造集群）  
- 仓库：joy-x `wilber/three-vue-tres`（与 GitHub origin 双远程并存时，**CD 以 joy-x 为准**）  
- **生产触发：** push 到 **`master`** → 自动构建并 `compose up -d`（项目名 `dtv-saas`）  
- 工作流文件建议：`.gitea/workflows/deploy-gpu001.yml`（路径实现时可微调，须进仓）

### 流水线骨架

1. checkout  
2. build 镜像 / 前端静态产物  
3. 写/校验服务器侧 `.env` 存在（不把密钥写入 Actions 日志）  
4. `docker compose -p dtv-saas … up -d --build`（或 build 与 up 分步）  
5. Prisma migrate deploy（api 一次性 job 或启动入口）  
6. **不做** 备份 job、**不做** 文档要求的 curl 清单  

## 9. 环境变量：开发 / 生产对照（生产无遗漏）

文档与 `deploy/gpu001/.env.example` 必须列出同一套键；生产不得缺开发已用能力键。  
**核对日：2026-10-30** — 生产 `.env` 与 `.env.example` 键集合一致（无遗漏、无额外键）。

| 类别 | 键（名） | 说明 |
| --- | --- | --- |
| 入口 | `HOST_PORT` | 钉 `18700`；仅 nginx |
| DB 引导 | `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | 仅 `saas-db` 容器用 |
| DB | `DATABASE_URL` | 指向 `saas-db`，非宿主机 |
| 会话/认证 | `SESSION_COOKIE_NAME` | ADR0001；默认 `dtv_session` |
| 存储 | `STORAGE_ROOT` | 容器内路径（如 `/data`）；宿主机 bind `/mnt/storage/dtv-saas` |
| COS 预留 | `COS_SECRET_ID` / `COS_SECRET_KEY` / `COS_BUCKET` / `COS_REGION` | 可空；一期 LocalFs |
| 公开 URL | `PUBLIC_BASE_URL` | 如 `http://<gpu001-ip>:18700` |
| Node | `NODE_ENV` | 生产 `production` |

开发同样只经 **18700**；不为 HMR 增加宿主机端口（见 architecture §8）。

## 10. nginx 路由（实现须对齐）

| 路径 | 上游 |
| --- | --- |
| `/admin/` | admin 静态 |
| `/v/` | viewer 静态 |
| `/api/` `/auth/` `/public/` `/platform/` | `saas-api` |
| `/assets/` | 受控静态或 api |
| `/health` | 反代 **`saas-api:/health`**（钉死 `/health`） |

## 11. 首次人工 bootstrap

1. 确认 `18700` 空闲、未占用他栈  
2. `mkdir -p /mnt/storage/dtv-saas` 并设好权限  
3. 复制 `deploy/gpu001/.env.example` → 服务器 `.env`，填密钥  
4. `docker compose -p dtv-saas -f deploy/gpu001/docker-compose.yml up -d --build`  
5. 确认容器均带 `com.joyx.project=dtv-saas`  
6. 之后以 Gitea Actions 自动部署为主（**M4 验收以 Actions 为准**；手工 `compose up` 仅允许 bootstrap / 救急，不算 M4 完成）  

## 12. 硬禁止

- 映射 `saas-db` / `saas-api` 到宿主机  
- 第二个业务宿主机端口  
- 改 NPM/他项 compose/端口  
- runbook 默认 `docker system prune`  
- 密钥进 Git / 进 Actions 明文日志  

## 13. 回滚（简述，非备份文）

- 保留上一版镜像 tag 或 compose 文件 git 版本  
- 回滚：检出上一成功 commit / 镜像 tag 后再次 `compose up -d`  
- **不**在本期要求自动异地备份或定时 dump  

### 13.1 演练记录（2026-10-30）

手工救急（与 Actions 同命令）：

```bash
cd /home/wilber/project/three-vue-tres
git log --oneline -5   # 选上一成功 commit
git checkout -B master <good-sha>
docker compose -p dtv-saas -f deploy/gpu001/docker-compose.yml \
  --env-file deploy/gpu001/.env up -d --build
```

验收口诀：`docker ps --filter label=com.joyx.project=dtv-saas` 仅 nginx 映 `18700`；`saas-api` 启动时已 `prisma migrate deploy`。  
（本次未刻意切坏再切回；命令与 CD 工作流一致，可随时按上表执行。）

## 修订

- 2026-10-30：M4 — Actions 工作流、env 键表对齐 ADR0001、回滚演练笔记。  
- 2026-10-27：初稿；端口仅 18700；Prisma；无备份/无 curl 清单。
