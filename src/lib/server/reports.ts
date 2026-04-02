import crypto from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { getGeminiRuntimeConfig } from "./ai-config";
import { getAnalyticsCategoryData } from "./analytics";
import { getImportsForProject, getLatestImportForProject } from "./imports";
import { getPrismaClient, hasDatabaseUrl } from "./prisma";
import { getMemoryStore } from "./store";

const reportPayloadSchema = z.object({
  headline: z.string().min(1),
  riskSummary: z.string().min(1),
  anomaly: z.string().min(1),
  hypothesis: z.string().min(1),
  recommendation: z.string().min(1),
  nextStep: z.string().min(1),
  riskLevel: z.enum(["低风险", "中风险", "中高风险", "高风险"])
});

const reportPromptResponseSchema = z.object({
  headline: z.string().min(1),
  riskSummary: z.string().min(1),
  anomaly: z.string().min(1),
  hypothesis: z.string().min(1),
  recommendation: z.string().min(1),
  nextStep: z.string().min(1),
  riskLevel: z.enum(["低风险", "中风险", "中高风险", "高风险"])
});

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text.trim();
}

function buildFallbackReport(input: {
  projectName: string;
  versionLabel: string;
  dataSource: string;
  system: Awaited<ReturnType<typeof getAnalyticsCategoryData>>;
  onboarding: Awaited<ReturnType<typeof getAnalyticsCategoryData>>;
  level: Awaited<ReturnType<typeof getAnalyticsCategoryData>>;
  monetization: Awaited<ReturnType<typeof getAnalyticsCategoryData>>;
  ads: Awaited<ReturnType<typeof getAnalyticsCategoryData>>;
}) {
  const onboardingCompletion = input.onboarding.metrics[1]?.value ?? "0%";
  const levelFailRate = input.level.metrics[2]?.value ?? "0%";
  const monetizationConversion = input.monetization.metrics[0]?.value ?? "0%";
  const adCompletion = input.ads.metrics[1]?.value ?? "0%";
  const systemErrorRate = input.system.metrics[3]?.value ?? "0%";
  const numericLevelFail = Number.parseFloat(levelFailRate);
  const numericOnboarding = Number.parseFloat(onboardingCompletion);
  const numericAdCompletion = Number.parseFloat(adCompletion);
  const numericSystemErrorRate = Number.parseFloat(systemErrorRate);

  let riskLevel: z.infer<typeof reportPayloadSchema>["riskLevel"] = "中风险";
  if (numericLevelFail >= 45 || numericOnboarding <= 45 || numericAdCompletion <= 45 || numericSystemErrorRate >= 8) {
    riskLevel = "高风险";
  } else if (numericLevelFail >= 32 || numericOnboarding <= 60 || numericAdCompletion <= 60 || numericSystemErrorRate >= 5) {
    riskLevel = "中高风险";
  } else if (numericLevelFail < 20 && numericOnboarding > 75) {
    riskLevel = "低风险";
  }

  return {
    headline: `${input.versionLabel} 的核心波动集中在前期体验链路，引导完成率 ${onboardingCompletion}，关卡失败率 ${levelFailRate}，广告完成率 ${adCompletion}。`,
    riskSummary: `${input.dataSource}已覆盖当前版本，当前风险等级为${riskLevel}。如果前期体验问题持续，商业化转化 ${monetizationConversion} 可能继续被拖累。`,
    anomaly: `本批次里最明显的异常来自新手引导、关卡流程和广告完成链路：引导完成率 ${onboardingCompletion}，关卡失败率 ${levelFailRate}，广告完成率 ${adCompletion}，公共事件异常占比 ${systemErrorRate}。`,
    hypothesis: "更像是前段体验理解成本偏高，而不是单个埋点失真。优先检查关键步骤的提示时机、事件命名和失败原因字段是否能解释玩家中断。",
    recommendation: "先回到打点方案中心确认关键漏斗事件和字段，再对引导中段与高失败关卡做一次小范围调优，最后复看广告和付费链路是否一起恢复。",
    nextStep: `优先对 ${input.projectName} 的当前版本进行一次 AI 诊断和模拟/真实数据复盘，再生成下一份版本对比报告。`,
    riskLevel
  };
}

