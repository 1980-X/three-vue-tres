# Design: AI 出模 Agent 工作台（展馆 Admin）

- **Date:** 2026-10-31  
- **Status:** Approved in brainstorming（§1–§5）  
- **Parent product:** Digital Twin Venue SaaS（`apps/api` / `apps/admin` / `apps/viewer` + `deploy/gpu001`）  
- **Engine context:** TvT.js；仓内 `hunyuan3D` 插件仅为本地 GLB 材质演示，**未**接通混元生 3D API

## Decision summary

| 主题 | 决定 |
| --- | --- |
| 挂载面 | 展馆 Admin（`:18700`）内嵌工作台；非先做 TvT 插件页 |
| 方案 | **R**：Chat 编排 + 双轨出模（厂商网格 + Three.js） |
| LLM「同时」 | 多家可并存配置；**一次对话只用当前选中的一家**；与 3D 厂商配置分离 |
| 国内 LLM | 智谱 / Kimi / DeepSeek + 自定义 OpenAI 兼容代理（`baseUrl`） |
| 一期产物 | **GLB 为主**；场景 JSON schema **预留**（Viewer 一期不强制解释执行） |
| 3D 厂商 | 混元生 3D **直连** + 适配器接口预留多家 |
| Three.js | **一期必上**：JSON scene graph → Node headless Three → GLTFExporter → GLB |
| 密钥 | 平台超管在 Admin 配置；服务端加密存储；不进 Git / 不进浏览器 |
| 详规范围 | P1–P5 均写入本文；实施按阶段勾选 |
| 非目标 | 浏览器 `eval` 任意模型 JS；Blender/桌面 MCP 主路径；租户自助 Key 计费；一期自动多 LLM 赛马/静默切换 |

## Clarification:「代理模型能否直接用 Three.js 生成模型？」

可以，但含义必须拆开：

1. **Chat/代理（智谱/Kimi/DS/中转）** 只负责对话与 tool calling，**不**自带网格生成。  
2. **轨 B**：模型产出**受限 JSON scene graph** → 服务端沙箱用 Three.js **构建并导出 GLB**（一期必做）。  
3. **轨 A**：混元等专用生 3D API 异步出 GLB（与 Chat 模型无关；代理若转发的是混元 HTTP，属于厂商适配，不是「LLM 写 Three」）。

禁止把「配一个 LLM 代理」理解成自动获得混元级写实资产；写实走轨 A，程序化草模走轨 B。

## Approach chosen

**方案 R（推荐并已批准）**，否决：

- **S**：纯 LLM 写 Three、不接混元 — 安全差、难当展馆主资产。  
- **T**：LLM 仅润色 prompt、只接混元 — Agent 过弱，且不满足「一期必须上 Three.js」。

## Architecture

```text
Admin UI（对话 / 选 LLM / 预览 GLB / 入库 / 挂馆）
    │  SSE + Cookie dtv_session + CSRF
saas-api
    ├─ LlmProviderRegistry
    ├─ AgentRuntime（tool loop）
    ├─ ToolRegistry
    │     ├─ mesh_submit / mesh_poll     【轨 A】
    │     ├─ threejs_draft               【轨 B · 一期必上】
    │     ├─ asset_import
    │     └─ venue_attach（可薄）
    ├─ ThreejsDraftSandbox（JSON → Three → GLB）
    └─ MeshProvider adapters（Hunyuan + 预留）
PG（配置密文、agent 会话、mesh_jobs、audit）
/mnt/storage/dtv-saas（GLB 临时区 + Asset 正式区）
```

- 不新增宿主机端口；仍仅 `18700 → saas-nginx`。  
- 密钥与上游调用仅在 api 容器。  
- P5 MCP/CLI 复用同一 Tool 实现，不复制业务逻辑。

## Components

### LlmProviderRegistry

- 字段语义：`provider`（`zhipu` | `kimi` | `deepseek` | `openai_compatible`）、`baseUrl`、加密 `apiKey`、`models[]`、`enabled`、`isDefault`。  
- 3D 厂商另表（或同表 `kind=llm|mesh` 强类型区分）；**禁止**与 LLM 行混用同一 apiKey 字段语义不清。

### AgentRuntime

- 表：`agent_sessions`、`agent_messages`（绑定 `tenantId` / `projectId` / 操作者）。  
- 循环：messages → Gateway → `tool_calls` → 执行 → 回灌；步数上限（建议 8）。  
- 对 Admin：**SSE** 推 token 增量、tool 起止、任务进度、结束事件（`previewUrl` / `assetId` / 错误码）。

### ToolRegistry（一期）

