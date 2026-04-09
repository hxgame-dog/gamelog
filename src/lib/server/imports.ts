import crypto from "node:crypto";

import { JobStatus, UploadSource } from "@prisma/client";
import { z } from "zod";

import { buildImportSummary as buildSharedImportSummary, type ImportSummary } from "../import-summary";
import { getPrismaClient, hasDatabaseUrl } from "./prisma";
import { getMemoryStore } from "./store";

const mappingSchema = z.object({
  source: z.string(),
  target: z.string()
});

const summarySchema = z.custom<ImportSummary>((value) => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ImportSummary>;
  return (
    typeof candidate.recordCount === "number" &&
    typeof candidate.successRate === "number" &&
    typeof candidate.errorCount === "number" &&
    typeof candidate.unmatchedEvents === "number" &&
    Array.isArray(candidate.topEvents) &&
    Array.isArray(candidate.metrics) &&
    !!candidate.categories &&
    !!candidate.overview
  );
}, "Invalid import summary");

const importSchema = z
  .object({
    projectId: z.string().min(1),
    trackingPlanId: z.string().min(1),
    version: z.string().min(1),
    fileName: z.string().min(1),
    source: z.enum(["REAL", "SYNTHETIC"]).default("REAL"),
    rows: z
      .array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])))
      .min(1)
      .optional(),
    rawHeaders: z.array(z.string()).optional(),
    summary: summarySchema.optional(),
    mappings: z.array(mappingSchema)
  })
  .refine((input) => Boolean(input.summary) || Boolean(input.rows?.length), {
    message: "rows or summary is required"
  });

type ImportRow = Record<string, string | number | boolean | null>;
type CategoryKey = "system" | "onboarding" | "level" | "monetization" | "ads" | "custom";
type RankedItem = { name: string; count: number; meta?: string };
type CategorySummary = {
  metrics: Record<string, number>;
  main: number[];
  aux: number[];
  auxLabels: string[];
  ranking: RankedItem[];
  insight: string;
};

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function toCountRanking(map: Map<string, number>, limit = 5): RankedItem[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function eventLooksSystem(eventName: string) {
  return /(app|session|login|logout|error|crash|install|launch|heartbeat|settings)/i.test(eventName);
}

function eventLooksOnboarding(eventName: string) {
  return /(tutorial|guide|ftue|onboarding|step)/i.test(eventName);
}

function eventLooksLevel(eventName: string) {
  return /(level|battle|stage|mission|round)/i.test(eventName);
}

function eventLooksMonetization(eventName: string) {
  return /(purchase|pay|iap|sku|order|paywall|offer|shop|revenue)/i.test(eventName);
}

function eventLooksAds(eventName: string) {
  return /(^|_)(ad|ads|reward(ed)?|interstitial|banner|placement|video)(_|$)/i.test(eventName);
}

function normalizeImportedEventName(eventName: string) {
  const normalized = eventName.trim().toLowerCase();

  switch (normalized) {
    case "af_ad_view":
      return "ad_impression";
    case "af_ad_click":
      return "ad_click";
    case "ad_reward_claim":
      return "ad_reward_claim";
    case "af_purchase":
      return "iap_success";
    case "af_initiated_checkout":
      return "iap_order_create";
    case "af_level_achieved":
      return "level_complete";
    case "af_tutorial_completion":
      return "tutorial_complete";
    case "tutoriallevel_start":
      return "tutorial_level_start";
    default:
      return normalized;
  }
}

function classifyRow(input: {
  eventName: string;
  levelId: string;
  stepId: string;
  placement: string;
  price: number | null;
}) {
  const { eventName, levelId, stepId, placement, price } = input;

  if (/(tutorial|camera_rotate|screw_interact|tutorial_level_start|tutorial_complete)/i.test(eventName)) {
    return "onboarding" as const;
  }

  if (price !== null && price > 0) {
    return "monetization" as const;
  }
  if (placement || eventLooksAds(eventName)) {
    return "ads" as const;
  }
  if (stepId || eventLooksOnboarding(eventName)) {
    return "onboarding" as const;
  }
  if (levelId || eventLooksLevel(eventName)) {
    return "level" as const;
  }
  if (eventLooksSystem(eventName)) {
    return "system" as const;
  }
  if (eventLooksMonetization(eventName)) {
    return "monetization" as const;
  }
  return "custom" as const;
}

function buildInsight(category: CategoryKey, summary: CategorySummary) {
  switch (category) {
    case "system":
      return summary.metrics.errorRate > 8
        ? "公共事件异常占比偏高，建议先核对 session 和 error 上报口径，再分析具体玩法模块。"
        : "公共事件层整体稳定，可以继续作为版本对比和其他分类分析的基线。";
    case "onboarding":
      return summary.metrics.completionRate < 55
        ? "新手引导完成率偏低，建议优先排查中段步骤的提示强度与交互反馈。"
        : "新手引导核心漏斗可读性较好，下一步适合细化关键步骤字段。";
    case "level":
      return summary.metrics.failRate > summary.metrics.completionRate
        ? "关卡失败率高于通关率，建议先查看失败原因和高失败关卡，而不是直接整体降难。"
        : "关卡主漏斗已经可用，后续更适合补齐失败原因和重试细节。";
    case "monetization":
      return summary.metrics.conversionRate < 5
        ? "商业化转化偏弱，建议回看付费入口事件是否完整，以及展示时机是否过晚。"
        : "商业化链路已经具备分析价值，可以开始对 SKU 和入口位做细分观察。";
    case "ads":
      return summary.metrics.completionRate < 60
        ? "广告完成率偏低，建议优先检查广告位触发时机和奖励承接逻辑。"
        : "广告完成和发奖链路整体稳定，可以进一步对比不同广告位表现。";
    default:
      return "自定义分类已有首批结构化结果，适合继续补齐字段语义和专项业务标签。";
  }
}

function buildImportSummary(rows: ImportRow[], mappings: Array<{ source: string; target: string }>): ImportSummary {
  return buildSharedImportSummary(rows, mappings);
}

export async function createLogImport(input: unknown) {
  const payload = importSchema.parse(input);
  const prisma = getPrismaClient();
  const summary = payload.summary ?? buildSharedImportSummary(payload.rows ?? [], payload.mappings);
  const rawHeaders = payload.rawHeaders ?? Object.keys(payload.rows?.[0] ?? {});

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const now = Date.now();
    const uploadId = crypto.randomUUID();

    store.logUploads.push({
      id: uploadId,
      fileName: payload.fileName,
      source: payload.source,
      version: payload.version,
      rawHeaders,
      fieldMappings: payload.mappings,
      summaryJson: summary,
      recordCount: summary.recordCount,
      successRate: summary.successRate,
      errorCount: summary.errorCount,
      unmatchedEvents: summary.unmatchedEvents,
      status: "COMPLETED",
      uploadedAt: now,
      projectId: payload.projectId,
      trackingPlanId: payload.trackingPlanId
    });

    store.metricSnapshots = store.metricSnapshots.filter(
      (item) => !(item.projectId === payload.projectId && item.version === payload.version)
    );

    summary.metrics.forEach((metric) => {
      store.metricSnapshots.push({
        id: crypto.randomUUID(),
        metricKey: metric.metricKey,
        metricLabel: metric.metricLabel,
        metricValue: metric.metricValue,
        dimension: metric.dimension,
        version: payload.version,
        capturedAt: now,
        projectId: payload.projectId
      });
    });

    return {
      id: uploadId,
      fileName: payload.fileName,
      status: "COMPLETED",
      uploadedAt: now,
      summary
    };
  }

  const upload = await prisma.logUpload.create({
    data: {
      fileName: payload.fileName,
      source: payload.source === "SYNTHETIC" ? UploadSource.SYNTHETIC : UploadSource.REAL,
      version: payload.version,
      rawHeaders,
      fieldMappings: payload.mappings,
      summaryJson: summary,
      recordCount: summary.recordCount,
      successRate: summary.successRate,
      errorCount: summary.errorCount,
      unmatchedEvents: summary.unmatchedEvents,
      status: JobStatus.COMPLETED,
      projectId: payload.projectId,
      trackingPlanId: payload.trackingPlanId
    }
  });

  await prisma.metricSnapshot.deleteMany({
    where: {
      projectId: payload.projectId,
      version: payload.version
    }
  });

  if (summary.metrics.length) {
    await prisma.metricSnapshot.createMany({
      data: summary.metrics.map((metric) => ({
        metricKey: metric.metricKey,
        metricLabel: metric.metricLabel,
        metricValue: metric.metricValue,
        dimension: metric.dimension,
        version: payload.version,
        projectId: payload.projectId
      }))
    });
  }

  return {
    id: upload.id,
    fileName: upload.fileName,
    status: upload.status,
    uploadedAt: upload.uploadedAt,
    summary
  };
}