async function buildReportDraft(projectId: string, requestedCompareVersion?: string | null, importId?: string | null) {
  const prisma = getPrismaClient();
  let projectName = "当前项目";

  if (!prisma || !hasDatabaseUrl()) {
    const project = getMemoryStore().projects.find((item) => item.id === projectId);
    if (project) {
      projectName = project.name;
    }
  } else {
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    if (project) {
      projectName = project.name;
    }
  }

  const [latestImport, imports] = await Promise.all([
    getLatestImportForProject(projectId),
    getImportsForProject(projectId)
  ]);
  const currentImport = importId ? imports.find((item) => item.id === importId) ?? latestImport : latestImport;
  const compareVersion = currentImport
    ? requestedCompareVersion && requestedCompareVersion !== currentImport.version
      ? imports.find((item) => item.version === requestedCompareVersion)?.version ?? null
      : imports.find((item) => item.version !== currentImport.version)?.version ?? null
    : null;
  const [system, onboarding, level, monetization, ads] = await Promise.all([
    getAnalyticsCategoryData("system", projectId, compareVersion, currentImport?.id ?? null),
    getAnalyticsCategoryData("onboarding", projectId, compareVersion, currentImport?.id ?? null),
    getAnalyticsCategoryData("level", projectId, compareVersion, currentImport?.id ?? null),
    getAnalyticsCategoryData("monetization", projectId, compareVersion, currentImport?.id ?? null),
    getAnalyticsCategoryData("ads", projectId, compareVersion, currentImport?.id ?? null)
  ]);

  return {
    projectName,
    versionLabel: currentImport?.version ?? "未导入版本",
    compareVersionLabel: compareVersion,
    versionOptions: [...new Set(imports.map((item) => item.version))],
    importOptions: imports.map((item) => ({
      id: item.id,
      label: `${item.fileName} / v${item.version}`,
      source: item.source,
      uploadedAt: item.uploadedAt instanceof Date ? item.uploadedAt : new Date(item.uploadedAt)
    })),
    currentImportId: currentImport?.id ?? null,
    dataSource: currentImport?.source === "SYNTHETIC" ? "模拟数据" : currentImport ? "真实数据" : "演示数据",
    system,
    onboarding,
    level,
    monetization,
    ads,
    latestImport: currentImport
  };
}

async function maybeGenerateWithGemini(draft: Awaited<ReturnType<typeof buildReportDraft>>) {
  try {
    const { apiKey, model } = await getGeminiRuntimeConfig();
    const ai = new GoogleGenAI({ apiKey });
    const fallback = buildFallbackReport(draft);

    const prompt = [
      "你是一个休闲手游数据分析顾问，需要基于现有看板指标输出一份简洁、专业的 AI 宏观报告。",
      "必须输出严格 JSON，不要带任何额外解释。",
      "报告必须包含：headline、riskSummary、anomaly、hypothesis、recommendation、nextStep、riskLevel。",
      "风险等级只能是：低风险 / 中风险 / 中高风险 / 高风险。",
      "请确保措辞保守，不要编造没有依据的结论。",
      "参考基线：",
      JSON.stringify(fallback, null, 2),
      "输入数据：",
      JSON.stringify(
        {
          projectName: draft.projectName,
          versionLabel: draft.versionLabel,
          compareVersionLabel: draft.compareVersionLabel,
          dataSource: draft.dataSource,
          system: draft.system.metrics,
          onboarding: draft.onboarding.metrics,
          level: draft.level.metrics,
          monetization: draft.monetization.metrics,
          ads: draft.ads.metrics
        },
        null,
        2
      )
    ].join("\n\n");

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("Gemini 没有返回报告内容。");
    }

    return reportPromptResponseSchema.parse(JSON.parse(extractJson(rawText)));
  } catch {
    return buildFallbackReport(draft);
  }
}

