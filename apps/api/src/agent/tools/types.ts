export type ToolContext = {
  tenantId: string;
  projectId: string;
  sessionId: string;
  memberId?: string;
};

export type ToolResult = Record<string, unknown>;

export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: unknown, ctx: ToolContext) => Promise<ToolResult>;
};
