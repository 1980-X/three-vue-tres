# AI 出模 Agent — Todos（可勾选）

> 设计：[`../superpowers/specs/2026-10-31-ai-mesh-agent-workbench-design.md`](../superpowers/specs/2026-10-31-ai-mesh-agent-workbench-design.md)  
> 计划：[`../superpowers/plans/2026-10-31-ai-mesh-agent-workbench.md`](../superpowers/plans/2026-10-31-ai-mesh-agent-workbench.md)  
> **仅实现或验证完成才勾选。**

## P1 — LLM Registry

- [ ] Prisma `ai_provider_configs` + `secret-box` + `CREDENTIALS_ENCRYPTION_KEY`
- [ ] OpenAI 兼容 Gateway + `MOCK_LLM`
- [ ] ` /platform/ai/providers` CRUD + probe；Admin 设置页；Key 仅末四位

## P2 — Agent + Three.js（硬性）

- [ ] Scene graph zod + `ThreejsDraftSandbox` 导出 GLB（魔数单测）
- [ ] `AgentSession` / `AgentMessage` + Runtime SSE；tool `threejs_draft`
- [ ] Admin 工作台 + GLB 预览（无混元亦可出草模）

## P3 — 混元轨 A

- [ ] `MeshProviderPort` + Hunyuan + `MOCK_MESH`
- [ ] `mesh_jobs` + tools `mesh_submit` / `mesh_poll`

## P4 — 入库挂馆

- [ ] AssetKind `model_glb`（或计划钉死的等价）+ `asset_import`
- [ ] `venue_attach`；工作台闭环可见 Assets / 挂轨

## P5 — MCP（可选）

- [ ] Loopback Bearer + stdio MCP 调同一 HTTP/Tool；文档无密钥真值
