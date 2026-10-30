# Digital Twin Venue SaaS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本仓落地多租户展馆 SaaS（`apps/api` + `apps/admin` + `apps/viewer` + `deploy/gpu001`），宿主机仅暴露 `18700`，完成 M0–M4 验收。

**Architecture:** 五容器 Compose（`dtv-saas`）：`saas-nginx` 唯一映射 `18700:80`，反代 Admin/Viewer 静态与 Fastify API；Postgres + Prisma；媒资 LocalFs（`/mnt/storage/dtv-saas`）；认证 ADR0001＝HttpOnly Cookie `dtv_session` + PG Session + argon2id。Visitor 只读 Publication 快照；3D 轨同仓别名加载 TvT，全景轨 `@photo-sphere-viewer/core`。

**Tech Stack:** Node ≥18.18、yarn、Fastify、Prisma、PostgreSQL、React+Vite、Ant Design、`@photo-sphere-viewer/core`、同仓 TvT/`src`、Docker Compose、Gitea Actions（joy-x `master`）。

**Spec 真源：** `docs/spec/`（architecture / data-model / api / admin-viewer / deploy-gpu001 / milestones / todos / adrs/0001）。冲突时产品以 `docs/saas/`、实现以 `docs/spec/` 为准。

**执行说明：** 本计划按 M0→M4 顺序；每完成一里程碑对应勾选 `docs/spec/milestones.md` 与 `docs/spec/todos.md`。本仓 AGENTS.md 禁止 Agent **擅自**跑 `npm/yarn build|dev`；验收命令写在步骤中，**仅当用户本回合明确允许验证时执行**，否则改码后口头说明「已跳过 build/debug 验证」。

## Global Constraints

- 宿主机有且仅有 **`HOST_PORT=18700` → saas-nginx:80**；禁止映射 db/api/admin/viewer 到宿主机。
- Compose project：**`dtv-saas`**；全容器标签 **`com.joyx.project=dtv-saas`**、`com.joyx.stack=digital-twin-venue-saas`。
- 健康检查路径钉死 **`GET /health`**（不是 `/api/health`）。
- 认证：Cookie **`dtv_session`** HttpOnly Path=/ SameSite=Lax；密码 **argon2id**；Session 存 PG；一期无 JWT。
- 错误体：`{ "error": { "code": "snake_case", "message": "中文可读" } }`。
- 分页：`page` 从 1、`pageSize` 默认 20 最大 100；列表含 `items` + `total`。
- 删除：**物理 DELETE**；无 `deletedAt`；已 published 的 Venue 删前须 unpublish（否则 409）。
- 不做：计费、小程序、Redis、preview-token、拖拽画布编辑器、curl 健康清单文档、备份专章。
- 密钥不进 Git；`.env` 仅本机。
- 包管理：**yarn**；SaaS apps 用 yarn workspaces，不污染根 Fes 案例为多租户壳。

---

## File Structure

```text
three-vue-tres/
  package.json                          # 增加 workspaces: ["apps/*"]
  apps/
    api/
      package.json
      Dockerfile
      prisma/schema.prisma
      prisma/migrations/...
      src/
        index.ts                        # Fastify listen
        app.ts                          # buildApp() 供测试注入
        lib/prisma.ts
        lib/errors.ts                   # sendError / AppError
        lib/password.ts                 # argon2id hash/verify
        lib/session.ts                  # cookie + Session CRUD
        lib/rate-limit.ts               # 登录限流（内存 Map）
        lib/csrf.ts                     # Origin/Referer 白名单
        lib/rbac.ts                     # project role 检查
        lib/audit.ts
        storage/port.ts                 # StoragePort interface
        storage/local-fs.ts
        storage/cos-stub.ts             # 接口预留
        routes/health.ts
        routes/auth.ts
        routes/platform.ts
        routes/projects.ts
        routes/assets.ts
        routes/venues.ts
        routes/public.ts
      test/...                          # node:test 或 vitest
    admin/
      package.json
      Dockerfile                        # nginx:alpine 托管 dist
      vite.config.ts                    # base: '/admin/'
      index.html
      src/main.tsx
      src/App.tsx
      src/api/client.ts                 # fetch credentials:include
      src/pages/Login.tsx
      src/pages/Projects.tsx
      src/pages/ProjectMembers.tsx
      src/pages/Assets.tsx
      src/pages/Venues.tsx
      src/pages/VenueEditor.tsx
      src/pages/platform/Tenants.tsx
      src/components/DraftPreview.tsx
    viewer/
      package.json
      Dockerfile
      vite.config.ts                    # base: '/v/'；alias TvT
      index.html
      src/main.tsx
      src/App.tsx
      src/pages/VenuePage.tsx
      src/pages/Unavailable.tsx
      src/runtime/PanoramaRuntime.tsx
      src/runtime/Scene3dRuntime.tsx
      src/runtime/useWebXr.ts
  deploy/gpu001/
    docker-compose.yml
    nginx/default.conf
    .env.example
  .gitea/workflows/deploy-gpu001.yml
```

