import type {
  ChatMessage,
  ChatWithToolsInput,
  ChatWithToolsResult,
  ToolCall,
} from './types.js';

function mockChat(input: ChatWithToolsInput): ChatWithToolsResult {
  const last = [...input.messages].reverse().find((m) => m.role === 'user');
  const text = (last?.content ?? '').toLowerCase();
  const hasThreeTool = input.tools.some((t) => t.function.name === 'threejs_draft');
  if (hasThreeTool && (text.includes('threejs') || text.includes('草模') || text.includes('展台'))) {
    const toolCall: ToolCall = {
      id: 'mock_tc_1',
      type: 'function',
      function: {
        name: 'threejs_draft',
        arguments: JSON.stringify({
          sceneGraph: {
            version: 1,
            nodes: [
              {
                id: 'box1',
                primitive: 'box',
                position: [0, 0.5, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                color: '#4a90d9',
              },
            ],
          },
        }),
      },
    };
    return {
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [toolCall],
      },
      toolCalls: [toolCall],
    };
  }
  return {
    message: {
      role: 'assistant',
      content: '（MOCK_LLM）已收到。可描述草模或说「threejs 展台」。',
    },
  };
}

async function fetchOnce(
  url: string,
  apiKey: string,
  body: unknown,
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
}

export async function chatWithTools(
  input: ChatWithToolsInput,
): Promise<ChatWithToolsResult> {
  if (process.env.MOCK_LLM === '1') {
    return mockChat(input);
  }

  const base = input.baseUrl.replace(/\/$/, '');
  const url = `${base}/chat/completions`;
  const payload = {
    model: input.model,
    messages: input.messages,
    tools: input.tools.length ? input.tools : undefined,
    tool_choice: input.tools.length ? 'auto' : undefined,
  };

  let res = await fetchOnce(url, input.apiKey, payload);
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 400));
    res = await fetchOnce(url, input.apiKey, payload);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`llm_upstream_${res.status}:${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: ChatMessage }>;
  };
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error('llm_empty_response');
  }
  const toolCalls = message.tool_calls?.length ? message.tool_calls : undefined;
  return { message, toolCalls };
}
