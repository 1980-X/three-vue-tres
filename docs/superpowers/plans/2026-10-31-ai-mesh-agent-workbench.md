# AI 出模 Agent 工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在展馆 Admin（`:18700`）落地 AI 出模工作台：国内多 LLM 可配、Agent SSE tool loop、**轨 B Three.js JSON→GLB（一期必上）**、轨 A 混元（+适配器预留）、入库挂馆；P5 可选 MCP 复用同一 Tool。

**Architecture:** `saas-api` 内 LlmProviderRegistry + AgentRuntime + ToolRegistry + ThreejsDraftSandbox + MeshProvider；密钥 PG 密文；Admin 设置页与工作台；不新增宿主机端口。

**Tech Stack:** 现有 Fastify / Prisma / React+Ant / yarn workspaces；新增 `three`（api 侧导出）、`zod`/`ajv` 校验 scene graph；上游 OpenAI 兼容 Chat Completions + tools；混元生 3D HTTP 适配器；SSE。

**Design 真源：** [`docs/superpowers/specs/2026-10-31-ai-mesh-agent-workbench-design.md`](../specs/2026-10-31-ai-mesh-agent-workbench-design.md)。可勾选进度：`docs/spec/milestones.md`（AI Mesh P1–P5）与 `docs/spec/todos-ai-mesh.md`。

**执行说明：** AGENTS.md 禁止 Agent 擅自 `yarn build|dev`；验收命令写在步骤中，**仅当用户本回合允许验证时执行**，否则改码后说明「已跳过 build/debug 验证」。默认 `MOCK_LLM=1` / `MOCK_MESH=1` 跑单测。

## Global Constraints

- 宿主机仅 **`18700→saas-nginx`**；标签 `com.joyx.project=dtv-saas`。
- 认证：Cookie **`dtv_session`** + CSRF（localhost/127.0.0.1/::1 同端口互认）；错误体 `{ error: { code, message } }` 中文 message。
- 密钥不进 Git / 不进 SSE / 不进前端完整回显；Admin 仅末四位。
- 一次对话只用一家 LLM；不静默切换厂商。
- 轨 B：**JSON scene graph → builder**，禁止浏览器/`eval` 任意 JS。
- Tool 内 **忽略** 模型传入的 tenantId；一律用 session 上下文。
- 轨 B 属 **P2 硬性**，不得整段推迟出一期。
- 不做：Blender 桌面链主路径、租户自助 Key 计费、多 LLM 赛马、一期 Viewer 解释执行 scene JSON。

---

## File Structure

```text
apps/api/
  prisma/schema.prisma              # + ProviderConfig / AgentSession / AgentMessage / MeshJob
  prisma/migrations/..._ai_mesh/
  src/
    lib/secret-box.ts               # AES-GCM 加解密 apiKey（钥来自 CREDENTIALS_ENCRYPTION_KEY）
    llm/
      types.ts                      # LlmProviderKind, ChatMessage, ToolSpec
      registry.ts                   # CRUD + decrypt for runtime
      gateway.ts                    # OpenAI-compatible chat+tools；MOCK_LLM
      presets.ts                    # zhipu/kimi/deepseek 默认 baseUrl
    agent/
      runtime.ts                    # tool loop + SSE writer
      tools/types.ts
      tools/registry.ts
      tools/threejs-draft.ts
      tools/mesh-submit.ts
      tools/mesh-poll.ts
      tools/asset-import.ts
      tools/venue-attach.ts
    mesh/
      types.ts                      # MeshProviderPort
      hunyuan.ts                    # 直连；MOCK_MESH
      index.ts                      # resolve provider by config
    threejs/
      scene-graph.ts                # zod schema + limits
      sandbox.ts                    # build Object3D + GLTFExporter → Buffer
    routes/
      platform-ai.ts                # 超管：LLM/mesh 配置 CRUD + probe
      agent.ts                      # sessions + SSE chat
  test/
    secret-box.test.ts
    llm-gateway.test.ts
    threejs-sandbox.test.ts
    agent-runtime.test.ts
    mesh-adapter.test.ts
    platform-ai.test.ts
apps/admin/src/
  pages/platform/AiProviders.tsx    # LLM + mesh 配置
  pages/AiWorkbench.tsx            # 对话 + 预览
  components/GlbPreview.tsx
  App.tsx                           # 路由
deploy/gpu001/.env.example          # + CREDENTIALS_ENCRYPTION_KEY MOCK_*
docs/spec/todos-ai-mesh.md
docs/spec/milestones.md             # + AI Mesh P1–P5
apps/api/scripts/mcp-ai-mesh.mjs    # P5：stdio MCP 调同一 tool 实现（薄）
```

