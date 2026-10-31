# AI Mesh MCP / CLI（P5）

- 脚本：`apps/api/scripts/mcp-ai-mesh.mjs`（list-tools；HTTP 调同一 Tool 契约）
- 环境变量名：`AI_MESH_MCP_TOKEN`、`AI_MESH_API_BASE`（默认 `http://127.0.0.1:18700`）
- **禁止**把真实 Token 写入本文件或 Git
- 业务逻辑不得在 MCP 进程内复制；须打 api

后续可将 stdio MCP JSON-RPC 接到 Cursor；一期以 CLI 清单与契约对齐为准。
