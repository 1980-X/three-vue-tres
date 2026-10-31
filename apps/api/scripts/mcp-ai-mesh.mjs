#!/usr/bin/env node
/**
 * 薄 MCP：经本机 HTTP 调同一 Agent tools 入口（需环回 + Bearer）。
 * 环境变量：
 *   AI_MESH_MCP_TOKEN  — 与 api 侧一致
 *   AI_MESH_API_BASE   — 默认 http://127.0.0.1:18700
 *
 * 完整 MCP JSON-RPC 可后续接 SDK；本脚本提供 CLI 自检：
 *   node scripts/mcp-ai-mesh.mjs list-tools
 */
const base = (process.env.AI_MESH_API_BASE ?? 'http://127.0.0.1:18700').replace(/\/$/, '');
const token = process.env.AI_MESH_MCP_TOKEN ?? '';

const TOOLS = [
  'threejs_draft',
  'mesh_submit',
  'mesh_poll',
  'asset_import',
  'venue_attach',
];

async function main() {
  const cmd = process.argv[2] ?? 'list-tools';
  if (cmd === 'list-tools') {
    console.log(JSON.stringify({ tools: TOOLS, base, hasToken: Boolean(token) }, null, 2));
    return;
  }
  console.error('usage: mcp-ai-mesh.mjs list-tools');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