---

## P1 — LLM Registry + 超管配置

### Task 1: Prisma 配置表 + secret-box

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/lib/secret-box.ts`
- Create: `apps/api/test/secret-box.test.ts`
- Modify: `deploy/gpu001/.env.example`

**Interfaces:**
- Produces: `encryptSecret(plain: string): string`, `decryptSecret(blob: string): string`；模型 `AiProviderConfig`

- [ ] **Step 1: 扩展 schema**

在 `schema.prisma` 追加：

```prisma
enum AiProviderKind {
  llm
  mesh
}

enum LlmVendor {
  zhipu
  kimi
  deepseek
  openai_compatible
}

enum MeshVendor {
  hunyuan
  stub
}

model AiProviderConfig {
  id           String         @id @default(uuid()) @db.Uuid
  kind         AiProviderKind
  vendor       String
  name         String
  baseUrl      String         @map("base_url")
  apiKeyEnc    String         @map("api_key_enc")
  modelsJson   Json           @default("[]") @map("models_json")
  enabled      Boolean        @default(true)
  isDefault    Boolean        @default(false) @map("is_default")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  @@index([kind, enabled])
  @@map("ai_provider_configs")
}
```

- [ ] **Step 2: 写失败单测 + 实现 secret-box**

```ts
// test/secret-box.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret } from '../src/lib/secret-box.js';

describe('secret-box', () => {
  it('roundtrips', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const enc = encryptSecret('sk-test');
    assert.notEqual(enc, 'sk-test');
    assert.equal(decryptSecret(enc), 'sk-test');
  });
});
```

```ts
// lib/secret-box.ts — AES-256-GCM；key = SHA-256(env) 或 raw 32-byte base64
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

