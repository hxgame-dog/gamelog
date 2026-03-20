import { AiProvider } from "@prisma/client";
import { z } from "zod";

import { decryptSecret, encryptSecret, maskSecret } from "./encryption";
import { detectGeminiModels, pickDefaultGeminiModel } from "./gemini";
import { getPrismaClient, hasDatabaseUrl } from "./prisma";
import { getMemoryStore, type StoredAiConfig, type StoredModel } from "./store";

const configSchema = z.object({
  apiKey: z.string().min(10, "Gemini API Key 看起来不完整。"),
  defaultModel: z.string().optional().nullable()
});

export type AiConfigResponse = {
  provider: "GEMINI";
  storageMode: "database" | "memory";
  status: string;
  keyConfigured: boolean;
  maskedApiKey: string | null;
  defaultModel: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string | null;
  availableModels: StoredModel[];
};

function normalizeStoredConfig(config: StoredAiConfig | null | undefined): AiConfigResponse {
  const decrypted = decryptSecret(config?.encryptedApiKey);

  return {
    provider: "GEMINI",
    storageMode: hasDatabaseUrl() ? "database" : "memory",
    status: config?.status ?? "NOT_CONFIGURED",
    keyConfigured: Boolean(decrypted),
    maskedApiKey: maskSecret(decrypted),
    defaultModel: config?.defaultModel ?? null,
    lastVerifiedAt: config?.lastVerifiedAt ?? null,
    updatedAt: config?.updatedAt ?? null,
    availableModels: config?.models ?? []
  };
}

export async function getAiConfig() {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    return normalizeStoredConfig(getMemoryStore().aiConfig);
  }

  const config = await prisma.aiProviderConfig.findUnique({
    where: { provider: AiProvider.GEMINI },
    include: {
      models: {
        orderBy: [{ isDefault: "desc" }, { modelName: "asc" }]
      }
    }
  });

  return normalizeStoredConfig(
    config
      ? {
          provider: "GEMINI",
          encryptedApiKey: config.encryptedApiKey,
          status: config.status,
          defaultModel: config.defaultModel,
          lastVerifiedAt: config.lastVerifiedAt?.toISOString() ?? null,
          updatedAt: config.updatedAt.toISOString(),
          models: config.models.map((model) => ({
            modelName: model.modelName,
            displayName: model.displayName,
            isAvailable: model.isAvailable,
            isDefault: model.isDefault,
            supportedActions: model.supportedActions,
            detectedAt: model.detectedAt.toISOString()
          }))
        }
      : null
  );
}

export async function saveAiConfig(input: unknown) {
  const payload = configSchema.parse(input);
  const now = new Date().toISOString();
  const encryptedApiKey = encryptSecret(payload.apiKey);
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    store.aiConfig = {
      provider: "GEMINI",
      encryptedApiKey,
      status: "CONFIGURED",
      defaultModel: payload.defaultModel ?? store.aiConfig?.defaultModel ?? null,
      lastVerifiedAt: store.aiConfig?.lastVerifiedAt ?? null,
      updatedAt: now,
      models: store.aiConfig?.models ?? []
    };

    return normalizeStoredConfig(store.aiConfig);
  }

  await prisma.aiProviderConfig.upsert({
    where: { provider: AiProvider.GEMINI },
    update: {
      encryptedApiKey,
      status: "CONFIGURED",
      defaultModel: payload.defaultModel ?? undefined
    },
    create: {
      provider: AiProvider.GEMINI,
      encryptedApiKey,
      status: "CONFIGURED",
      defaultModel: payload.defaultModel ?? null
    }
  });

  return getAiConfig();
}

export async function detectAndPersistGeminiModels(apiKeyOverride?: string) {
  const prisma = getPrismaClient();
  const existing = await getAiConfig();

  const apiKey = apiKeyOverride
    ? apiKeyOverride
    : hasDatabaseUrl() && prisma
      ? decryptSecret(
          (
            await prisma.aiProviderConfig.findUnique({
              where: { provider: AiProvider.GEMINI }
            })
          )?.encryptedApiKey
        )
      : decryptSecret(getMemoryStore().aiConfig?.encryptedApiKey);

  if (!apiKey) {
    throw new Error("请先保存 Gemini API Key。");
  }

  const models = await detectGeminiModels(apiKey);
  const defaultModel = pickDefaultGeminiModel(models) ?? existing.defaultModel ?? null;
  const normalizedModels: StoredModel[] = models.map((model) => ({
    modelName: model.modelName,
    displayName: model.displayName,
    isAvailable: true,
    isDefault: model.modelName === defaultModel,
    supportedActions: model.supportedActions,
    detectedAt: new Date().toISOString()
  }));

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    store.aiConfig = {
      provider: "GEMINI",
      encryptedApiKey: store.aiConfig?.encryptedApiKey ?? encryptSecret(apiKey),
      status: "VERIFIED",
      defaultModel,
      lastVerifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      models: normalizedModels
    };

    return normalizeStoredConfig(store.aiConfig);
  }

  const providerConfig = await prisma.aiProviderConfig.upsert({
    where: { provider: AiProvider.GEMINI },
    update: {
      encryptedApiKey: encryptSecret(apiKey),
      status: "VERIFIED",
      defaultModel,
      lastVerifiedAt: new Date()
    },
    create: {
      provider: AiProvider.GEMINI,
      encryptedApiKey: encryptSecret(apiKey),
      status: "VERIFIED",
      defaultModel,
      lastVerifiedAt: new Date()
    }
  });

  await prisma.$transaction([
    prisma.aiModelRegistry.deleteMany({
      where: { providerConfigId: providerConfig.id }
    }),
    prisma.aiProviderConfig.update({
      where: { id: providerConfig.id },
      data: {
        models: {
          create: normalizedModels.map((model) => ({
            modelName: model.modelName,
            displayName: model.displayName,
            isAvailable: model.isAvailable,
            isDefault: model.isDefault,
            supportedActions: model.supportedActions,
            detectedAt: new Date(model.detectedAt)
          }))
        }
      }
    })
  ]);

  return getAiConfig();
}

export async function getGeminiRuntimeConfig() {
  const prisma = getPrismaClient();
  const config = await getAiConfig();

  const apiKey =
    hasDatabaseUrl() && prisma
      ? decryptSecret(
          (
            await prisma.aiProviderConfig.findUnique({
              where: { provider: AiProvider.GEMINI }
            })
          )?.encryptedApiKey
        )
      : decryptSecret(getMemoryStore().aiConfig?.encryptedApiKey);

  if (!apiKey) {
    throw new Error("Gemini API Key 未配置，请先到 AI 设置页面保存并检测模型。");
  }

  const model =
    config.defaultModel ??
    config.availableModels.find((item) => item.isDefault)?.modelName ??
    config.availableModels[0]?.modelName ??
    null;

  if (!model) {
    throw new Error("当前还没有可用的 Gemini 模型，请先检测模型。");
  }

  return {
    apiKey,
    model
  };
}

export async function clearAiConfig() {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    store.aiConfig = null;
    return normalizeStoredConfig(null);
  }

  const existing = await prisma.aiProviderConfig.findUnique({
    where: { provider: AiProvider.GEMINI }
  });

  if (existing) {
    await prisma.aiProviderConfig.delete({
      where: { provider: AiProvider.GEMINI }
    });
  }

  return normalizeStoredConfig(null);
}