export async function getLatestImportForProject(projectId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    return store.logUploads
      .filter((item) => item.projectId === projectId)
      .sort((a, b) => b.uploadedAt - a.uploadedAt)[0] ?? null;
  }

  return prisma.logUpload.findFirst({
    where: { projectId },
    orderBy: { uploadedAt: "desc" }
  });
}

export async function getImportsForProject(projectId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    return store.logUploads
      .filter((item) => item.projectId === projectId)
      .sort((a, b) => b.uploadedAt - a.uploadedAt);
  }

  return prisma.logUpload.findMany({
    where: { projectId },
    orderBy: { uploadedAt: "desc" }
  });
}

export async function getImportPreviewById(importId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const item = store.logUploads.find((entry) => entry.id === importId);
    if (!item) {
      return null;
    }

    const summary = (item.summaryJson ?? {}) as ImportSummary;
    return {
      id: item.id,
      fileName: item.fileName,
      version: item.version,
      source: item.source,
      rawHeaders: item.rawHeaders ?? [],
      fieldMappings: item.fieldMappings ?? [],
      previewRows: summary.previewRows ?? [],
      summary
    };
  }

  const item = await prisma.logUpload.findUnique({
    where: { id: importId }
  });

  if (!item) {
    return null;
  }

  const summary = (item.summaryJson ?? {}) as ImportSummary;
  return {
    id: item.id,
    fileName: item.fileName,
    version: item.version,
    source: item.source,
    rawHeaders: (item.rawHeaders as string[] | null) ?? [],
    fieldMappings:
      (item.fieldMappings as Array<{ source: string; target: string }> | null) ?? [],
    previewRows: summary.previewRows ?? [],
    summary
  };
}

export async function getMetricSnapshotsForProject(projectId: string, version?: string | null) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    return store.metricSnapshots
      .filter((item) => item.projectId === projectId && (version ? item.version === version : true))
      .sort((a, b) => b.capturedAt - a.capturedAt);
  }

  return prisma.metricSnapshot.findMany({
    where: {
      projectId,
      ...(version ? { version } : {})
    },
    orderBy: { capturedAt: "desc" }
  });
}