---

### Task 1: Yarn workspace + `apps/api` health

**Files:**
- Modify: `package.json`（根，增加 `workspaces`）
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/lib/errors.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/test/health.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `buildApp(): Promise<FastifyInstance>`；`GET /health` → `{ "ok": true }`（后续 Task 可扩展 `db` 字段）

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/test/health.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

describe('GET /health', () => {
  it('returns ok json', async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && yarn node --import tsx --test test/health.test.ts`  
Expected: FAIL（`buildApp` 或模块不存在）

- [ ] **Step 3: Root workspace + minimal Fastify app**

根 `package.json` 增加（保留既有 scripts/deps）：

```json
"workspaces": ["apps/*"]
```

`apps/api/package.json`：

```json
{
  "name": "@dtv/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "tsx --test test/**/*.test.ts",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "fastify": "^5.2.1",
    "@fastify/cookie": "^11.0.2",
    "@fastify/multipart": "^9.0.3",
    "@fastify/rate-limit": "^10.2.2",
    "@prisma/client": "^6.5.0",
    "argon2": "^0.41.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "prisma": "^6.5.0",
    "tsx": "^4.19.3",
    "typescript": "5.9.2",
    "@types/node": "^22.13.10"
  }
}
```

`apps/api/src/lib/errors.ts`：

```ts
import type { FastifyReply } from 'fastify';

export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_error'
  | 'conflict'
  | 'rate_limited'
  | 'internal_error';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

export function sendError(reply: FastifyReply, err: AppError) {
  return reply.code(err.statusCode).send({
    error: { code: err.code, message: err.message },
  });
}
```

`apps/api/src/routes/health.ts`：

```ts
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true }));
}
```

`apps/api/src/app.ts`：

```ts
import Fastify, { type FastifyServerOptions } from 'fastify';
import { healthRoutes } from './routes/health.js';
import { AppError, sendError } from './lib/errors.js';

export async function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return sendError(reply, err);
    app.log.error(err);
    return sendError(
      reply,
      new AppError('internal_error', '服务暂时不可用', 500),
    );
  });
  await app.register(healthRoutes);
  return app;
}
```

`apps/api/src/index.ts`：

```ts
import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const app = await buildApp({ logger: true });
await app.listen({ port, host: '0.0.0.0' });
```

`apps/api/tsconfig.json`：`module`/`moduleResolution` NodeNext，`outDir` dist，`rootDir` src，`strict` true。

- [ ] **Step 4: Install + run test**

Run: `yarn install`（仓库根）然后 `cd apps/api && yarn test`  
Expected: PASS `GET /health`

- [ ] **Step 5: Commit**

```bash
git add package.json apps/api yarn.lock
git commit -m "feat(dtv): scaffold apps/api with /health"
```

---

### Task 2: Admin React shell（`basename=/admin`）

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/vite.config.ts`
- Create: `apps/admin/index.html`
- Create: `apps/admin/src/main.tsx`
- Create: `apps/admin/src/App.tsx`
- Create: `apps/admin/nginx.conf`（容器内静态）
- Create: `apps/admin/Dockerfile`

**Interfaces:**
- Consumes: 无
- Produces: 构建产物 `apps/admin/dist`，Vite `base: '/admin/'`；路由占位「展馆管理」

- [ ] **Step 1: Scaffold Vite React TS + Ant Design**

`apps/admin/package.json` name `@dtv/admin`；deps：`react` `react-dom` `react-router-dom` `antd`；dev：`vite` `@vitejs/plugin-react` `typescript`。

`apps/admin/vite.config.ts`：

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: { host: true, port: 5173 },
});
```

`apps/admin/src/App.tsx`：

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';

export function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/" element={<div>展馆管理</div>} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
```

- [ ] **Step 2: Dockerfile（nginx alpine 托管 dist）**

多阶段：`node:22-alpine` yarn build → `nginx:alpine` COPY dist 到 `/usr/share/nginx/html`，`nginx.conf` 含 `try_files $uri /index.html` 且注意资产前缀 `/admin/`（可将 dist 放到 `/usr/share/nginx/html/admin/` 或 nginx `location /admin/` alias）。

