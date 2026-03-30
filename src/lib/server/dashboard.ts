import { categories, metrics, overviewInsights, recentTasks } from "@/data/mock-data";

import { getPrismaClient, hasDatabaseUrl } from "./prisma";
import { getLatestImportForProject } from "./imports";

type ImportSummary = {
  overview?: {
    healthScore?: number;
    keyAnomalyCount?: number;
    activeUsers?: number;
  };
  categories?: Record<string, { insight?: string; metrics?: Record<string, number> }>;
};

function formatCategoryMetric(key: string, metricsMap?: Record<string, number>) {
  if (!metricsMap) {
    return "等待首批导入";
  }

  switch (key) {
    case "system":
      return `${(metricsMap.validRate ?? 0).toFixed(1)}% 有效率`;
    case "onboarding":
      return `${(metricsMap.completionRate ?? 0).toFixed(1)}% 完成率`;
    case "level":
      return `${(metricsMap.completionRate ?? 0).toFixed(1)}% 通关率`;
    case "monetization":
      return `${(metricsMap.conversionRate ?? 0).toFixed(1)}% 转化率`;
    case "ads":
      return `${(metricsMap.completionRate ?? 0).toFixed(1)}% 完成率`;
    default:
      return `${(metricsMap.coverageRate ?? 0).toFixed(1)}% 覆盖率`;
  }
}

function toneForCategory(key: string) {
  switch (key) {
    case "system":
      return "var(--blue)";
    case "onboarding":
      return "var(--green)";
    case "level":
      return "var(--amber)";
    case "monetization":
      return "var(--gold)";
    case "ads":
      return "var(--violet)";
    default:
      return "var(--teal)";
  }
}

export async function getDashboardOverview() {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    return {
      projectName: "Screwdom 3D",
      currentVersion: "1.0.8",
      compareVersion: "1.0.7",
      storageMode: "demo",
      categories,
      metrics,
      overviewInsights,
      recentTasks
    };
  }

  const [project, uploadCount, reportCount, eventCount] = await Promise.all([
    prisma.project.findFirst({
      orderBy: { updatedAt: "desc" }
    }),
    prisma.logUpload.count(),
    prisma.aiReport.count(),
    prisma.trackingEvent.count()
  ]);

  if (!project) {
    return {
      projectName: "Screwdom 3D",
      currentVersion: "1.0.8",
      compareVersion: "1.0.7",
      storageMode: "database-empty",
      categories,
      metrics,
      overviewInsights,
      recentTasks
    };
  }

  const latestImport = await getLatestImportForProject(project.id);
  const summary = (latestImport?.summaryJson ?? {}) as ImportSummary;
  const healthScore = summary.overview?.healthScore ?? (uploadCount > 0 ? 78 : 72);
  const anomalyCount = summary.overview?.keyAnomalyCount ?? 0;
  const sourceLabel = latestImport?.source === "SYNTHETIC" ? "模拟导入" : latestImport ? "真实导入" : "暂无导入";

  const dynamicInsights = Object.entries(summary.categories ?? {})
    .filter(([, value]) => value?.insight)
    .slice(0, 3)
    .map(([key, value]) => {
      const label = categories.find((item) => item.key === key)?.label ?? key;
      return {
        title: `${label}洞察`,
        description: value.insight ?? "等待首批导入后生成洞察。",
        tone: toneForCategory(key)
      };
    });

  const dynamicTasks = [
    latestImport
      ? {
          name: `${latestImport.version} 数据导入`,
          status: latestImport.status === "COMPLETED" ? "完成" : "处理中",
          detail: `${latestImport.fileName} / ${((latestImport.successRate ?? 0) * 100).toFixed(1)}% 通过 / ${sourceLabel}`
        }
      : {
          name: "首个导入批次",
          status: "待开始",
          detail: "先导入真实日志或模拟数据，首页和看板才会切换到真实数据模式。"
        },
    {
      name: "方案设计进度",
      status: eventCount > 0 ? "进行中" : "待开始",
      detail: eventCount > 0 ? `${eventCount} 个事件已建档，可继续完善字段与字典映射。` : "当前还没有事件建档。"
    },
    {
      name: "AI 报告状态",
      status: reportCount > 0 ? "可回看" : "待生成",
      detail: reportCount > 0 ? `${reportCount} 份报告可查看，建议结合分类看板一起复核。` : "导入一批数据后即可重新分析生成报告。"
    }
  ];

  return {
    projectName: project.name,
    currentVersion: project.currentVersion ?? latestImport?.version ?? "未设置",
    compareVersion: "上一版本",
    storageMode: latestImport ? "database" : "database-empty",
    categories: categories.map((category) => ({
      ...category,
      keyMetric: formatCategoryMetric(category.key, summary.categories?.[category.key]?.metrics),
      insight:
        summary.categories?.[category.key]?.insight ??
        "查看版本对比、核心漏斗、趋势图与 AI 洞察，保持统一视觉和统一认知路径。"
    })),
    metrics: [
      {
        ...metrics[0],
        value: healthScore.toFixed(1),
        delta: `${eventCount} 个事件已建档`
      },
      {
        ...metrics[1],
        value:
          latestImport?.successRate !== null && latestImport?.successRate !== undefined
            ? `${(latestImport.successRate * 100).toFixed(1)}`
            : "0.0",
        delta: latestImport ? `${sourceLabel} / ${latestImport.fileName}` : "等待首个导入批次"
      },
      {
        ...metrics[2],
        value: String(anomalyCount),
        delta: anomalyCount > 0 ? `${anomalyCount} 个关键异常待处理` : "当前没有明显结构性异常"
      },
      {
        ...metrics[3],
        value: String(reportCount),
        delta: reportCount > 0 ? `${reportCount} 份报告可回看` : "暂无已生成报告"
      }
    ],
    overviewInsights: dynamicInsights.length ? dynamicInsights : overviewInsights,
    recentTasks: dynamicTasks
  };
}