function keyBuf() {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error('CREDENTIALS_ENCRYPTION_KEY missing');
  const b = Buffer.from(raw, 'base64');
  return b.length === 32 ? b : createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyBuf(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptSecret(blob: string) {
  const buf = Buffer.from(blob, 'base64url');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const d = createDecipheriv('aes-256-gcm', keyBuf(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}
```

- [ ] **Step 3: migration**

Run（用户允许验证时）: `cd apps/api && yarn prisma migrate dev --name ai_provider_configs`  
Expected: migration 应用成功。

- [ ] **Step 4: `.env.example` 增加**

```
CREDENTIALS_ENCRYPTION_KEY= # 32-byte base64；openssl rand -base64 32
MOCK_LLM=1
MOCK_MESH=1
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma apps/api/src/lib/secret-box.ts apps/api/test/secret-box.test.ts deploy/gpu001/.env.example
git commit -m "feat(dtv-ai): provider config schema and secret-box"
```

---

### Task 2: LLM Gateway（OpenAI 兼容 + MOCK）

**Files:**
- Create: `apps/api/src/llm/types.ts`, `presets.ts`, `gateway.ts`
- Create: `apps/api/test/llm-gateway.test.ts`

**Interfaces:**
- Produces: `chatWithTools(input: { baseUrl, apiKey, model, messages, tools }): Promise<{ message, toolCalls? }>`
- Consumes: 无 DB

- [ ] **Step 1: 失败单测（MOCK）**

```ts
it('mock returns assistant text without upstream', async () => {
  process.env.MOCK_LLM = '1';
  const r = await chatWithTools({
    baseUrl: 'http://invalid',
    apiKey: 'x',
    model: 'mock',
    messages: [{ role: 'user', content: 'hi' }],
    tools: [],
  });
  assert.equal(r.message.role, 'assistant');
  assert.ok(r.message.content);
});
```

- [ ] **Step 2: 实现 gateway**

`MOCK_LLM=1` 时：若 messages 最后一条含「threejs」关键字则返回假 `tool_calls:[{name:'threejs_draft',...}]`，否则纯文本。  
非 mock：`POST ${baseUrl}/chat/completions`，`tools` 为 OpenAI function 格式；解析 `choices[0].message`；超时 60s；429/5xx 重试 1 次。

- [ ] **Step 3: presets**

```ts
export const LLM_PRESETS = {
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  kimi: { baseUrl: 'https://api.moonshot.cn/v1' },
  deepseek: { baseUrl: 'https://api.deepseek.com' },
  openai_compatible: { baseUrl: '' },
} as const;
```

- [ ] **Step 4: 跑测 + Commit**

```bash
cd apps/api && yarn test test/llm-gateway.test.ts
git commit -m "feat(dtv-ai): openai-compatible llm gateway with mock"
```

---

### Task 3: 超管配置 API + Admin 设置页

**Files:**
- Create: `apps/api/src/routes/platform-ai.ts`
- Modify: `apps/api/src/app.ts`（register）
- Create: `apps/api/test/platform-ai.test.ts`
- Create: `apps/admin/src/pages/platform/AiProviders.tsx`
- Modify: `apps/admin/src/App.tsx`（路由 `/platform/ai-providers`）

**Interfaces:**
- `GET/POST /platform/ai/providers`；`PATCH/DELETE /platform/ai/providers/:id`；`POST /platform/ai/providers/:id/probe`
- 列表项：`{ id, kind, vendor, name, baseUrl, models, enabled, isDefault, apiKeyLast4 }`（无完整 Key）

- [ ] **Step 1: 路由实现要点**

```ts
// POST body
z.object({
  kind: z.enum(['llm', 'mesh']),
  vendor: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  models: z.array(z.string()).default([]),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});
// requirePlatformAdmin；encryptSecret；若 isDefault 则同 kind 其它行 isDefault=false
// probe: decrypt → MOCK 或短 chat/models；失败 AppError provider_error 中文
```

- [ ] **Step 2: 单测** — 非超管 401/403；创建后 GET 无 `apiKey` 字段有 `apiKeyLast4`。

- [ ] **Step 3: Admin 页** — Ant Design Table + Modal 表单；测连通按钮；路由仅超管入口（与 Tenants 同级链接）。

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(dtv-ai): platform AI provider CRUD and admin settings"
```

**P1 验收勾选：** `docs/spec/todos-ai-mesh.md` P1 项。

---

## P2 — AgentRuntime + 轨 B Three.js（硬性）

### Task 4: scene graph schema + ThreejsDraftSandbox

**Files:**
- Create: `apps/api/src/threejs/scene-graph.ts`, `sandbox.ts`
- Create: `apps/api/test/threejs-sandbox.test.ts`
- Modify: `apps/api/package.json`（依赖 `three` + `@types/three`）

**Interfaces:**
- Produces: `parseSceneGraph(input: unknown): SceneGraph`；`exportSceneGraphToGlb(graph: SceneGraph): Promise<Buffer>`
- Limits: `maxNodes=32`，`maxAnyBox=50`（单位任意），primitive ∈ `box|sphere|cylinder|plane`

- [ ] **Step 1: zod schema**

```ts
const Node = z.object({
  id: z.string().min(1).max(64),
  primitive: z.enum(['box', 'sphere', 'cylinder', 'plane']),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  scale: z.tuple([z.number(), z.number(), z.number()]).default([1, 1, 1]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#888888'),
});
export const SceneGraphSchema = z.object({
  version: z.literal(1),
  nodes: z.array(Node).min(1).max(32),
});
```

- [ ] **Step 2: sandbox**

用 `three` 建 `Scene`，按 primitive `Mesh` + `MeshStandardMaterial`，`GLTFExporter.parse` 得 ArrayBuffer → `Buffer`。墙钟 `AbortSignal` 5s。捕获未知字段已由 zod 剥除。

- [ ] **Step 3: 单测**

```ts
it('exports glb magic', async () => {
  const buf = await exportSceneGraphToGlb({
    version: 1,
    nodes: [{ id: 'a', primitive: 'box', position: [0,0,0], rotation:[0,0,0], scale:[1,1,1], color:'#ff0000' }],
  });
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'glTF');
});
it('rejects too many nodes', () => {
  assert.throws(() => parseSceneGraph({ version: 1, nodes: Array.from({length: 40}, (_,i)=>({id:String(i), primitive:'box'})) }));
});
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(dtv-ai): threejs scene-graph sandbox exports glb"
```

---

### Task 5: Agent 表 + Runtime SSE + threejs_draft tool

**Files:**
- Modify: `apps/api/prisma/schema.prisma`（AgentSession / AgentMessage）
- Create: `apps/api/src/agent/**`
- Create: `apps/api/src/routes/agent.ts`
- Create: `apps/api/test/agent-runtime.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- `POST /api/projects/:projectId/agent/sessions` → `{ id }`
- `POST /api/projects/:projectId/agent/sessions/:id/messages` → **SSE**  
  events: `token` | `tool_start` | `tool_end` | `preview` | `error` | `done`
- Tool `threejs_draft`: args `{ sceneGraph }` → 写 temp key `tmp/agent/{sessionId}/{uuid}.glb` via StoragePort → `{ glbTempKey, previewPath: "/api/.../preview?key=" }`

- [ ] **Step 1: Prisma**

```prisma
model AgentSession {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @map("tenant_id") @db.Uuid
  projectId       String   @map("project_id") @db.Uuid
  llmProviderId   String   @map("llm_provider_id") @db.Uuid
  model           String
  createdByMemberId String? @map("created_by_member_id") @db.Uuid
  createdByPlatformAdminId String? @map("created_by_platform_admin_id") @db.Uuid
  createdAt       DateTime @default(now()) @map("created_at")
  messages        AgentMessage[]
  @@index([projectId])
  @@map("agent_sessions")
}

model AgentMessage {
  id        String   @id @default(uuid()) @db.Uuid
  sessionId String   @map("session_id") @db.Uuid
  role      String
  content   Json
  createdAt DateTime @default(now()) @map("created_at")
  session   AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId])
  @@map("agent_messages")
}
```

- [ ] **Step 2: Runtime（伪代码钉死行为）**

```ts
for (let step = 0; step < 8; step++) {
  const out = await chatWithTools({...messages, tools: enabledTools});
  if (!out.toolCalls?.length) { sse.token(out.message.content); break; }
  for (const call of out.toolCalls) {
    sse.tool_start(call.name);
    const result = await registry.execute(call.name, call.args, ctx); // ctx 含 tenantId/projectId from session
    sse.tool_end(call.name, result);
    messages.push({ role: 'assistant', tool_calls: [...] }, { role: 'tool', content: JSON.stringify(result) });
    if (result.glbTempKey) sse.preview(result);
  }
}
sse.done();
```

P2 **仅注册** `threejs_draft`（轨 A 未就绪时不要注册 mesh_*）。

- [ ] **Step 3: 单测** — MOCK_LLM 触发 threejs_draft → 响应含 glbTempKey；伪造其它 tenant 的 sessionId → 403。

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(dtv-ai): agent runtime SSE and threejs_draft tool"
```

---

### Task 6: Admin 工作台 + GLB 预览

**Files:**
- Create: `apps/admin/src/pages/AiWorkbench.tsx`, `components/GlbPreview.tsx`
- Modify: `apps/admin/src/App.tsx`（`/projects/:projectId/ai`）
- Modify: `apps/admin/src/pages/Projects.tsx`（入口链接）
- Create: preview GET（若尚未有）`GET /api/projects/:projectId/agent/tmp-preview?key=` 流式 GLB（鉴权）

**Interfaces:**
- 前端 `EventSource` 或 `fetch`+ReadableStream 解析 SSE；`GlbPreview` 用原生 `<model-viewer>` 或 three 简单加载 blob URL。

- [ ] **Step 1–3: 页面能发消息、显示 tool 轨迹、预览 GLB（MOCK 即可）**
- [ ] **Step 4: Commit** `feat(dtv-ai): admin AI workbench with glb preview`

**P2 验收：** 未配混元也能对话出草模 GLB。

---

## P3 — 轨 A 混元 + mesh_jobs

### Task 7: MeshProviderPort + Hunyuan + MOCK

**Files:**
- Create: `apps/api/src/mesh/types.ts`, `hunyuan.ts`, `index.ts`
- Create: `apps/api/test/mesh-adapter.test.ts`

**Interfaces:**
- `MeshProviderPort { submit(input): Promise<{ remoteTaskId }>; poll(remoteTaskId): Promise<{ status, glbUrl? }> }`
- `MOCK_MESH=1`：submit 返回 `mock-task`；poll 第二次返回 status=succeeded + 内置最小 GLB data URL/本地 fixture。

- [ ] **Step 1: 接口 + mock 单测通过**
- [ ] **Step 2: hunyuan.ts** — 用配置中 `baseUrl`/Key 调官方 Submit/Query（实现时对照腾讯云当前 Action 名）；错误映射 `mesh_provider_error`。
- [ ] **Step 3: Commit** `feat(dtv-ai): mesh provider port and hunyuan mock`

---

### Task 8: mesh_jobs + mesh_submit/poll tools

**Files:**
- Modify: `schema.prisma` + `MeshJob` 模型
- Create: `apps/api/src/agent/tools/mesh-submit.ts`, `mesh-poll.ts`
- Modify: tool registry（有 enabled mesh 配置时注册）

```prisma
model MeshJob {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @map("tenant_id") @db.Uuid
  projectId     String   @map("project_id") @db.Uuid
  sessionId     String?  @map("session_id") @db.Uuid
  providerId    String   @map("provider_id") @db.Uuid
  remoteTaskId  String   @map("remote_task_id")
  status        String
  glbTempKey    String?  @map("glb_temp_key")
  errorMessage  String?  @map("error_message")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  @@index([sessionId])
  @@map("mesh_jobs")
}
```

- [ ] **Step 1: submit 写 MeshJob；poll 成功则下载 GLB 到 StoragePort temp**
- [ ] **Step 2: 单测 mock 全流程**
- [ ] **Step 3: Commit** `feat(dtv-ai): mesh_submit and mesh_poll tools`

**P3 验收：** MOCK 下 Agent 可走轨 A；与轨 B 可交替（模型或用户指定）。

---

## P4 — 入库 / 挂馆闭环

### Task 9: asset_import + venue_attach tools

**Files:**
- Create: `apps/api/src/agent/tools/asset-import.ts`, `venue-attach.ts`
- Modify: registry；可选复用 `routes/assets.ts` 内部服务函数（抽出 `createAssetFromBuffer`）

**Interfaces:**
- `asset_import({ glbTempKey, title })` → `{ assetId }`；`kind` 建议 `scene_package` 或新增 `model_glb`（若改 enum 需 migration；**推荐一期用 `other` + title 前缀 `[ai-glb]`** 避免扩 enum 争议，或显式加 `model_glb`——**钉死：新增 AssetKind `model_glb`**）。
- `venue_attach({ assetId, venueId, trackId? })` → 更新 track `entryAssetId` 或等价字段（对照现 `VenueTrack`）。

- [ ] **Step 1: 读现网 VenueTrack 字段，按真实字段写 attach**
- [ ] **Step 2: 单测权限 + 物理文件存在**
- [ ] **Step 3: Admin 工作台按钮「入库」「挂到展馆」调同一 REST 或继续经 Agent**
- [ ] **Step 4: Commit** `feat(dtv-ai): import glb asset and attach to venue track`

**P4 验收：** Assets 列表可见；可挂 scene3d 轨。

---

## P5 — MCP/CLI 薄封装

### Task 10: stdio MCP 调同一 registry

**Files:**
- Create: `apps/api/scripts/mcp-ai-mesh.mjs`（或 `src/mcp/server.ts` 编译后跑）
- Create: `docs/spec/ai-mesh-mcp.md`（如何在 Cursor 配 mcp；**无密钥进文档示例真值**）

**Interfaces:**
- MCP tools 名称与 Agent 相同：`threejs_draft`、`mesh_submit`、`mesh_poll`、`asset_import`；内部 `import` api 已编译模块或 HTTP 打本机 `saas-api`（**推荐 HTTP + 超管/服务账号 Cookie/Dev Header**，避免 MCP 进程绕过鉴权）。钉死：**MCP 经 `http://127.0.0.1:18700` + 预发 Session 不推荐；改用 `AI_MESH_MCP_TOKEN` 环境变量校验的 `Authorization: Bearer` 仅本机 loopback 中间件**。

- [ ] **Step 1: api 增加 `Authorization: Bearer` 仅当 `AI_MESH_MCP_TOKEN` 设置且 Host 为环回**
- [ ] **Step 2: MCP server list/call tools → HTTP**
- [ ] **Step 3: Commit** `feat(dtv-ai): optional MCP wrapper for mesh tools`

**P5 验收：** Cursor 能调 threejs_draft；无第二套沙箱逻辑。

---

## Spec 文档任务（与实现穿插，可最先做）

### Task 0: 可勾选 milestones / todos

**Files:**
- Create: `docs/spec/todos-ai-mesh.md`
- Modify: `docs/spec/milestones.md`（追加 AI Mesh 总览）
- Create: `docs/spec/ai-mesh-agent.md`（一页指针：链到 design + 本 plan）

- [ ] **Step 1: 写入 P1–P5 勾选条（与上表验收一致）**
- [ ] **Step 2: Commit** `docs(dtv-ai): milestones and todos for mesh agent workbench`

---

## Self-Review（对照 design）

| Design 项 | Task |
| --- | --- |
| LLM 多厂商配置 + 脱敏 + 测连通 | 1–3 |
| Agent SSE + tool loop | 5–6 |
| 轨 B JSON→Three→GLB 一期必上 | 4–6 |
| 轨 A 混元 + 预留 Port | 7–8 |
| asset / venue 闭环 | 9 |
| MCP 薄封装 | 10 |
| 单端口 / Cookie / 无静默切厂商 / 无 eval | Global Constraints |
| MOCK CI | 2,4,5,7 |

**Placeholder scan：** 无 TBD；混元具体 HTTP Action 名在 Task 7 实现时以腾讯云当前文档为准（适配器内集中，不散落）。  
**类型一致：** `glbTempKey`、`AiProviderConfig`、`SceneGraph.version=1` 全计划统一。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-31-ai-mesh-agent-workbench.md`.

**Two execution options:**

1. **Subagent-Driven（推荐）** — 每任务新开 subagent，任务间审查  
2. **Inline Execution** — 本会话按 executing-plans 批量推进并设检查点  

先执行 **Task 0（文档勾选）** 再 P1 亦可。

**Which approach?**
