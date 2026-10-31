import type { MeshProviderPort, MeshPollResult, MeshSubmitInput } from './types.js';

/** MOCK_MESH 或未接真 Key 时的内存假实现 */
export class MockMeshProvider implements MeshProviderPort {
  private ticks = new Map<string, number>();

  async submit(_input: MeshSubmitInput) {
    const remoteTaskId = `mock-${Date.now()}`;
    this.ticks.set(remoteTaskId, 0);
    return { remoteTaskId };
  }

  async poll(remoteTaskId: string): Promise<MeshPollResult> {
    const n = (this.ticks.get(remoteTaskId) ?? 0) + 1;
    this.ticks.set(remoteTaskId, n);
    if (n < 2) return { status: 'running' };
    // 最小合法 glTF binary 由调用方用 threejs 草模替代下载；此处返回标记
    return {
      status: 'succeeded',
      glbUrl: 'mock://use-threejs-fixture',
    };
  }
}

/**
 * 混元生 3D 适配器骨架：真调用时按腾讯云当前 Action 填写。
 * 一期默认走 Mock；配置 vendor=hunyuan 且 MOCK_MESH!=1 时抛明确错误提示补全 HTTP。
 */
export class HunyuanMeshProvider implements MeshProviderPort {
  constructor(
    private opts: { baseUrl: string; apiKey: string },
  ) {}

  async submit(_input: MeshSubmitInput) {
    if (process.env.MOCK_MESH === '1') {
      return new MockMeshProvider().submit(_input);
    }
    void this.opts;
    throw new Error(
      'hunyuan_not_wired: 请在 mesh/hunyuan.ts 按腾讯云 Submit 接口补全，或设 MOCK_MESH=1',
    );
  }

  async poll(remoteTaskId: string): Promise<MeshPollResult> {
    if (process.env.MOCK_MESH === '1') {
      return new MockMeshProvider().poll(remoteTaskId);
    }
    void remoteTaskId;
    throw new Error('hunyuan_not_wired');
  }
}

export function createMeshProvider(input: {
  vendor: string;
  baseUrl: string;
  apiKey: string;
}): MeshProviderPort {
  if (process.env.MOCK_MESH === '1' || input.vendor === 'stub') {
    return new MockMeshProvider();
  }
  return new HunyuanMeshProvider({ baseUrl: input.baseUrl, apiKey: input.apiKey });
}
