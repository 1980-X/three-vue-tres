export type MeshSubmitInput = {
  prompt?: string;
  imageUrl?: string;
};

export type MeshPollResult = {
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  glbUrl?: string;
  errorMessage?: string;
};

export interface MeshProviderPort {
  submit(input: MeshSubmitInput): Promise<{ remoteTaskId: string }>;
  poll(remoteTaskId: string): Promise<MeshPollResult>;
}
