import crypto from "node:crypto";

import { JobStatus, UploadSource } from "@prisma/client";
import { z } from "zod";

import { getPrismaClient, hasDatabaseUrl } from "./prisma";
import { getMemoryStore } from "./store";

const importSchema = z.object({
  projectId: z.string().min(1),
  trackingPlanId: z.string().min(1),
  version: z.string().min(1),
  fileName: z.string().min(1),
  source: z.enum(["REAL", "SYNTHETIC"]).default("REAL"),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))).min(1),
  mappings: z.array(
    z.object({
      source: z.string(),
      target: z.string()
    })
  )
});

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildImportSummary(
  rows: Array<Record<string, string | number | boolean | null>>,
  mappings: Array<{ source: string; target: string }>
) {
  const activeMappings = mappings.filter((item) => item.target !== "ignore");
  const eventMapping = activeMappings.find((item) => item.target === "event_name");
  const resultMapping = activeMappings.find((item) => item.target === "result");
  const levelMapping = activeMappings.find((item) => item.target === "level_id");
  const stepMapping = activeMappings.find((item) => item.target === "step_id");
  const placementMapping = activeMappings.find((item) => item.target === "placement");
  const priceMapping = activeMappings.find((item) => item.target === "price");
  const durationMapping = activeMappings.find((item) => item.target === "duration_sec");
  const userMapping = activeMappings.find((item) => item.target === "user_id");
  const reasonMapping = activeMappings.find((item) => item.target === "reason");
  const rewardMapping = activeMappings.find((item) => item.target === "reward_type");

  let errorCount = 0;
  let unmatchedEvents = 0;
  let levelRows = 0;
  let levelSuccessRows = 0;
  let levelFailRows = 0;
  let onboardingRows = 0;
  let onboardingSuccessRows = 0;
  let onboardingDurationTotal = 0;
  let onboardingDurationCount = 0;
  let monetizationRows = 0;
  let monetizationValue = 0;
  let adRows = 0;
  let adSuccessRows = 0;
  let adRewardRows = 0;
  let systemRows = 0;
  const eventCounts = new Map<string, number>();
  const placementCounts = new Map<string, number>();
  const levelCounts = new Map<string, number>();
  const failReasonCounts = new Map<string, number>();
  const uniqueUsers = new Set<string>();
  const monetizationUsers = new Set<string>();

  rows.forEach((row) => {
    const eventName = eventMapping ? String(row[eventMapping.source] ?? "").trim() : "";
    const result = resultMapping ? String(row[resultMapping.source] ?? "").trim().toLowerCase() : "";
    const levelId = levelMapping ? String(row[levelMapping.source] ?? "").trim() : "";
    const stepId = stepMapping ? String(row[stepMapping.source] ?? "").trim() : "";
    const placement = placementMapping ? String(row[placementMapping.source] ?? "").trim() : "";
    const price = priceMapping ? safeNumber(row[priceMapping.source]) : null;
    const duration = durationMapping ? safeNumber(row[durationMapping.source]) : null;
    const userId = userMapping ? String(row[userMapping.source] ?? "").trim() : "";
    const reason = reasonMapping ? String(row[reasonMapping.source] ?? "").trim() : "";
    const rewardType = rewardMapping ? String(row[rewardMapping.source] ?? "").trim() : "";

    if (!eventName) {
      errorCount += 1;
      unmatchedEvents += 1;
      return;
    }

    eventCounts.set(eventName, (eventCounts.get(eventName) ?? 0) + 1);

    if (userId) {
      uniqueUsers.add(userId);
    }

    if (result === "fail" || result === "failed" || result === "error") {
      errorCount += 1;
    }

    if (levelId) {
      levelRows += 1;
      levelCounts.set(levelId, (levelCounts.get(levelId) ?? 0) + 1);
      if (result === "success" || result === "complete" || eventName.includes("complete")) {
        levelSuccessRows += 1;
      } else if (result === "fail" || result === "failed" || eventName.includes("fail")) {
        levelFailRows += 1;
        if (reason) {
          failReasonCounts.set(reason, (failReasonCounts.get(reason) ?? 0) + 1);
        }
      }
    }

    if (stepId) {
      onboardingRows += 1;
      if (result === "success" || result === "complete") {
        onboardingSuccessRows += 1;
      }
      if (duration !== null) {
        onboardingDurationTotal += duration;
        onboardingDurationCount += 1;
      }
    }

    if (price !== null && price > 0) {
      monetizationRows += 1;
      monetizationValue += price;
      if (userId) {
        monetizationUsers.add(userId);
      }
    }

    if (placement) {
      adRows += 1;
      placementCounts.set(placement, (placementCounts.get(placement) ?? 0) + 1);
      if (result === "success" || result === "complete") {
        adSuccessRows += 1;
      }
      if (rewardType) {
        adRewardRows += 1;
      }
    }

    if (!levelId && !stepId && !placement && (price === null || price <= 0)) {
      systemRows += 1;
    }
  });

  const recordCount = rows.length;
  const successRate = recordCount ? (recordCount - errorCount) / recordCount : 0;
  const onboardingCompletionRate = onboardingRows ? (onboardingSuccessRows / onboardingRows) * 100 : 0;
  const levelCompletionRate = levelRows ? (levelSuccessRows / levelRows) * 100 : 0;
  const levelFailRate = levelRows ? (levelFailRows / levelRows) * 100 : 0;
  const onboardingAvgDuration = onboardingDurationCount ? onboardingDurationTotal / onboardingDurationCount : 0;
  const adTriggerRate = recordCount ? (adRows / recordCount) * 100 : 0;
  const adCompletionRate = adRows ? (adSuccessRows / adRows) * 100 : 0;
  const adRewardRate = adRows ? (adRewardRows / adRows) * 100 : 0;
  const monetizationConversionRate = uniqueUsers.size
    ? (monetizationUsers.size / uniqueUsers.size) * 100
    : 0;
  const topEvents = [...eventCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const topPlacements = [...placementCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const topLevels = [...levelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const failReasons = [...failReasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    recordCount,
    successRate,
    errorCount,
    unmatchedEvents,
    metrics: [
      {
        metricKey: "active_users",
        metricLabel: "活跃用户数",
        metricValue: uniqueUsers.size,
        dimension: "system"
      },
      {
        metricKey: "system_event_count",
        metricLabel: "公共事件量",
        metricValue: systemRows,
        dimension: "system"
      },
      {
        metricKey: "import_success_rate",
        metricLabel: "导入通过率",
        metricValue: Number((successRate * 100).toFixed(2)),
        dimension: "overview"
      },
      {
        metricKey: "onboarding_reach_rate",
        metricLabel: "新手引导到达率",
        metricValue: recordCount ? Number(((onboardingRows / recordCount) * 100).toFixed(2)) : 0,
        dimension: "onboarding"
      },
      {
        metricKey: "onboarding_completion_rate",
        metricLabel: "新手引导完成率",
        metricValue: Number(onboardingCompletionRate.toFixed(2)),
        dimension: "onboarding"
      },
      {
        metricKey: "onboarding_drop_rate",
        metricLabel: "新手引导流失率",
        metricValue: Number(Math.max(0, 100 - onboardingCompletionRate).toFixed(2)),
        dimension: "onboarding"
      },
      {
        metricKey: "onboarding_avg_duration",
        metricLabel: "新手引导平均耗时",
        metricValue: Number(onboardingAvgDuration.toFixed(2)),
        dimension: "onboarding"
      },
      {
        metricKey: "level_start_rate",
        metricLabel: "关卡开局率",
        metricValue: recordCount ? Number(((levelRows / recordCount) * 100).toFixed(2)) : 0,
        dimension: "level"
      },
      {
        metricKey: "level_completion_rate",
        metricLabel: "关卡完成率",
        metricValue: Number(levelCompletionRate.toFixed(2)),
        dimension: "level"
      },
      {
        metricKey: "level_fail_rate",
        metricLabel: "关卡失败率",
        metricValue: Number(levelFailRate.toFixed(2)),
        dimension: "level"
      },
      {
        metricKey: "level_retry_avg",
        metricLabel: "平均重试次数",
        metricValue: levelSuccessRows ? Number((levelFailRows / Math.max(levelSuccessRows, 1)).toFixed(2)) : levelFailRows,
        dimension: "level"
      },
      {
        metricKey: "ad_trigger_rate",
        metricLabel: "广告触发率",
        metricValue: Number(adTriggerRate.toFixed(2)),
        dimension: "ads"
      },
      {
        metricKey: "ad_completion_rate",
        metricLabel: "广告完成率",
        metricValue: Number(adCompletionRate.toFixed(2)),
        dimension: "ads"
      },
      {
        metricKey: "ad_reward_rate",
        metricLabel: "广告奖励领取率",
        metricValue: Number(adRewardRate.toFixed(2)),
        dimension: "ads"
      },
      {
        metricKey: "monetization_conversion_rate",
        metricLabel: "商业化转化率",
        metricValue: Number(monetizationConversionRate.toFixed(2)),
        dimension: "monetization"
      },
      {
        metricKey: "monetization_event_count",
        metricLabel: "商业化事件数",
        metricValue: monetizationRows,
        dimension: "monetization"
      },
      {
        metricKey: "monetization_value",
        metricLabel: "商业化金额",
        metricValue: Number(monetizationValue.toFixed(2)),
        dimension: "monetization"
      }
    ],
    topEvents,
    topPlacements,
    topLevels,
    failReasons
  };
}

export async function createLogImport(input: unknown) {
  const payload = importSchema.parse(input);
  const prisma = getPrismaClient();
  const summary = buildImportSummary(payload.rows, payload.mappings);
  const rawHeaders = Object.keys(payload.rows[0] ?? {});

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
