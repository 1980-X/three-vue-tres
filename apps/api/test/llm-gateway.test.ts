import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chatWithTools } from '../src/llm/gateway.js';

describe('llm-gateway', () => {
  it('mock returns assistant text without upstream', async () => {
    process.env.MOCK_LLM = '1';
    const r = await chatWithTools({
      baseUrl: 'http://invalid.example',
      apiKey: 'x',
      model: 'mock',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [],
    });
    assert.equal(r.message.role, 'assistant');
    assert.ok(r.message.content);
  });

  it('mock emits threejs_draft tool call when prompted', async () => {
    process.env.MOCK_LLM = '1';
    const r = await chatWithTools({
      baseUrl: 'http://invalid.example',
      apiKey: 'x',
      model: 'mock',
      messages: [{ role: 'user', content: '做一个 threejs 展台' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'threejs_draft',
            description: 'draft',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
    });
    assert.ok(r.toolCalls?.length);
    assert.equal(r.toolCalls![0].function.name, 'threejs_draft');
  });
});