| Tool | 输入 | 输出 | 约束 |
| --- | --- | --- | --- |
| `mesh_submit` | prompt 和/或 imageUrl 等 | taskId | 鉴权后调用适配器 |
| `mesh_poll` | taskId | status + 可选 glbTempUrl | 仅本人会话任务 |
| `threejs_draft` | sceneGraph（JSON Schema） | glbTempUrl / 错误 | 校验 → 沙箱 → 导出 |
| `asset_import` | glbTempUrl + meta | assetId | 复用 StoragePort + RBAC |
| `venue_attach` | assetId + venue/track | ok | 同现网项目权限 |

### ThreejsDraftSandbox

- **默认输入：JSON scene graph**（primitive / transform / material 枚举），非自由 `.js`。  
- Node 侧 headless Three + GLTFExporter；无网络、无任意 `eval`、无动态 `import`；墙钟超时；节点/面数上限。  
- 只写指定临时目录；失败不创建 Asset。

### Admin UI

- 设置：多行 LLM + 多行 3D 厂商；测连通；Key 脱敏（末四位）。  
- 工作台：选模型、对话、任务列表、GLB 预览、入库/挂馆。

## Data flow

1. 超管配置 LLM/3D → api 加密落库 → 可选测连通。  
2. 成员开会话（带项目上下文）→ 发自然语言。  
3. Runtime 调当前 LLM；模型选择轨 A 或轨 B tools（或用户指定偏好）。  
4. 得到 `glbTempUrl` → 预览；可选 `asset_import` → 可选 `venue_attach`。  
5. Audit：配置变更、出模成功/失败、入库。

轨 A：`mesh_jobs` 持久化 task；一期允许请求内短轮询 + 前端续询。  
轨 B：Ajv（或等价）校验 graph → build → 临时 GLB。  
权限：Cookie Session + CSRF（含 localhost/127.0.0.1 环回互认）；tool **忽略**模型伪造的 tenantId，一律用会话上下文。

## Error handling & security

- Key：不进日志/SSE/Git；测连通失败不回显含 Key 的上游原文。  
- LLM：超时/429/5xx 可重试一次；失败不静默换厂商。  
- Tool：未知名拒绝；参数 schema；每会话重任务并发建议 1。  
- 轨 B：schema/限额/超时 → tool 错误回模型可修正；仍失败则 SSE 错误。  
- 降级：无 3D 厂商则禁用轨 A；无 LLM 则不可开聊；轨 B 仅依赖 LLM + 本地 Three。

## Testing

- api `node:test`：假上游 Gateway、schema 拒绝、固定 graph→GLB 魔数、权限、步数上限。  
- CI 默认 `MOCK_LLM=1` / `MOCK_MESH=1`；真 Key 仅手测。  
- Admin：关键路径手测；不做一期重型 E2E 框架。  
- 回归：`:18700` 单入口、标签 `com.joyx.project=dtv-saas`。

## Phased delivery（P1–P5 均属本期详规）

| 阶段 | 范围 | 验收 |
| --- | --- | --- |
| P1 | LLM Registry + 超管配置 UI + 测连通 | 三家可配并存；Key 脱敏 |
| P2 | AgentRuntime SSE + **轨 B Three.js** + 预览 | 无混元 Key 也能出草模 GLB |
| P3 | 轨 A 混元 + 适配器预留 + `mesh_jobs` | mock/真机出 GLB；可与 B 交替 |
| P4 | asset_import / 挂馆 / 工作台闭环 | 资源库可见并可挂 VenueTrack |
| P5 | MCP/CLI 薄封装同一 Tool | 无第二套业务逻辑 |

实施计划（writing-plans）可按 P1→P5 拆任务与可勾选 todo；**不得**把轨 B 整段推迟出一期范围之外。

## Success criteria

管理者在 Admin 配置国内多 LLM（及可选混元）→ 对话中 **Three.js 轨与混元轨都能**得到可预览 GLB → 可入库并在展馆侧选用；密钥不进前端与 Git；部署形态仍为单端口 `18700`。

## Next step

1. 用户审阅本文件。  
2. 认可后 invoke **writing-plans** 产出实现计划（建议路径：`docs/superpowers/plans/2026-10-31-ai-mesh-agent-workbench.md`），并视需要拆 `docs/spec/` 可勾选 milestones/todos。  
3. **批准前不落码、不脚手架。**

## Spec self-review

- 无 TBD：Three 输入形态钉 JSON graph；密钥存 PG 密文；一期不静默切 LLM。  
- 与展馆 ADR0001 / 单端口 / Asset 物理删一致，无矛盾。  
- 范围：单 design 含 P1–P5 详规；实现计划可分期，但轨 B 属 P2 硬性。  
- 「代理直接 Three 出模」已在文首澄清，避免与混元轨混淆。