推荐：build 时 `base: '/admin/'`，容器内 root 为 dist，nginx：

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  location /admin/ {
    alias /usr/share/nginx/html/;
    try_files $uri $uri/ /index.html;
  }
  location = /admin { return 302 /admin/; }
}
```

（若 alias+try_files 踩坑，改为把文件放到 `html/admin/` 且 `location /admin/` root 标准 SPA。）

- [ ] **Step 3: 本地 build 烟测（用户允许验证时）**

Run: `cd apps/admin && yarn build`  
Expected: `dist/index.html` 存在且资源路径以 `/admin/` 开头

- [ ] **Step 4: Commit**

```bash
git add apps/admin
git commit -m "feat(dtv): scaffold admin SPA with /admin base"
```

---

### Task 3: Viewer React shell（`/v/:publicId`）

**Files:**
- Create: `apps/viewer/package.json`
- Create: `apps/viewer/vite.config.ts`
- Create: `apps/viewer/index.html`
- Create: `apps/viewer/src/main.tsx`
- Create: `apps/viewer/src/App.tsx`
- Create: `apps/viewer/src/pages/VenuePage.tsx`
- Create: `apps/viewer/Dockerfile` + `nginx.conf`

**Interfaces:**
- Consumes: 无
- Produces: `base: '/v/'`；路由 `/v/:publicId` 占位展示 `publicId`

- [ ] **Step 1: Scaffold**

`vite.config.ts`：`base: '/v/'`。

```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { VenuePage } from './pages/VenuePage';

