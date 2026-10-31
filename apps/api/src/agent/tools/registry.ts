import type { ToolSpec } from '../../llm/types.js';
import { AppError } from '../../lib/errors.js';
import { threejsDraftTool } from './threejs-draft.js';
import { meshSubmitTool } from './mesh-submit.js';
import { meshPollTool } from './mesh-poll.js';
import { assetImportTool } from './asset-import.js';
import { venueAttachTool } from './venue-attach.js';
import type { AgentTool, ToolContext, ToolResult } from './types.js';

const tools: AgentTool[] = [
  threejsDraftTool,
  meshSubmitTool,
  meshPollTool,
  assetImportTool,
  venueAttachTool,
];

export function listToolSpecs(): ToolSpec[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export async function executeTool(
  name: string,
  argsJson: string,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    throw new AppError('validation_error', `未知工具: ${name}`, 400);
  }
  let args: unknown = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    throw new AppError('validation_error', '工具参数 JSON 无效', 400);
  }
  return tool.execute(args, ctx);
}

export function registerTool(tool: AgentTool) {
  if (!tools.find((t) => t.name === tool.name)) tools.push(tool);
}
