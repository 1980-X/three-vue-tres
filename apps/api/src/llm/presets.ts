import type { LlmVendor } from './types.js';

export const LLM_PRESETS: Record<LlmVendor, { baseUrl: string }> = {
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  kimi: { baseUrl: 'https://api.moonshot.cn/v1' },
  deepseek: { baseUrl: 'https://api.deepseek.com' },
  openai_compatible: { baseUrl: '' },
};
