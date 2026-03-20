import { categories, metrics, overviewInsights, recentTasks } from "@/data/mock-data";

import { getPrismaClient, hasDatabaseUrl } from "./prisma";
import { getLatestImportForProject } from "./imports";

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

  const latestImport = project ? await getLatestImportForProject(project.id) : null;

  return {
    projectName: project.name,
    currentVersion: project.currentVersion ?? "未设置",
    compareVersion: "上一版本",
    storageMode: "database",
    categories,
    metrics: [
      {
        ...metrics[0],
        value: uploadCount > 0 ? "84.2" : "72.0",
        delta: `${eventCount} 个事件已建档`
      },
      {
        ...metrics[1],
        value:
          uploadCount > 0 && latestImport?.successRate !== null && latestImport?.successRate !== undefined
            ? `${(latestImport.successRate * 100).toFixed(1)}`
            : "0.0",
        delta:
          uploadCount > 0
            ? `${uploadCount} 个导入批次 / 最新 ${latestImport?.fileName ?? "日志"}`
            : "等待首个导入批次"
      },
      {
        ...metrics[2],
        value: reportCount > 0 ? "3" : "0",
        delta: reportCount > 0 ? `${reportCount} 份报告可回看` : "暂无已生成报告"
      },
      metrics[3]
    ],
    overviewInsights,
    recentTasks
  };
}