export function App() {
  return (
    <BrowserRouter basename="/v">
      <Routes>
        <Route path="/:publicId" element={<VenuePage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

```tsx
// VenuePage.tsx
import { useParams } from 'react-router-dom';
export function VenuePage() {
  const { publicId } = useParams();
  return <div>访客展馆占位：{publicId}</div>;
}
```

注意：浏览器路径为 `/v/demo`；`basename="/v"` 时 route 为 `/:publicId`。nginx 入口侧统一 `/v/`。

- [ ] **Step 2: Dockerfile** 同 admin 模式，`location /v/`。

- [ ] **Step 3: Commit**

```bash
git add apps/viewer
git commit -m "feat(dtv): scaffold viewer SPA for /v/:publicId"
```

---

### Task 4: Compose + nginx + `.env.example` + 存储挂载

**Files:**
- Create: `deploy/gpu001/docker-compose.yml`
- Create: `deploy/gpu001/nginx/default.conf`
- Create: `deploy/gpu001/.env.example`
- Create: `apps/api/Dockerfile`

**Interfaces:**
- Consumes: Task 1–3 镜像构建上下文
- Produces: `-p dtv-saas` 五服务；仅 `18700:80`

- [ ] **Step 1: `.env.example`**

```env
HOST_PORT=18700
POSTGRES_USER=dtv
POSTGRES_PASSWORD=change-me
POSTGRES_DB=dtv
DATABASE_URL=postgresql://dtv:change-me@saas-db:5432/dtv
STORAGE_ROOT=/data
PUBLIC_BASE_URL=http://127.0.0.1:18700
NODE_ENV=production
SESSION_COOKIE_NAME=dtv_session
# COS 预留（可空）
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=
COS_REGION=
```

- [ ] **Step 2: `docker-compose.yml`**

```yaml
name: dtv-saas
services:
  saas-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - dtv_pg:/var/lib/postgresql/data
    networks: [dtv_saas_net]
    labels:
      com.joyx.project: dtv-saas
      com.joyx.stack: digital-twin-venue-saas
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 10

  saas-api:
    build: ../../apps/api
    environment:
      DATABASE_URL: ${DATABASE_URL}
      STORAGE_ROOT: ${STORAGE_ROOT}
      PUBLIC_BASE_URL: ${PUBLIC_BASE_URL}
      NODE_ENV: ${NODE_ENV}
      PORT: "3000"
    volumes:
      - /mnt/storage/dtv-saas:${STORAGE_ROOT:-/data}
    depends_on:
      saas-db:
        condition: service_healthy
    networks: [dtv_saas_net]
    labels:
      com.joyx.project: dtv-saas
      com.joyx.stack: digital-twin-venue-saas
    # 无 ports

  saas-admin:
    build: ../../apps/admin
    networks: [dtv_saas_net]
    labels:
      com.joyx.project: dtv-saas
      com.joyx.stack: digital-twin-venue-saas

  saas-viewer:
    build: ../../apps/viewer
    networks: [dtv_saas_net]
    labels:
      com.joyx.project: dtv-saas
      com.joyx.stack: digital-twin-venue-saas

  saas-nginx:
    image: nginx:1.27-alpine
    ports:
      - "${HOST_PORT:-18700}:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on: [saas-api, saas-admin, saas-viewer]
    networks: [dtv_saas_net]
    labels:
      com.joyx.project: dtv-saas
      com.joyx.stack: digital-twin-venue-saas
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/health"]
      interval: 10s
      timeout: 5s
      retries: 6

networks:
  dtv_saas_net:
    name: dtv_saas_net

volumes:
  dtv_pg:
```

- [ ] **Step 3: `nginx/default.conf`**

```nginx
upstream saas_api { server saas-api:3000; }
upstream saas_admin { server saas-admin:80; }
upstream saas_viewer { server saas-viewer:80; }

server {
  listen 80;
  client_max_body_size 200m;

  location /health {
    proxy_pass http://saas_api/health;
  }
  location /api/ {
    proxy_pass http://saas_api;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  location /auth/ {
    proxy_pass http://saas_api;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  location /public/ {
    proxy_pass http://saas_api;
  }
  location /platform/ {
    proxy_pass http://saas_api;
  }
  location /assets/ {
    proxy_pass http://saas_api;
  }
  location /admin/ {
    proxy_pass http://saas_admin;
    proxy_set_header Host $host;
  }
  location /v/ {
    proxy_pass http://saas_viewer;
    proxy_set_header Host $host;
  }
}
```

- [ ] **Step 4: `apps/api/Dockerfile`**

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN yarn install --production=false
COPY . .
RUN yarn prisma generate || true
RUN yarn build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app /app
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

（Prisma 未加前 `prisma generate` 可暂跳；Task 6 补齐后去掉 `|| true`。）

- [ ] **Step 5: 宿主机存储目录**

Run: `mkdir -p /mnt/storage/dtv-saas && touch /mnt/storage/dtv-saas/.keep`  
Expected: 目录可写

- [ ] **Step 6: Compose config 校验（用户允许时）**

Run: `docker compose -p dtv-saas -f deploy/gpu001/docker-compose.yml --env-file deploy/gpu001/.env.example config`  
Expected: 成功；`ports` 仅 nginx 含 `18700:80`（或 `${HOST_PORT}:80`）

- [ ] **Step 7: Commit**

```bash
git add deploy/gpu001 apps/api/Dockerfile
git commit -m "feat(dtv): add gpu001 compose, nginx, env example"
```

**M0 验收勾选：** `docs/spec/todos.md` M0 全勾；`milestones.md` M0。

---

### Task 5: Prisma 核心身份模型 + Session（M1）

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: migration via `prisma migrate dev`
- Modify: `apps/api/src/lib/prisma.ts`
- Modify: `apps/api/src/routes/health.ts`（可选探测 db）

**Interfaces:**
- Consumes: `DATABASE_URL`
- Produces: models `Tenant` `Member` `PlatformAdmin` `Project` `ProjectMember` `Session` `AuditLog`

- [ ] **Step 1: schema（节选关键）**

```prisma
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TenantStatus { active disabled }
enum ProjectRole { owner admin editor viewer }
enum ActorType { member platform_admin system }

model Tenant {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  slug      String   @unique
  status    TenantStatus @default(active)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  members   Member[]
  projects  Project[]
  @@map("tenants")
}

model Member {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @map("tenant_id") @db.Uuid
  email          String
  passwordHash   String   @map("password_hash")
  displayName    String   @map("display_name")
  isTenantOwner  Boolean  @default(false) @map("is_tenant_owner")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  projectMembers ProjectMember[]
  sessions       Session[]
  @@unique([tenantId, email])
  @@map("members")
}

model PlatformAdmin {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  sessions     Session[]
  @@map("platform_admins")
}

model Project {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  name      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  members   ProjectMember[]
  @@index([tenantId])
  @@map("projects")
}

model ProjectMember {
  id        String      @id @default(uuid()) @db.Uuid
  projectId String      @map("project_id") @db.Uuid
  memberId  String      @map("member_id") @db.Uuid
  role      ProjectRole
  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  member    Member      @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@unique([projectId, memberId])
  @@map("project_members")
}

model Session {
  id               String   @id @default(uuid()) @db.Uuid
  tokenHash        String   @unique @map("token_hash")
  memberId         String?  @map("member_id") @db.Uuid
  platformAdminId  String?  @map("platform_admin_id") @db.Uuid
  expiresAt        DateTime @map("expires_at")
  createdAt        DateTime @default(now()) @map("created_at")
  member           Member?  @relation(fields: [memberId], references: [id], onDelete: Cascade)
  platformAdmin    PlatformAdmin? @relation(fields: [platformAdminId], references: [id], onDelete: Cascade)
  @@map("sessions")
}

model AuditLog {
  id           String    @id @default(uuid()) @db.Uuid
  tenantId     String?   @map("tenant_id") @db.Uuid
  actorType    ActorType @map("actor_type")
  actorId      String?   @map("actor_id") @db.Uuid
  action       String
  resourceType String    @map("resource_type")
  resourceId   String    @map("resource_id")
  metaJson     Json      @default("{}") @map("meta_json")
  createdAt    DateTime  @default(now()) @map("created_at")
  @@map("audit_logs")
}
```

- [ ] **Step 2: Migrate**

Run: `cd apps/api && yarn prisma migrate dev --name m1_identity`  
Expected: 迁移成功；Client 可 generate

- [ ] **Step 3: `lib/prisma.ts` + health 可选 db**

```ts
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
```

Health 可改为尝试 `prisma.$queryRaw\`SELECT 1\``，失败仍 503 `{ ok:false }`——与 nginx healthcheck 对齐时保持简单 `{ok:true}` 也可，但 compose api healthcheck 建议查 db。

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma apps/api/src/lib/prisma.ts
git commit -m "feat(dtv): prisma identity, session, audit models"
```

---

### Task 6: 认证 `/auth/*` + 限流 + CSRF（ADR0001）

**Files:**
- Create: `apps/api/src/lib/password.ts`
- Create: `apps/api/src/lib/session.ts`
- Create: `apps/api/src/lib/csrf.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/test/auth.test.ts`
- Modify: `apps/api/src/app.ts`（注册 cookie、auth）

**Interfaces:**
- Consumes: `Member` `PlatformAdmin` `Session`；env `PUBLIC_BASE_URL`（解析允许 Origin）
- Produces:
  - `hashPassword(pw: string): Promise<string>`
  - `verifyPassword(hash, pw): Promise<boolean>`
  - `createSession({ memberId?, platformAdminId? }): Promise<rawToken>`
  - `POST /auth/login` `{ email, password, tenantSlug }`
  - `POST /auth/platform/login` `{ email, password }`
  - `POST /auth/logout`
  - `GET /auth/me`
  - Cookie `dtv_session`

- [ ] **Step 1: Failing tests**

```ts
// auth.test.ts 关键用例
// 1) 错误密码 → 401 unauthorized
// 2) 正确成员登录 → 200 + set-cookie dtv_session；GET /auth/me 200
// 3) logout 后 /auth/me → 401
// 4) 短时间多次错误登录 → 429 rate_limited
```

种子：测试 `before` 用 prisma 建 Tenant+Member（argon2 hash）。

- [ ] **Step 2: password + session**

```ts
// password.ts
import argon2 from 'argon2';
export const hashPassword = (p: string) =>
  argon2.hash(p, { type: argon2.argon2id });
export const verifyPassword = (hash: string, p: string) =>
  argon2.verify(hash, p);
```

```ts
// session.ts
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';

const COOKIE = process.env.SESSION_COOKIE_NAME ?? 'dtv_session';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

export async function createSession(input: {
  memberId?: string;
  platformAdminId?: string;
}) {
  const raw = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: {
      tokenHash: hashToken(raw),
      memberId: input.memberId,
      platformAdminId: input.platformAdminId,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  return raw;
}

export { COOKIE, TTL_MS };
```

滑动续期：鉴权中间件命中有效 session 时 `expiresAt = now+TTL`。

- [ ] **Step 3: 登录限流**

使用 `@fastify/rate-limit` 仅挂在 login 两条路由：例如 `max: 20, timeWindow: '1 minute'`（按 IP）。超限抛 `AppError('rate_limited', '尝试过于频繁，请稍后再试', 429)`。

- [ ] **Step 4: CSRF**

写操作（非 GET）校验 `Origin` 或 `Referer` host 等于 `PUBLIC_BASE_URL` 的 host（含端口）。缺省/不匹配 → 403 `forbidden`。登录本身可豁免或同样校验。

- [ ] **Step 5: 实现路由并使测试通过**

登录失败写 `AuditLog`：`action=auth.login_failed`。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "feat(dtv): cookie session auth per ADR0001"
```

确认 `docs/spec/adrs/0001-auth-mechanism.md` Status 仍为 Accepted，实现与 Decision 表一致。

---

### Task 7: `/platform/tenants` 代建 + `/api/projects` RBAC

**Files:**
- Create: `apps/api/src/lib/rbac.ts`
- Create: `apps/api/src/lib/audit.ts`
- Create: `apps/api/src/routes/platform.ts`
- Create: `apps/api/src/routes/projects.ts`
- Create: `apps/api/test/platform-projects.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Consumes: session 鉴权装饰器 `requireMember` / `requirePlatformAdmin`
- Produces:
  - `POST /platform/tenants` body `{ name, slug, ownerEmail, ownerPassword, ownerDisplayName }`
  - `GET/PATCH /platform/tenants`
  - `GET/POST /api/projects` …
  - `…/members` CRUD；改 role 写 AuditLog
  - 跨租户资源 → 403 `forbidden`

- [ ] **Step 1: RBAC helper**

```ts
export const roleAtLeast: Record<ProjectRole, number> = {
  viewer: 1, editor: 2, admin: 3, owner: 4,
};
export function assertRole(have: ProjectRole, need: ProjectRole) {
  if (roleAtLeast[have] < roleAtLeast[need]) {
    throw new AppError('forbidden', '权限不足', 403);
  }
}
```

查询项目时 **强制** `project.tenantId === session.member.tenantId`。

- [ ] **Step 2: Tests** — 超管代建；成员建项目；viewer PATCH 403；其它租户 ID 403。

- [ ] **Step 3: Implement + pass tests + commit**

```bash
git commit -m "feat(dtv): platform tenants and project RBAC APIs"
```

---

### Task 8: Admin 登录页 + 项目列表（接真实 API）

**Files:**
- Create: `apps/admin/src/api/client.ts`
- Create: `apps/admin/src/pages/Login.tsx`
- Create: `apps/admin/src/pages/Projects.tsx`
- Create: `apps/admin/src/auth/AuthGate.tsx`
- Modify: `apps/admin/src/App.tsx`

**Interfaces:**
- Consumes: `/auth/login` `/auth/me` `/api/projects`
- Produces: 未登录访问任意页 → `/admin/login?next=`；登录后回跳

- [ ] **Step 1: client**

```ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw Object.assign(new Error(body?.error?.message ?? '请求失败'), {
      status: res.status,
      code: body?.error?.code,
    });
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Login + AuthGate + Projects 列表（Ant Form/Table）**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(dtv): admin login and project list"
```

**M1 验收勾选**（含 ADR 与 AuditLog 登录失败用例）。

---

### Task 9: Prisma 内容模型（Asset / Venue / Track / Hotspot / Tour / Publication）

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration `m2_content`

**Interfaces:**
- Produces: 枚举与表对齐 `docs/spec/data-model.md`（含 `VenueTrack.isPrimary`、`Publication.publicId` unique、`snapshot` Json）

- [ ] **Step 1: 按 data-model 追加 models**（字段名 map snake_case；UUID；物理删 cascade 按文档）

- [ ] **Step 2: `yarn prisma migrate dev --name m2_content`**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(dtv): prisma content and publication models"
```

---

### Task 10: StoragePort + Assets API

**Files:**
- Create: `apps/api/src/storage/port.ts`
- Create: `apps/api/src/storage/local-fs.ts`
- Create: `apps/api/src/storage/cos-stub.ts`
- Create: `apps/api/src/routes/assets.ts`
- Create: `apps/api/test/assets.test.ts`

**Interfaces:**

```ts
export interface StoragePort {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
```

- `LocalFsAdapter` root = `STORAGE_ROOT`；key = `tenants/{tenantId}/projects/{projectId}/{uuid}-{filename}`
- `CosAdapter`：方法抛 `501` 或 no-op 文档化预留
- `POST /api/projects/:projectId/assets` multipart → 写库含 `mime` `byteSize` `sha256` `storageKey`
- `DELETE`：先删文件再删行（文件失败则 500 且不删行，或记补偿；计划采用：**先删文件成功再删 DB**）

- [ ] **Step 1–4: TDD 上传/列表/删除 + 断言磁盘无文件 + commit**

```bash
git commit -m "feat(dtv): local storage port and assets API"
```

---

### Task 11: Venue + VenueTrack + Hotspot + Tour APIs

**Files:**
- Create: `apps/api/src/routes/venues.ts`
- Create: `apps/api/test/venues.test.ts`

**Interfaces:**
- 对齐 `docs/spec/api.md` §5.4
- 同一 venue **仅一条** `isPrimary=true`（事务内切换）
- 删除非 primary track 允许；删 primary 须先改 primary 或 409
- Hotspot/Tour 挂 `trackId`；随 venue/track cascade

- [ ] **Step 1–4: TDD + implement + commit**

```bash
git commit -m "feat(dtv): venue tracks hotspots tours CRUD"
```

---

### Task 12: Admin 资产库 + 展馆编辑页 + 内嵌草稿预览

**Files:**
- Create: `apps/admin/src/pages/Assets.tsx`
- Create: `apps/admin/src/pages/Venues.tsx`
- Create: `apps/admin/src/pages/VenueEditor.tsx`
- Create: `apps/admin/src/components/DraftPreview.tsx`
- Modify: `apps/admin/src/App.tsx` 路由表（见 admin-viewer.md）

**Interfaces:**
- Consumes: assets/venues/tracks/hotspots/tours 草稿 API（credentials）
- Produces: 表单+列表编辑（无拖拽画布）；`DraftPreview` iframe 或同页精简 runtime 调 `GET /api/venues/:id`

- [ ] **Step 1: 路由挂载** `/projects/:projectId/assets|venues|venues/:venueId|members`

- [ ] **Step 2: Assets 上传（`FormData` + `fetch` credentials）列表删除**

- [ ] **Step 3: VenueEditor — 轨/热点/导览 Ant Table+Modal 表单；primary 单选**

- [ ] **Step 4: DraftPreview — 登录态拉草稿 JSON，按 track_kind 分支占位（全景/3D 可先文字；M3 换成真 runtime）**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(dtv): admin assets and venue editor with draft preview"
```

**M2 验收勾选。**

---

### Task 13: Publish / Unpublish + 公开 API

**Files:**
- Create: `apps/api/src/services/publish.ts`
- Modify: `apps/api/src/routes/venues.ts`（或独立 `routes/publications.ts`）
- Create: `apps/api/src/routes/public.ts`
- Create: `apps/api/test/publish.test.ts`

**Interfaces:**
- `publishVenue(venueId)`：组装 snapshot（venue+tracks+hotspots+tours+asset refs）；若与最新 published 快照 deep-equal → **不增 version**，返回现有；否则 `version+1`、`status=published`、`publicId` 若空则生成 `nanoid/uuid` 短码
- `unpublish`：已 unpublished 仍 200
- `GET /public/venues/:publicId`：仅 `published`；否则 **404**（无细节）
- AuditLog：`venue.publish` / `venue.unpublish`
- 删 Venue：若仍有 published → 409 `conflict`

- [ ] **Step 1–4: TDD 幂等 + 404 + commit**

```bash
git commit -m "feat(dtv): publish snapshot and public venue API"
```

---

### Task 14: Viewer 接公开 API + 统一下架页 + 全景轨

**Files:**
- Modify: `apps/viewer/src/pages/VenuePage.tsx`
- Create: `apps/viewer/src/pages/Unavailable.tsx`
- Create: `apps/viewer/src/runtime/PanoramaRuntime.tsx`
- Modify: `apps/viewer/package.json`（加 `@photo-sphere-viewer/core` 及样式）

**Interfaces:**
- `GET /public/venues/:publicId`；非 200 → 文案 **「展馆已下架或不可用」**
- primary 或 `?track=` 选轨；`panorama` → PSV

```tsx
// Unavailable.tsx
export function Unavailable() {
  return <main style={{ padding: 24 }}>展馆已下架或不可用</main>;
}
```

```tsx
// PanoramaRuntime — 挂载 PSV Viewer 到 ref，dispose on unmount
```

- [ ] **Step 1–3: Implement + 手工冒烟（用户允许时打开 `/v/{publicId}`）+ commit**

```bash
git commit -m "feat(dtv): viewer public load and panorama runtime"
```

---

### Task 15: Viewer 3D 轨（TvT 别名）+ hybrid `?track=` + WebXR 按钮

**Files:**
- Modify: `apps/viewer/vite.config.ts`（alias 到仓库 `src/` 或约定入口）
- Create: `apps/viewer/src/runtime/Scene3dRuntime.tsx`
- Create: `apps/viewer/src/runtime/useWebXr.ts`
- Modify: `apps/viewer/src/pages/VenuePage.tsx`

**Interfaces:**
- `scene3d`：同仓别名加载场景包 URL（来自 snapshot `entry_asset` 公开资产路径）；**禁止** iframe `preview.vue`
- hybrid：切轨 UI 写 `?track=`；刷新保持
- `useWebXr()`：`navigator.xr?.isSessionSupported('immersive-vr')`；仅支持时显示「进入 VR」

```ts
// vite.config.ts 示例
resolve: {
  alias: {
    '@tvt': path.resolve(__dirname, '../../src'),
  },
},
```

实现时按仓库实际可 import 的引擎入口收敛（若入口过重，先做「可加载 scene_package URL 的最小 Three/Tres 壳」并在注释标明后续换正式 TvT bootstrap；**不得**用案例 Fes 壳冒充）。

- [ ] **Step 1–4: Implement + commit**

```bash
git commit -m "feat(dtv): viewer 3d/hybrid tracks and WebXR gate"
```

- [ ] **Step 5: 手机窄屏冒烟（用户允许时）** — DevTools 375px 可打开并浏览已发布馆

**M3 验收勾选。**

---

### Task 16: Gitea Actions CD + env 清单 + port-map

**Files:**
- Create: `.gitea/workflows/deploy-gpu001.yml`
- Modify: `deploy/gpu001/.env.example`（对照补齐 ADR 相关键，已含则核对）
- Note: ops-hub port-map 在 `~/ops-hub`（**另一仓**）登记 `18700 = dtv-saas nginx`

**Interfaces:**
- push **`master`** → gpu001 runner：checkout → `docker compose -p dtv-saas -f deploy/gpu001/docker-compose.yml up -d --build` → `prisma migrate deploy`（api 容器或 oneshot）
- **不做** backup job、**不做** curl 清单

```yaml
# .gitea/workflows/deploy-gpu001.yml 骨架
name: deploy-gpu001
on:
  push:
    branches: [master]
jobs:
  deploy:
    runs-on: ubuntu-latest  # 按 gitea-act-runner 实际 label 调整
    steps:
      - uses: actions/checkout@v4
      - name: Compose up
        run: |
          set -euo pipefail
          test -f deploy/gpu001/.env
          docker compose -p dtv-saas -f deploy/gpu001/docker-compose.yml --env-file deploy/gpu001/.env up -d --build
          docker compose -p dtv-saas -f deploy/gpu001/docker-compose.yml --env-file deploy/gpu001/.env exec -T saas-api npx prisma migrate deploy
```

（若 runner label 非 `ubuntu-latest`，按 joy-x 现网改 `runs-on`。）

- [ ] **Step 1: 工作流进仓**

- [ ] **Step 2: 生产 `.env` 键 ⊆ `.env.example` 清单文档化核对**

- [ ] **Step 3: 确认 `docker ps` 本栈仅 18700 映射（用户允许时）**

- [ ] **Step 4: 在 ops-hub 登记 port-map（无密钥；按 ops-hub-writer skill）**

- [ ] **Step 5: 可选回滚笔记** — 短记「检出上一 commit + compose up」到 `docs/spec/` 或 ops-hub logs（非备份专章）

- [ ] **Step 6: Commit（本仓部分）**

```bash
git add .gitea/workflows/deploy-gpu001.yml deploy/gpu001
git commit -m "feat(dtv): gitea actions deploy for dtv-saas"
```

**M4 验收勾选。**

---

## Self-Review

**1. Spec coverage**

| Spec 项 | Task |
| --- | --- |
| M0 脚手架/单端口/标签/health | 1–4 |
| ADR0001 Cookie Session argon2id 限流 | 6 |
| 代建租户 / 项目 RBAC / AuditLog | 7–8 |
| Asset+VenueTrack 双轨编辑/物理删文件 | 9–12 |
| publish 幂等 / public 404 / Viewer PSV+TvT+XR+手机 | 13–15 |
| Gitea CD / env / port-map / 无第二端口 | 16 |
| 非目标（计费/小程序/Redis/preview-token） | Global Constraints（不实现） |

**2. Placeholder scan：** 已避免 TBD；TvT 3D 入口若仓库过重，Task 15 允许最小壳但禁止 iframe 案例壳——执行时以可漫游为准并回写 alias 真实路径。

**3. Type consistency：** Cookie `dtv_session`；错误体形状；角色枚举 `owner|admin|editor|viewer`；health `/health`；compose project `dtv-saas` 全文一致。

---

## 勾选同步（实现完成时）

每完成对应 Task，勾选 `docs/spec/todos.md` 同行与 `docs/spec/milestones.md` 的 Mx。
