# AI 出模 Agent — Todos（可勾选）

> 设计：[`../superpowers/specs/2026-10-31-ai-mesh-agent-workbench-design.md`](../superpowers/specs/2026-10-31-ai-mesh-agent-workbench-design.md)  
> 计划：[`../superpowers/plans/2026-10-31-ai-mesh-agent-workbench.md`](../superpowers/plans/2026-10-31-ai-mesh-agent-workbench.md)  
> **仅实现或验证完成才勾选。**

## P1 — LLM Registry

- [x] Prisma `ai_provider_configs` + `secret-box` + `CREDENTIALS_ENCRYPTION_KEY`
- [x] OpenAI 兼容 Gateway + `MOCK_LLM`
- [x] `/platform/ai/providers` CRUD + probe；Admin 设置页；Key 仅末四位

## P2 — Agent + Three.js（硬性）

- [x] Scene graph zod + `ThreejsDraftSandbox` 导出 GLB（魔数单测）
- [x] `AgentSession` / `AgentMessage` + Runtime SSE；tool `threejs_draft`
- [x] Admin 工作台 + GLB 预览（无混元亦可出草模）

## P3 — 混元轨 A

- [x] `MeshProviderPort` + Hunyuan + `MOCK_MESH`
- [x] `mesh_jobs` + tools `mesh_submit` / `mesh_poll`

## P4 — 入库挂馆

- [x] AssetKind `model_glb` + `asset_import`
- [x] `venue_attach`；工作台入口已挂项目列表（入库经 Agent tool）

## P5 — MCP（可选）

- [x] CLI `mcp-ai-mesh.mjs` list-tools + `docs/spec/ai-mesh-mcp.md`（HTTP/Token 契约；完整 JSON-RPC 可后续）