function encodeReportSummary(report: z.infer<typeof reportPayloadSchema>) {
  return JSON.stringify(report);
}

function decodeReportSummary(summary: string) {
  try {
    return reportPayloadSchema.parse(JSON.parse(summary));
  } catch {
    return null;
  }
}

export async function generateAiReport(projectId: string, compareVersion?: string | null, importId?: string | null) {
  const draft = await buildReportDraft(projectId, compareVersion, importId);
  const report = await maybeGenerateWithGemini(draft);
  const prisma = getPrismaClient();
  const now = new Date();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const saved = {
      id: crypto.randomUUID(),
      title: `${draft.projectName} AI 报告`,
      summary: encodeReportSummary(report),
      riskLevel: report.riskLevel,
      dataSource: draft.dataSource,
      versionFrom: draft.compareVersionLabel,
      versionTo: draft.versionLabel,
      generatedAt: now.getTime(),
      projectId
    };

    store.aiReports.push(saved);
    return {
      ...saved,
      content: report
    };
  }

  const saved = await prisma.aiReport.create({
    data: {
      title: `${draft.projectName} AI 报告`,
      summary: encodeReportSummary(report),
      riskLevel: report.riskLevel,
      dataSource: draft.dataSource,
      versionFrom: draft.compareVersionLabel,
      versionTo: draft.versionLabel,
      projectId
    }
  });

  return {
    ...saved,
    content: report
  };
}

export async function getLatestAiReport(projectId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const report = store.aiReports
      .filter((item) => item.projectId === projectId)
      .sort((a, b) => b.generatedAt - a.generatedAt)[0];

    if (!report) {
      return null;
    }

    return {
      ...report,
      content: decodeReportSummary(report.summary)
    };
  }

  const report = await prisma.aiReport.findFirst({
    where: { projectId },
    orderBy: { generatedAt: "desc" }
  });

  if (!report) {
    return null;
  }

  return {
    ...report,
    content: decodeReportSummary(report.summary)
  };
}

export async function getAiReportView(projectId: string, compareVersion?: string | null, importId?: string | null) {
  const latest = await getLatestAiReport(projectId);
  const draft = await buildReportDraft(projectId, compareVersion, importId);
  const canReuseLatest =
    latest?.content &&
    latest.versionTo === draft.versionLabel &&
    (draft.compareVersionLabel ? latest.versionFrom === draft.compareVersionLabel : true);

  if (canReuseLatest && latest?.content) {
    return {
      report: latest.content,
      generatedAt: latest.generatedAt,
      riskLevel: latest.riskLevel,
      dataSource: latest.dataSource,
      versionLabel: latest.versionTo ?? draft.versionLabel,
      compareVersionLabel: draft.compareVersionLabel,
      versionOptions: draft.versionOptions,
      importOptions: draft.importOptions,
      currentImportId: draft.currentImportId,
      evidence: {
        system: draft.system,
        onboarding: draft.onboarding,
        level: draft.level,
        ads: draft.ads,
        monetization: draft.monetization
      }
    };
  }

  const fallback = buildFallbackReport(draft);

  return {
    report: fallback,
    generatedAt: null,
    riskLevel: fallback.riskLevel,
    dataSource: draft.dataSource,
    versionLabel: draft.versionLabel,
    compareVersionLabel: draft.compareVersionLabel,
    versionOptions: draft.versionOptions,
    importOptions: draft.importOptions,
    currentImportId: draft.currentImportId,
    evidence: {
      system: draft.system,
      onboarding: draft.onboarding,
      level: draft.level,
      ads: draft.ads,
      monetization: draft.monetization
    }
  };
}
