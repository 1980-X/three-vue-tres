import type { AiProviderKind, AiProviderConfig } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { apiKeyLast4, decryptSecret, encryptSecret } from '../lib/secret-box.js';
import { AppError } from '../lib/errors.js';

export type PublicProvider = {
  id: string;
  kind: AiProviderKind;
  vendor: string;
  name: string;
  baseUrl: string;
  models: string[];
  enabled: boolean;
  isDefault: boolean;
  apiKeyLast4: string;
};

function modelsOf(row: AiProviderConfig): string[] {
  const raw = row.modelsJson;
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

export function toPublic(row: AiProviderConfig): PublicProvider {
  let last4 = '****';
  try {
    last4 = apiKeyLast4(decryptSecret(row.apiKeyEnc));
  } catch {
    last4 = '****';
  }
  return {
    id: row.id,
    kind: row.kind,
    vendor: row.vendor,
    name: row.name,
    baseUrl: row.baseUrl,
    models: modelsOf(row),
    enabled: row.enabled,
    isDefault: row.isDefault,
    apiKeyLast4: last4,
  };
}

export async function listProviders(kind?: AiProviderKind) {
  const rows = await prisma.aiProviderConfig.findMany({
    where: kind ? { kind } : undefined,
    orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toPublic);
}

export async function createProvider(input: {
  kind: AiProviderKind;
  vendor: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  enabled?: boolean;
  isDefault?: boolean;
}) {
  if (input.isDefault) {
    await prisma.aiProviderConfig.updateMany({
      where: { kind: input.kind, isDefault: true },
      data: { isDefault: false },
    });
  }
  const row = await prisma.aiProviderConfig.create({
    data: {
      kind: input.kind,
      vendor: input.vendor,
      name: input.name,
      baseUrl: input.baseUrl,
      apiKeyEnc: encryptSecret(input.apiKey),
      modelsJson: input.models,
      enabled: input.enabled ?? true,
      isDefault: input.isDefault ?? false,
    },
  });
  return toPublic(row);
}

export async function updateProvider(
  id: string,
  patch: {
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    models?: string[];
    enabled?: boolean;
    isDefault?: boolean;
    vendor?: string;
  },
) {
  const existing = await prisma.aiProviderConfig.findUnique({ where: { id } });
  if (!existing) throw new AppError('not_found', '配置不存在', 404);
  if (patch.isDefault) {
    await prisma.aiProviderConfig.updateMany({
      where: { kind: existing.kind, isDefault: true },
      data: { isDefault: false },
    });
  }
  const row = await prisma.aiProviderConfig.update({
    where: { id },
    data: {
      name: patch.name,
      baseUrl: patch.baseUrl,
      vendor: patch.vendor,
      modelsJson: patch.models,
      enabled: patch.enabled,
      isDefault: patch.isDefault,
      ...(patch.apiKey ? { apiKeyEnc: encryptSecret(patch.apiKey) } : {}),
    },
  });
  return toPublic(row);
}

export async function deleteProvider(id: string) {
  try {
    await prisma.aiProviderConfig.delete({ where: { id } });
  } catch {
    throw new AppError('not_found', '配置不存在', 404);
  }
}

export async function getDecryptedProvider(id: string) {
  const row = await prisma.aiProviderConfig.findUnique({ where: { id } });
  if (!row) throw new AppError('not_found', '配置不存在', 404);
  return {
    row,
    apiKey: decryptSecret(row.apiKeyEnc),
    models: modelsOf(row),
  };
}
