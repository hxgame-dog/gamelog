import { categories, chartSeries } from "@/data/mock-data";
import type { DiagnosticIssue, ModuleDiagnosticCheck } from "../import-summary";

import { getImportsForProject, getLatestImportForProject, getMetricSnapshotsForProject } from "./imports";

type CategoryKey = "system" | "onboarding" | "level" | "monetization" | "ads" | "custom";
type DiagnosticModuleKey = "global" | "onboarding" | "level" | "ads" | "monetization" | "liveops" | "economy" | "social";
type RankedItem = { name: string; count: number; meta?: string };
type ImportCategorySummary = {
  metrics: Record<string, number>;
  main: number[];
  aux: number[];
  auxLabels: string[];
  ranking: RankedItem[];
  insight: string;
};

type ImportSummary = {
  technicalSuccessRate?: number;
  technicalErrorCount?: number;
  businessFailureCount?: number;
  moduleCoverage?: number;
  previewRows?: Array<Record<string, string | number | boolean | null>>;
  topEvents?: RankedItem[];
  topPlacements?: RankedItem[];
  topLevels?: RankedItem[];
  failReasons?: RankedItem[];
  onboardingSteps?: Array<{
    stepId: string;
    stepName: string;
    arrivals: number;
    completions: number;
    completionRate: number;
    avgDuration: number;
  }>;
  onboardingFunnel?: Array<{
    stepId: string;
    stepName: string;
    arrivals: number;
    completions: number;
    completionRate: number;
    dropoffCount: number;
    avgDuration: number;
  }>;
  onboardingStepTrend?: Array<{
    stepId: string;
    stepName: string;
    arrivals: number;
    completions: number;
    completionRate: number;
    avgDuration: number;
  }>;
  levelProgress?: Array<{
    levelId: string;
    levelType: string;
    starts: number;
    completes: number;
    fails: number;
    retries: number;
    topFailReason: string;
  }>;
  levelFunnel?: Array<{
    levelId: string;
    levelType: string;
    starts: number;
    completes: number;
    fails: number;
    retries: number;
    completionRate: number;
    failRate: number;
    topFailReason: string;
  }>;
  levelFailReasonDistribution?: RankedItem[];
  levelRetryRanking?: Array<{
    levelId: string;
    levelType: string;
    retries: number;
    starts: number;
    retryRate: number;
  }>;
  microflowRows?: Array<{
    levelId: string;
    action: string;
    count: number;
    ratio: number;
    avgDuration: number;
  }>;
  microflowByLevel?: Array<{
    levelId: string;
    actions: Array<{
      action: string;
      count: number;
      ratio: number;
      avgDuration: number;
    }>;
  }>;
  monetizationStoreFunnel?: Array<{ label: string; count: number; rate?: number; inferred?: boolean }>;
  monetizationPaymentFunnel?: Array<{ label: string; count: number; rate?: number; inferred?: boolean }>;
  giftPackDistribution?: Array<{
    name: string;
    exposures: number;
    clicks: number;
    orders: number;
    successes: number;
    successRate: number;
    inferred?: boolean;
  }>;
  adPlacementBreakdown?: Array<{
    placement: string;
    requests: number;
    plays: number;
    clicks: number;
    rewards: number;
    clickRate: number;
    rewardRate: number;
    inferred?: boolean;
  }>;
  adPlacementFlow?: Array<{
    placement: string;
    requests: number;
    plays: number;
    clicks: number;
  }>;
  categories?: Partial<Record<CategoryKey, ImportCategorySummary>>;
  overview?: {
    activeUsers?: number;
    healthScore?: number;
    keyAnomalyCount?: number;
    monetizationValue?: number;
  };
  diagnostics?: {
    overallStatus: "PASS" | "HIGH_RISK" | "SEVERE_GAP";
    technicalSuccessRate: number;
    technicalErrorCount: number;
    businessFailureCount: number;
    moduleCoverage: number;
    moduleChecks?: Partial<Record<DiagnosticModuleKey, ModuleDiagnosticCheck>>;
    issues?: DiagnosticIssue[];
  };
};

type OperationsModuleKey = "onboarding" | "level" | "monetization" | "ads";

type LevelFunnelRow = NonNullable<ImportSummary["levelFunnel"]>[number];
type LevelRetryRow = NonNullable<ImportSummary["levelRetryRanking"]>[number];
type MicroflowGroup = NonNullable<ImportSummary["microflowByLevel"]>[number];
type MicroflowHotRow = MicroflowGroup["actions"][number] & { levelId: string };
type MonetizationFunnelStage = NonNullable<ImportSummary["monetizationStoreFunnel"]>[number];

export type LevelDiagnostics = {
  levelWorst: LevelFunnelRow[];
  levelRetryHot: LevelRetryRow[];
  microflowHot: MicroflowHotRow[];
};

export type MonetizationLossStage = {
  funnel: "store" | "payment";
  funnelLabel: string;
  label: string;
  drop: number;
};

export type OperationsOverviewData = {
  projectId: string | null;
  sourceLabel: string;
  versionLabel: string;
  compareVersionLabel: string | null;
  currentImportId: string | null;
  technicalSuccessRate: number;
  technicalErrorCount: number;
  businessFailureCount: number;
  moduleCoverage: number;
  hasInference: boolean;
  moduleCards: Array<{
    key: OperationsModuleKey;
    label: string;
    summary: string;
    primaryMetric: string;
    anomaly: string;
    href: string;
  }>;
  anomalyShortcuts: Array<{ label: string; href: string }>;
  importOptions: Array<{ id: string; label: string; source?: string | null }>;
  versionOptions: string[];
};

export type CategoryRiskContext = {
  status: "PENDING" | "PASS" | "HIGH_RISK" | "SEVERE_GAP" | "MISSING";
  canAnalyze: boolean;
  issueCount: number;
  globalIssueCount: number;
  missingEvents: string[];
  missingFields: string[];
  topIssues: DiagnosticIssue[];
  note: string;
};

function resolveDiagnosticModule(category: CategoryKey): DiagnosticModuleKey | null {
  switch (category) {
    case "system":
      return "global";
    case "onboarding":
      return "onboarding";
    case "level":
      return "level";
    case "monetization":
      return "monetization";
    case "ads":
      return "ads";
    default:
      return null;
  }
}

function buildPendingRiskNote(category: CategoryKey) {
  switch (category) {
    case "onboarding":
      return "当前批次还没有严格诊断结果，建议先完成一次新导入后再解读新手引导结论。";
    case "level":
      return "当前批次还没有严格诊断结果，建议先完成一次新导入后再解读关卡与局内行为结论。";
    case "monetization":
      return "当前批次还没有严格诊断结果，建议先完成一次新导入后再解读商业化结论。";
    case "ads":
      return "当前批次还没有严格诊断结果，建议先完成一次新导入后再解读广告结论。";
    case "system":
      return "当前批次还没有严格诊断结果，建议先完成一次新导入后再解读公共属性结论。";
    default:
      return "当前批次还没有严格诊断结果。";
  }
}

function buildIncompleteRiskNote(category: CategoryKey) {
  switch (category) {
    case "onboarding":
      return "当前批次的新手引导严格诊断结果还不完整，建议重新导入或补跑诊断后再结合图表解读。";
    case "level":
      return "当前批次的关卡与局内行为严格诊断结果还不完整，建议重新导入或补跑诊断后再结合图表解读。";
    case "monetization":
      return "当前批次的商业化严格诊断结果还不完整，建议重新导入或补跑诊断后再结合图表解读。";
    case "ads":
      return "当前批次的广告严格诊断结果还不完整，建议重新导入或补跑诊断后再结合图表解读。";
    case "system":
      return "当前批次的公共属性严格诊断结果还不完整，建议重新导入或补跑诊断后再结合图表解读。";
    default:
      return "当前批次的严格诊断结果还不完整。";
  }
}

function buildRiskNote(
  category: CategoryKey,
  status: "PASS" | "HIGH_RISK" | "SEVERE_GAP" | "MISSING",
  check: ModuleDiagnosticCheck,
  issueCount: number,
  globalIssueCount: number
) {
  const moduleLabel =
    category === "system"
      ? "公共属性"
      : category === "onboarding"
        ? "新手引导"
        : category === "level"
          ? "关卡与局内行为"
          : category === "monetization"
            ? "商业化"
            : category === "ads"
              ? "广告分析"
              : "当前模块";

  if (status === "PASS") {
    return `${moduleLabel}当前没有明显严格诊断缺口，可以直接解读图表；如果还存在异常，优先从业务本身找原因。`;
  }

  if (status === "MISSING") {
    return `${moduleLabel}当前没有形成可分析结构，建议先补齐关键事件和字段，再解读模块图表。`;
  }

  const parts: string[] = [];
  if (check.missingEvents.length) {
    parts.push(`缺事件 ${check.missingEvents.join(" / ")}`);
  }
  if (check.missingFields.length) {
    parts.push(`缺字段 ${check.missingFields.join(" / ")}`);
  }
  if (globalIssueCount) {
    parts.push(`另有 ${globalIssueCount} 个公共属性问题会影响本页结论`);
  }
  if (!parts.length && issueCount) {
    parts.push(`共有 ${issueCount} 条严格诊断问题`);
  }

  return `${moduleLabel}当前${status === "SEVERE_GAP" ? "存在严重缺口" : "存在高风险项"}，${parts.join("；")}。`;
}

export function getCategoryRiskContext(category: CategoryKey, summary: ImportSummary): CategoryRiskContext | null {
  const diagnosticModule = resolveDiagnosticModule(category);

  if (!diagnosticModule) {
    return null;
  }

  if (!summary.diagnostics) {
    return {
      status: "PENDING",
      canAnalyze: false,
      issueCount: 0,
      globalIssueCount: 0,
      missingEvents: [],
      missingFields: [],
      topIssues: [],
      note: buildPendingRiskNote(category)
    };
  }

  const moduleCheck = summary.diagnostics.moduleChecks?.[diagnosticModule];
  if (!moduleCheck) {
    return {
      status: "PENDING",
      canAnalyze: false,
      issueCount: 0,
      globalIssueCount: 0,
      missingEvents: [],
      missingFields: [],
      topIssues: [],
      note: buildIncompleteRiskNote(category)
    };
  }

  const relatedModules =
    diagnosticModule === "global"
      ? (["global"] as DiagnosticModuleKey[])
      : (["global", diagnosticModule] as DiagnosticModuleKey[]);
  const relatedIssues = (summary.diagnostics.issues ?? []).filter((issue) => relatedModules.includes(issue.module));
  const sortedIssues = [...relatedIssues].sort((left, right) => {
    const weight = { error: 0, warning: 1, info: 2 } as const;
    return weight[left.severity] - weight[right.severity];
  });
  const globalIssueCount = relatedIssues.filter((issue) => issue.module === "global").length;
  const effectiveStatus = moduleCheck.status === "PASS" && globalIssueCount > 0 ? "HIGH_RISK" : moduleCheck.status;

  return {
    status: effectiveStatus,
    canAnalyze: moduleCheck.canAnalyze,
    issueCount: relatedIssues.length,
    globalIssueCount,
    missingEvents: moduleCheck.missingEvents,
    missingFields: moduleCheck.missingFields,
    topIssues: sortedIssues.slice(0, 3),
    note: buildRiskNote(category, effectiveStatus, moduleCheck, relatedIssues.length, globalIssueCount)
  };
}

const fallbackConfig = {
  system: {
    title: "公共事件运营分析",
    color: "var(--blue)",
    metrics: [
      { label: "活跃设备", value: "18.2k" },
      { label: "总事件量", value: "124k" },
      { label: "有效会话率", value: "81.4%" },
      { label: "异常占比", value: "2.1%" }
    ],
    main: chartSeries.onboardingMain,
    trend: chartSeries.onboardingTrend,
    aux: chartSeries.monetizationMix,
    auxLabels: ["启动", "后台", "设置", "退出"],
    ranking: [
      ["session_start", "本批次占比最高"],
      ["session_end", "结束率稳定"],
      ["settings_open", "较上版本提升 12%"]
    ],
    insight: "公共事件层面没有出现新的结构性异常，可以继续作为版本比较的基线，帮助判断问题是否来自具体玩法模块。"
  },
  onboarding: {
    title: "新手引导运营分析",
    color: "var(--green)",
    metrics: [
      { label: "首步到达率", value: "94.2%" },
      { label: "引导完成率", value: "58.1%" },
      { label: "中途流失率", value: "12.3%" },
      { label: "平均完成时长", value: "2.4 分钟" }
    ],
    main: chartSeries.onboardingMain,
    trend: chartSeries.onboardingTrend,
    aux: chartSeries.onboardingDuration,
    auxLabels: ["步骤 1", "步骤 2", "步骤 3", "步骤 4", "步骤 5", "步骤 6"],
    ranking: [
      ["步骤 4", "完成率下降 9.3%"],
      ["步骤 5", "平均耗时提升 18%"],
      ["步骤 2", "整体稳定"]
    ],
    insight: "引导第 4 步的完成率和耗时同时恶化，更像理解成本变高而不是单点埋点异常，建议优先回看文案与提示位置。"
  },
  level: {
    title: "关卡与局内行为运营分析",
    color: "var(--amber)",
    metrics: [
      { label: "关卡开局率", value: "88.6%" },
      { label: "平均通关率", value: "49.2%" },
      { label: "平均失败率", value: "37.4%" },
      { label: "平均重试次数", value: "3.2" }
    ],
    main: chartSeries.levelMain,
    trend: chartSeries.levelTrend,
    aux: chartSeries.levelFailReason,
    auxLabels: ["误触", "资源耗尽", "超时", "道具失误", "退出"],
    ranking: [
      ["关卡 12", "失败率 41%"],
      ["关卡 9", "平均重试 3.8 次"],
      ["关卡 4", "通关稳定"]
    ],
    insight: "关卡 12 的失败原因集中在道具误用与短暂停顿，说明玩家并不是不会玩，而是缺少一个更及时的操作引导。"
  },
  monetization: {
    title: "商业化运营分析",
    color: "var(--gold)",
    metrics: [
      { label: "首日付费转化", value: "8.7%" },
      { label: "广告触达率", value: "42.4%" },
      { label: "广告完成率", value: "76.3%" },
      { label: "价值事件量", value: "1.9k" }
    ],
    main: chartSeries.monetizationMain,
    trend: chartSeries.monetizationTrend,
    aux: chartSeries.monetizationMix,
    auxLabels: ["首充", "礼包", "激励视频", "插屏"],
    ranking: [
      ["首充礼包", "转化率 4.1%"],
      ["激励视频", "完成率 76.3%"],
      ["限时礼包", "展示后流失较低"]
    ],
    insight: "当前付费弹窗和广告位没有明显相互挤压，商业化节奏整体健康，适合小幅试探提升曝光而不是大改策略。"
  },
  ads: {
    title: "广告运营分析",
    color: "var(--violet)",
    metrics: [
      { label: "广告触发率", value: "42.4%" },
      { label: "播放完成率", value: "76.3%" },
      { label: "奖励领取率", value: "71.8%" },
      { label: "中途关闭率", value: "8.9%" }
    ],
    main: chartSeries.monetizationMain,
    trend: chartSeries.monetizationTrend,
    aux: chartSeries.monetizationMix,
    auxLabels: ["激励视频", "插屏", "Banner", "开屏"],
    ranking: [
      ["激励视频", "完成率最高"],
      ["插屏广告", "中途关闭率偏高"],
      ["Banner", "对主流程影响较低"]
    ],
    insight: "广告整体完成率不错，但插屏在关卡结束后的承接略硬，建议先做一次时机 A/B，而不是直接增加频次。"
  },
  custom: {
    title: "自定义运营分析",
    color: "var(--teal)",
    metrics: [
      { label: "自定义事件数", value: "14" },
      { label: "字段覆盖率", value: "87.5%" },
      { label: "分析可用率", value: "92.3%" },
      { label: "待补异常标签", value: "5" }
    ],
    main: chartSeries.levelMain,
    trend: chartSeries.levelTrend,
    aux: chartSeries.levelFailReason,
    auxLabels: ["任务", "社交", "活动", "成就", "资源"],
    ranking: [
      ["activity_join", "活动参与率较高"],
      ["resource_shortage", "资源焦虑明显"],
      ["mission_claim", "领取链路顺畅"]
    ],
    insight: "自定义分类已经覆盖了活动和资源系统的核心行为，当前字段完整性足够支撑专项分析，但异常标签还需要补齐。"
  }
} as const;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function metricLookup(snapshots: Array<{ metricKey: string; metricValue: number }>) {
  const map = new Map<string, number>();
  snapshots.forEach((item) => {
    if (!map.has(item.metricKey)) {
      map.set(item.metricKey, item.metricValue);
    }
  });
  return (key: string, fallback = 0) => map.get(key) ?? fallback;
}

function buildFallbackTrend(base: number, spread = 8) {
  const safeBase = Math.max(6, Math.min(94, base));

  return Array.from({ length: 7 }, (_, index) => {
    const drift = (index - 3) * 1.8;
    const wave = ((index % 2 === 0 ? -1 : 1) * spread) / 4;
    return clampPercent(safeBase + drift + wave);
  });
}

function formatMetric(value: number, suffix = "%") {
  return `${value.toFixed(1)}${suffix}`;
}

function normalizeSeries(values: number[], minLength = 4) {
  const filtered = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (!filtered.length) {
    return Array.from({ length: minLength }, () => 0);
  }

  const max = Math.max(...filtered, 1);
  const normalized = filtered.map((value) => clampPercent((value / max) * 100));
  return normalized.length >= minLength ? normalized : [...normalized, ...Array.from({ length: minLength - normalized.length }, () => 0)];
}

function normalizeDistribution(values: number[]) {
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0);
  if (!total) {
    return values.map(() => 0);
  }
  return values.map((value) => clampPercent((Math.max(value, 0) / total) * 100));
}

function buildRanking(values: RankedItem[] | undefined, emptyLabel: string, suffix: string) {
  if (!values?.length) {
    return [[emptyLabel, "等待首批日志或模拟数据"]] as Array<[string, string]>;
  }

  return values.slice(0, 5).map((item) => [item.name, item.meta ?? `${item.count}${suffix}`] as [string, string]);
}

function buildRecentTrend(
  snapshots: Array<{ metricKey: string; metricValue: number }>,
  metricKey: string,
  fallback: number[]
) {
  const values = snapshots
    .filter((item) => item.metricKey === metricKey)
    .map((item) => item.metricValue)
    .slice(0, 7)
    .reverse();

  if (!values.length) {
    return fallback;
  }

  if (values.length === 1) {
    return buildFallbackTrend(values[0], 6);
  }

  return normalizeSeries(values, 7);
}

function sourceLabel(source: string | null | undefined) {
  return source === "SYNTHETIC" ? "Synthetic 数据" : "真实数据";
}

function metricCard(label: string, current: string, compare?: string | null) {
  return {
    label,
    value: current,
    compareValue: compare ?? null
  };
}

function countMetricCard(label: string, current: number | null, compare?: number | null) {
  return metricCard(label, current === null ? "—" : current.toFixed(0), compare === null || compare === undefined ? null : compare.toFixed(0));
}

function versionDelta(current: number, compare: number | null | undefined, suffix = "%") {
  if (compare === null || compare === undefined) {
    return null;
  }
  const delta = current - compare;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}${suffix}`;
}

function buildOnboardingStepRows(summary: ImportSummary, compareSummary?: ImportSummary) {
  const currentRows = resolveOnboardingFunnelRows(summary);
  const compareRows = resolveOnboardingFunnelRows(compareSummary);

  return currentRows.map((step) => {
    const compare = compareRows.find((item) => item.stepId === step.stepId);
    return {
      label: step.stepName || step.stepId,
      current: `${step.arrivals} 到达 / ${step.completions} 完成`,
      compare: compare ? `${compare.arrivals} 到达 / ${compare.completions} 完成` : null,
      delta: versionDelta(step.completionRate, compare?.completionRate ?? null),
      note: `完成率 ${step.completionRate.toFixed(1)}%，平均耗时 ${step.avgDuration.toFixed(1)} 秒`,
      kind: "step" as const
    };
  });
}

export function getLevelDiagnostics(
  summary?: Pick<ImportSummary, "levelFunnel" | "levelRetryRanking" | "microflowByLevel">
): LevelDiagnostics {
  const levelWorst = (summary?.levelFunnel ?? []).slice().sort((a, b) => b.failRate - a.failRate);
  const levelRetryHot = (summary?.levelRetryRanking ?? []).slice().sort((a, b) => b.retryRate - a.retryRate);
  const microflowHot = (summary?.microflowByLevel ?? [])
    .flatMap((group) =>
      group.actions.map((action) => ({
        levelId: group.levelId,
        ...action
      }))
    )
    .sort((a, b) => b.ratio - a.ratio);

  return {
    levelWorst,
    levelRetryHot,
    microflowHot
  };
}

export function deriveOnboardingFunnel(
  rows: Array<{
    stepId: string;
    stepName: string;
    arrivals: number;
    completions: number;
    completionRate: number;
    avgDuration: number;
    dropoffCount?: number;
  }>
) {
  return rows.map((row, index) => {
    const nextArrivals = rows[index + 1]?.arrivals ?? row.completions;
    return {
      ...row,
      dropoffCount: row.dropoffCount ?? Math.max(0, row.arrivals - nextArrivals)
    };
  });
}

export function resolveOnboardingFunnelRows(
  summary?: Pick<ImportSummary, "onboardingFunnel" | "onboardingStepTrend" | "onboardingSteps">
) {
  return deriveOnboardingFunnel(summary?.onboardingFunnel ?? summary?.onboardingStepTrend ?? summary?.onboardingSteps ?? []);
}

export function deriveOnboardingDurationSeries(
  rows: Array<{
    avgDuration: number;
  }>,
  fallbackValues: number[]
) {
  if (!rows.length) {
    return normalizeSeries(fallbackValues, 6);
  }

  return rows.map((item) => Number(item.avgDuration.toFixed(1)));
}

function buildLevelRows(summary: ImportSummary, compareSummary?: ImportSummary) {
  const currentRows = (summary.levelFunnel ?? summary.levelProgress?.map((item) => ({
    ...item,
    completionRate: clampPercent((item.completes / Math.max(item.starts, 1)) * 100),
    failRate: clampPercent((item.fails / Math.max(item.starts, 1)) * 100)
  })) ?? [])
    .slice()
    .sort((a, b) => b.failRate - a.failRate);
  const compareRows = compareSummary?.levelFunnel ?? compareSummary?.levelProgress?.map((item) => ({
    ...item,
    completionRate: clampPercent((item.completes / Math.max(item.starts, 1)) * 100),
    failRate: clampPercent((item.fails / Math.max(item.starts, 1)) * 100)
  })) ?? [];

  return currentRows.map((level) => {
    const compare = compareRows.find((item) => item.levelId === level.levelId);
    const currentCompletion = level.completionRate;
    const compareCompletion = compare?.completionRate ?? null;
    return {
      label: level.levelType ? `${level.levelId} (${level.levelType})` : level.levelId,
      current: `${level.starts} 开始 / ${level.completes} 完成 / ${level.fails} 失败 / ${level.retries} 重试`,
      compare: compare
        ? `${compare.starts} 开始 / ${compare.completes} 完成 / ${compare.fails} 失败 / ${compare.retries} 重试`
        : null,
      delta: versionDelta(currentCompletion, compareCompletion),
      note: `失败率 ${level.failRate.toFixed(1)}%，主要失败原因：${level.topFailReason || "—"}`,
      kind: "level" as const
    };
  });
}

function buildMicroflowRows(summary: ImportSummary) {
  const directRows = (summary.microflowRows ?? [])
    .slice()
    .sort((a, b) => b.ratio - a.ratio);
  const fallbackRows = getLevelDiagnostics(summary).microflowHot;
  const rows = (directRows.length ? directRows : fallbackRows).slice(0, 12);

  return rows.map((item) => ({
    label: `${item.levelId} / ${item.action}`,
    current: `${item.count} 次`,
    compare: null,
    delta: `${item.ratio.toFixed(1)}%`,
    note: `平均耗时 ${item.avgDuration.toFixed(1)} 秒`,
    kind: "action" as const
  }));
}

function sumAdBreakdownCount(
  rows: ImportSummary["adPlacementBreakdown"] | undefined,
  key: "requests" | "plays" | "clicks" | "rewards"
) {
  return rows?.length ? rows.reduce((sum, item) => sum + item[key], 0) : null;
}

function sumAdFlowCount(
  rows: ImportSummary["adPlacementFlow"] | undefined,
  key: "requests" | "plays" | "clicks"
) {
  return rows?.length ? rows.reduce((sum, item) => sum + item[key], 0) : null;
}

function buildMonetizationRows(summary: ImportSummary, compareSummary?: ImportSummary) {
  return (summary.giftPackDistribution ?? []).map((item) => {
    const compare = compareSummary?.giftPackDistribution?.find((candidate) => candidate.name === item.name);
    return {
      label: item.name,
      current: `${item.exposures} 曝光 / ${item.clicks} 点击 / ${item.orders} 下单 / ${item.successes} 成功`,
      compare: compare
        ? `${compare.exposures} 曝光 / ${compare.clicks} 点击 / ${compare.orders} 下单 / ${compare.successes} 成功`
        : null,
      delta: versionDelta(item.successRate, compare?.successRate ?? null),
      note: `${item.inferred ? "部分推断" : "显式链路"}，成功率 ${item.successRate.toFixed(1)}%`,
      kind: "action" as const
    };
  });
}

function buildAdRows(summary: ImportSummary, compareSummary?: ImportSummary) {
  return (summary.adPlacementBreakdown ?? []).map((item) => {
    const compare = compareSummary?.adPlacementBreakdown?.find((candidate) => candidate.placement === item.placement);
    return {
      label: item.placement,
      current: `${item.requests} 请求 / ${item.plays} 播放 / ${item.clicks} 点击 / ${item.rewards} 发奖`,
      compare: compare
        ? `${compare.requests} 请求 / ${compare.plays} 播放 / ${compare.clicks} 点击 / ${compare.rewards} 发奖`
        : null,
      delta: versionDelta(item.clickRate, compare?.clickRate ?? null),
      note: `${item.inferred ? "请求数部分推断" : "显式链路"}，点击率 ${item.clickRate.toFixed(1)}%，发奖率 ${item.rewardRate.toFixed(1)}%`,
      kind: "action" as const
    };
  });
}

function biggestOnboardingDrop(summary: ImportSummary) {
  const biggest = resolveOnboardingFunnelRows(summary).slice().sort((a, b) => b.dropoffCount - a.dropoffCount)[0];
  if (!biggest) {
    return "暂无显著流失步骤";
  }
  return `${biggest.stepName || biggest.stepId} 流失 ${biggest.dropoffCount} 人`;
}

function levelFunnelRanking(summary: ImportSummary) {
  return getLevelDiagnostics(summary).levelWorst;
}

function monetizationConversion(summary: ImportSummary) {
  const stages = summary.monetizationStoreFunnel ?? [];
  const exposure = stages[0]?.count ?? 0;
  const success = stages.at(-1)?.count ?? 0;
  return exposure ? clampPercent((success / exposure) * 100) : 0;
}

function buildOnboardingCompareInsight(summary: ImportSummary, compareSummary?: ImportSummary, compareVersion?: string | null) {
  const biggest = biggestOnboardingDrop(summary);
  if (!compareSummary || !compareVersion) {
    return `当前漏斗中流失最明显的是 ${biggest}。`;
  }
  const currentDrop = resolveOnboardingFunnelRows(summary).reduce((max, item) => Math.max(max, item.dropoffCount), 0);
  const compareDrop = resolveOnboardingFunnelRows(compareSummary).reduce((max, item) => Math.max(max, item.dropoffCount), 0);
  return `当前漏斗中流失最明显的是 ${biggest}，相较 ${compareVersion} 的最大步骤流失 ${(currentDrop - compareDrop > 0 ? "+" : "")}${currentDrop - compareDrop}。`;
}

function resolveCompareImport(
  imports: Array<{ version: string; uploadedAt?: Date | number; summaryJson?: unknown }>,
  currentVersion: string,
  compareVersion?: string | null
) {
  if (compareVersion) {
    if (compareVersion === currentVersion) {
      return null;
    }
    return imports.find((item) => item.version === compareVersion) ?? null;
  }

  return imports.find((item) => item.version !== currentVersion) ?? null;
}

function resolveCurrentImport(
  imports: Array<{ id?: string; version: string; uploadedAt?: Date | number; summaryJson?: unknown; source?: string | null }>,
  importId?: string | null
) {
  if (importId) {
    return imports.find((item) => item.id === importId) ?? null;
  }

  return imports[0] ?? null;
}

function emptyCompareSeries(values: number[]) {
  return values.map(() => 0);
}

function buildAnalyticsHref(
  category: OperationsModuleKey,
  options: {
    projectId?: string | null;
    compareVersion?: string | null;
    currentImportId?: string | null;
    detailFilter?: "all" | "abnormal" | "delta";
  }
) {
  const params = new URLSearchParams();

  if (options.projectId) {
    params.set("projectId", options.projectId);
  }
  if (options.compareVersion) {
    params.set("compareVersion", options.compareVersion);
  }
  if (options.currentImportId) {
    params.set("importId", options.currentImportId);
  }
  if (options.detailFilter) {
    params.set("detailFilter", options.detailFilter);
  }

  const query = params.toString();
  return `/analytics/${category}${query ? `?${query}` : ""}`;
}

function formatOverviewPercent(value: number | null | undefined) {
  return `${(value ?? 0).toFixed(1)}%`;
}

function getOverviewMetric(
  summary: ImportSummary,
  category: OperationsModuleKey,
  metricKey: string
) {
  return summary.categories?.[category]?.metrics?.[metricKey] ?? null;
}

function rankMonetizationLossStages(
  stages: MonetizationFunnelStage[],
  funnel: MonetizationLossStage["funnel"],
  funnelLabel: string
) {
  if (stages.length < 2) {
    return [];
  }

  return stages
    .slice(1)
    .map((stage, index) => {
      const previous = stages[index];
      return {
        funnel,
        funnelLabel,
        label: `${previous?.label ?? "上一阶段"} -> ${stage.label}`,
        drop: Math.max((previous?.count ?? 0) - stage.count, 0)
      } satisfies MonetizationLossStage;
    })
    .filter((stage) => stage.drop > 0);
}

export function getMonetizationWorstLossStage(summary: Pick<ImportSummary, "monetizationStoreFunnel" | "monetizationPaymentFunnel">) {
  const rankedStages = [
    ...rankMonetizationLossStages(summary.monetizationStoreFunnel ?? [], "store", "商店链路"),
    ...rankMonetizationLossStages(summary.monetizationPaymentFunnel ?? [], "payment", "支付链路")
  ].sort((a, b) => b.drop - a.drop);

  return rankedStages[0] ?? null;
}

function biggestStoreLoss(summary: ImportSummary) {
  const worstStage = getMonetizationWorstLossStage(summary);

  if (!worstStage) {
    return "暂无明显转化损耗点";
  }

  return `${worstStage.funnelLabel} · ${worstStage.label} 流失 ${worstStage.drop}`;
}

function biggestLevelProblem(summary: ImportSummary) {
  const worstLevel = levelFunnelRanking(summary)
    .slice()
    .sort((a, b) => b.failRate - a.failRate)[0];

  if (!worstLevel) {
    return "暂无高失败关卡";
  }

  const label = worstLevel.levelType ? `${worstLevel.levelId} (${worstLevel.levelType})` : worstLevel.levelId;
  return `${label} 失败率 ${worstLevel.failRate.toFixed(1)}%`;
}

function weakestAdPlacement(summary: ImportSummary) {
  const weakest = (summary.adPlacementBreakdown ?? [])
    .slice()
    .sort((a, b) => a.clickRate - b.clickRate)[0];

  if (!weakest) {
    return "暂无异常广告位";
  }

  return `${weakest.placement} 点击率 ${weakest.clickRate.toFixed(1)}%`;
}

function hasInferredData(summary: ImportSummary) {
  return Boolean(summary.monetizationStoreFunnel?.some((item) => item.inferred))
    || Boolean(summary.monetizationPaymentFunnel?.some((item) => item.inferred))
    || Boolean(summary.giftPackDistribution?.some((item) => item.inferred))
    || Boolean(summary.adPlacementBreakdown?.some((item) => item.inferred));
}

function buildOverviewModuleCards(
  summary: ImportSummary,
  options: {
    projectId?: string | null;
    compareVersion?: string | null;
    currentImportId?: string | null;
  }
): OperationsOverviewData["moduleCards"] {
  const onboardingCompletion = getOverviewMetric(summary, "onboarding", "completionRate");
  const levelCompletion = getOverviewMetric(summary, "level", "completionRate");
  const monetizationSuccess = summary.monetizationPaymentFunnel?.at(-1)?.rate ?? getOverviewMetric(summary, "monetization", "conversionRate");
  const adRewardRate = getOverviewMetric(summary, "ads", "rewardRate");

  return [
    {
      key: "onboarding",
      label: "新手引导",
      summary: "查看步骤漏斗、关键流失节点和步骤耗时，优先定位玩家最容易掉队的引导环节。",
      primaryMetric: onboardingCompletion === null ? "引导完成率待导入" : `引导完成率 ${formatOverviewPercent(onboardingCompletion)}`,
      anomaly: biggestOnboardingDrop(summary),
      href: buildAnalyticsHref("onboarding", options)
    },
    {
      key: "level",
      label: "关卡与局内行为",
      summary: "查看关卡开始、失败、重试与局内操作热点，判断哪一关最值得优先回看。",
      primaryMetric: levelCompletion === null ? "平均通关率待导入" : `平均通关率 ${formatOverviewPercent(levelCompletion)}`,
      anomaly: biggestLevelProblem(summary),
      href: buildAnalyticsHref("level", options)
    },
    {
      key: "monetization",
      label: "商业化",
      summary: "查看商店到支付成功的主链路与礼包表现，快速锁定最大转化损耗点。",
      primaryMetric: monetizationSuccess === null ? "支付成功率待导入" : `支付成功率 ${formatOverviewPercent(monetizationSuccess)}`,
      anomaly: biggestStoreLoss(summary),
      href: buildAnalyticsHref("monetization", options)
    },
    {
      key: "ads",
      label: "广告分析",
      summary: "查看广告位请求、播放、点击和发奖承接，识别表现最弱的广告位。",
      primaryMetric: adRewardRate === null ? "奖励领取率待导入" : `奖励领取率 ${formatOverviewPercent(adRewardRate)}`,
      anomaly: weakestAdPlacement(summary),
      href: buildAnalyticsHref("ads", options)
    }
  ];
}

function buildOverviewAnomalyShortcuts(
  summary: ImportSummary,
  options: {
    projectId?: string | null;
    compareVersion?: string | null;
    currentImportId?: string | null;
  }
): OperationsOverviewData["anomalyShortcuts"] {
  const onboardingHref = `${buildAnalyticsHref("onboarding", options)}#onboarding-signal`;

  return [
    {
      label: `最大流失步骤: ${biggestOnboardingDrop(summary)}`,
      href: onboardingHref
    },
    {
      label: `失败最集中关卡: ${biggestLevelProblem(summary)}`,
      href: buildAnalyticsHref("level", { ...options, detailFilter: "abnormal" })
    },
    {
      label: `最大转化损耗点: ${biggestStoreLoss(summary)}`,
      href: buildAnalyticsHref("monetization", { ...options, detailFilter: "delta" })
    },
    {
      label: `最弱广告位: ${weakestAdPlacement(summary)}`,
      href: buildAnalyticsHref("ads", { ...options, detailFilter: "abnormal" })
    }
  ];
}

function buildDetailRows(
  category: CategoryKey,
  current: ImportCategorySummary,
  compare: ImportCategorySummary | undefined,
  compareVersionLabel?: string | null
) {
  const rows: Array<{ label: string; current: string; compare?: string | null; delta?: string | null; note: string }> = [];

  if (category === "system") {
    rows.push(
      {
        label: "公共事件健康度",
        current: `${(current.metrics.validRate ?? 0).toFixed(1)}%`,
        compare: compareVersionLabel ? `${(compare?.metrics.validRate ?? 0).toFixed(1)}%` : null,
        delta: versionDelta(current.metrics.validRate ?? 0, compare?.metrics.validRate ?? null),
        note: "用于判断 session、login、error 等系统层事件是否稳定。"
      },
      {
        label: "异常占比",
        current: `${(current.metrics.errorRate ?? 0).toFixed(1)}%`,
        compare: compareVersionLabel ? `${(compare?.metrics.errorRate ?? 0).toFixed(1)}%` : null,
        delta: versionDelta(current.metrics.errorRate ?? 0, compare?.metrics.errorRate ?? null),
        note: "异常升高时优先检查底层公共事件口径。"
      }
    );
  } else if (category === "onboarding") {
    rows.push(
      {
        label: "引导完成率",
        current: `${(current.metrics.completionRate ?? 0).toFixed(1)}%`,
        compare: compareVersionLabel ? `${(compare?.metrics.completionRate ?? 0).toFixed(1)}%` : null,
        delta: versionDelta(current.metrics.completionRate ?? 0, compare?.metrics.completionRate ?? null),
        note: "新手链路的核心漏斗指标。"
      },
      {
        label: "平均耗时",
        current: `${(current.metrics.avgDuration ?? 0).toFixed(1)} 秒`,
        compare: compareVersionLabel ? `${(compare?.metrics.avgDuration ?? 0).toFixed(1)} 秒` : null,
        delta: versionDelta(current.metrics.avgDuration ?? 0, compare?.metrics.avgDuration ?? null, " 秒"),
        note: "耗时与流失同时升高时，优先看步骤理解成本。"
      }
    );
  } else if (category === "level") {
    rows.push(
      {
        label: "通关率",
        current: `${(current.metrics.completionRate ?? 0).toFixed(1)}%`,
        compare: compareVersionLabel ? `${(compare?.metrics.completionRate ?? 0).toFixed(1)}%` : null,
        delta: versionDelta(current.metrics.completionRate ?? 0, compare?.metrics.completionRate ?? null),
        note: "关卡主漏斗的最终结果指标。"
      },
      {
        label: "失败率",
        current: `${(current.metrics.failRate ?? 0).toFixed(1)}%`,
        compare: compareVersionLabel ? `${(compare?.metrics.failRate ?? 0).toFixed(1)}%` : null,
        delta: versionDelta(current.metrics.failRate ?? 0, compare?.metrics.failRate ?? null),
        note: "失败率高于通关率时，建议优先看失败原因与高失败关卡。"
      }
    );
  } else if (category === "monetization") {
    rows.push(
      {
        label: "商业化转化率",
        current: `${(current.metrics.conversionRate ?? 0).toFixed(1)}%`,
        compare: compareVersionLabel ? `${(compare?.metrics.conversionRate ?? 0).toFixed(1)}%` : null,
        delta: versionDelta(current.metrics.conversionRate ?? 0, compare?.metrics.conversionRate ?? null),
        note: "用于判断付费入口到价值事件的转化表现。"
      },
      {
        label: "价值事件金额",
        current: `${(current.metrics.value ?? 0).toFixed(2)}`,
        compare: compareVersionLabel ? `${(compare?.metrics.value ?? 0).toFixed(2)}` : null,
        delta: versionDelta(current.metrics.value ?? 0, compare?.metrics.value ?? null, ""),
        note: "首版使用导入批次估算值，用于版本间横向观察。"
      }
    );
  } else if (category === "ads") {
    rows.push(
      {
        label: "广告完成率",
        current: `${(current.metrics.completionRate ?? 0).toFixed(1)}%`,
        compare: compareVersionLabel ? `${(compare?.metrics.completionRate ?? 0).toFixed(1)}%` : null,
        delta: versionDelta(current.metrics.completionRate ?? 0, compare?.metrics.completionRate ?? null),
        note: "衡量广告承接是否顺滑的第一指标。"
      },
      {
        label: "奖励领取率",
        current: `${(current.metrics.rewardRate ?? 0).toFixed(1)}%`,
        compare: compareVersionLabel ? `${(compare?.metrics.rewardRate ?? 0).toFixed(1)}%` : null,
        delta: versionDelta(current.metrics.rewardRate ?? 0, compare?.metrics.rewardRate ?? null),
        note: "完成率高但领奖率低时，通常是奖励领取事件或交互承接有问题。"
      }
    );
  } else {
    rows.push(
      {
        label: "字段覆盖率",
        current: `${(current.metrics.coverageRate ?? 0).toFixed(1)}%`,
        compare: compareVersionLabel ? `${(compare?.metrics.coverageRate ?? 0).toFixed(1)}%` : null,
        delta: versionDelta(current.metrics.coverageRate ?? 0, compare?.metrics.coverageRate ?? null),
        note: "用于判断自定义分类是否已经具备专项分析条件。"
      },
      {
        label: "分析可用率",
        current: `${(current.metrics.usableRate ?? 0).toFixed(1)}%`,
        compare: compareVersionLabel ? `${(compare?.metrics.usableRate ?? 0).toFixed(1)}%` : null,
        delta: versionDelta(current.metrics.usableRate ?? 0, compare?.metrics.usableRate ?? null),
        note: "结合异常标签与字段说明，判断是否还能继续补结构。"
      }
    );
  }

  current.ranking.slice(0, 3).forEach((item, index) => {
    rows.push({
      label: `重点项 ${index + 1}`,
      current: item.name,
      compare: compareVersionLabel ? compare?.ranking?.[index]?.name ?? "—" : null,
      delta: null,
      note: item.meta ?? `${item.count} 次`
    });
  });

  return rows;
}

export async function getOperationsOverviewData(
  projectId?: string | null,
  compareVersion?: string | null,
  currentImportId?: string | null
): Promise<OperationsOverviewData> {
  if (!projectId) {
    const emptySummary = {} as ImportSummary;

    return {
      projectId: null,
      sourceLabel: "演示数据",
      versionLabel: "未导入",
      compareVersionLabel: null,
      currentImportId: null,
      technicalSuccessRate: 0,
      technicalErrorCount: 0,
      businessFailureCount: 0,
      moduleCoverage: 0,
      hasInference: false,
      moduleCards: buildOverviewModuleCards(emptySummary, {}),
      anomalyShortcuts: buildOverviewAnomalyShortcuts(emptySummary, {}),
      importOptions: [],
      versionOptions: []
    };
  }

  const latestImport = await getLatestImportForProject(projectId);

  if (!latestImport) {
    const emptySummary = {} as ImportSummary;

    return {
      projectId,
      sourceLabel: "演示数据",
      versionLabel: "未导入",
      compareVersionLabel: null,
      currentImportId: null,
      technicalSuccessRate: 0,
      technicalErrorCount: 0,
      businessFailureCount: 0,
      moduleCoverage: 0,
      hasInference: false,
      moduleCards: buildOverviewModuleCards(emptySummary, { projectId }),
      anomalyShortcuts: buildOverviewAnomalyShortcuts(emptySummary, { projectId }),
      importOptions: [],
      versionOptions: []
    };
  }

  const allImports = await getImportsForProject(projectId);
  const currentImport = resolveCurrentImport(allImports, currentImportId) ?? latestImport;
  const compareImport = resolveCompareImport(allImports, currentImport.version, compareVersion);
  const versionOptions = [...new Set(allImports.map((item) => item.version))];
  const importOptions = allImports.map((item) => ({
    id: item.id,
    label: `${item.fileName} / v${item.version}`,
    source: item.source
  }));
  const summary = (currentImport.summaryJson ?? {}) as ImportSummary;
  const cardOptions = {
    projectId,
    compareVersion: compareImport?.version ?? null,
    currentImportId: currentImport.id ?? null
  };

  return {
    projectId,
    sourceLabel: sourceLabel(currentImport.source),
    versionLabel: currentImport.version,
    compareVersionLabel: compareImport?.version ?? null,
    currentImportId: currentImport.id ?? null,
    technicalSuccessRate: summary.technicalSuccessRate ?? 0,
    technicalErrorCount: summary.technicalErrorCount ?? 0,
    businessFailureCount: summary.businessFailureCount ?? 0,
    moduleCoverage: summary.moduleCoverage ?? 0,
    hasInference: hasInferredData(summary),
    moduleCards: buildOverviewModuleCards(summary, cardOptions),
    anomalyShortcuts: buildOverviewAnomalyShortcuts(summary, cardOptions),
    importOptions,
    versionOptions
  };
}

export async function getAnalyticsCategoryData(
  category: CategoryKey,
  projectId?: string | null,
  compareVersion?: string | null,
  currentImportId?: string | null
) {
  const fallback = fallbackConfig[category];

  if (!projectId) {
    return {
      ...fallback,
      categories,
      source: "fallback",
      sourceLabel: "演示数据",
      versionLabel: "未导入",
      moduleRisk: null
    };
  }

  const latestImport = await getLatestImportForProject(projectId);

  if (!latestImport) {
    return {
      ...fallback,
      categories,
      source: "fallback",
      sourceLabel: "演示数据",
      versionLabel: "未导入",
      moduleRisk: null
    };
  }

  const allImports = await getImportsForProject(projectId);
  const currentImport = resolveCurrentImport(allImports, currentImportId) ?? latestImport;
  const compareImport = resolveCompareImport(allImports, currentImport.version, compareVersion);
  const versionOptions = [...new Set(allImports.map((item) => item.version))];
  const importOptions = allImports.map((item) => ({
    id: item.id,
    label: `${item.fileName} / v${item.version}`,
    source: item.source
  }));

  const [currentSnapshots, allSnapshots, compareSnapshots] = await Promise.all([
    getMetricSnapshotsForProject(projectId, currentImport.version),
    getMetricSnapshotsForProject(projectId),
    compareImport ? getMetricSnapshotsForProject(projectId, compareImport.version) : Promise.resolve([])
  ]);

  const summary = (currentImport.summaryJson ?? {}) as ImportSummary;
  const categorySummary = summary.categories?.[category];
  const compareSummary = (compareImport?.summaryJson ?? {}) as ImportSummary;
  const compareCategorySummary = compareSummary.categories?.[category];
  const moduleRisk = getCategoryRiskContext(category, summary);

  if (!currentSnapshots.length || !categorySummary) {
    return {
      ...fallback,
      categories,
      source: currentImport.source,
      sourceLabel: sourceLabel(currentImport.source),
      versionLabel: currentImport.version,
      currentImportId: currentImport.id,
      importOptions,
      moduleRisk
    };
  }

  const getMetric = metricLookup(currentSnapshots);
  const getCompareMetric = metricLookup(compareSnapshots);
  const base = {
    title: fallback.title,
    color: fallback.color,
    categories,
    source: currentImport.source,
    sourceLabel: sourceLabel(currentImport.source),
    versionLabel: currentImport.version,
    compareVersionLabel: compareImport?.version ?? null,
    versionOptions,
    currentImportId: currentImport.id,
    importOptions,
    technicalSuccessRate: summary.technicalSuccessRate ?? 0,
    technicalErrorCount: summary.technicalErrorCount ?? 0,
    businessFailureCount: summary.businessFailureCount ?? 0,
    moduleCoverage: summary.moduleCoverage ?? 0,
    moduleRisk,
    compareTechnicalSuccessRate: compareSummary.technicalSuccessRate ?? null,
    compareTechnicalErrorCount: compareSummary.technicalErrorCount ?? null,
    compareBusinessFailureCount: compareSummary.businessFailureCount ?? null,
    compareModuleCoverage: compareSummary.moduleCoverage ?? null
  };

  const compareSummaryText = compareImport
    ? `当前版本 ${currentImport.version} 正在对比 ${compareImport.version}。`
    : "当前还没有可用的对比版本，建议再导入一批其他版本数据后查看差异。";

  if (category === "system") {
    const validRate = getMetric("system_valid_rate", getMetric("import_success_rate"));
    const compareValidRate = compareImport
      ? getCompareMetric("system_valid_rate", getCompareMetric("import_success_rate"))
      : null;
    const errorRate = getMetric("system_error_rate");
    const compareErrorRate = compareImport ? getCompareMetric("system_error_rate") : null;

    return {
      ...base,
      metrics: [
        metricCard("活跃用户", getMetric("active_users").toFixed(0), compareImport ? getCompareMetric("active_users").toFixed(0) : null),
        metricCard("公共事件量", getMetric("system_event_count").toFixed(0), compareImport ? getCompareMetric("system_event_count").toFixed(0) : null),
        metricCard("有效会话率", formatMetric(validRate), compareValidRate !== null ? formatMetric(compareValidRate) : null),
        metricCard("异常占比", formatMetric(errorRate), compareErrorRate !== null ? formatMetric(compareErrorRate) : null)
      ],
      main: normalizeSeries(categorySummary.main),
      compareMain: compareCategorySummary ? normalizeSeries(compareCategorySummary.main) : emptyCompareSeries(normalizeSeries(categorySummary.main)),
      trend: buildRecentTrend(allSnapshots, "system_valid_rate", fallback.trend),
      compareTrend: compareImport
        ? buildRecentTrend(compareSnapshots, "system_valid_rate", fallback.trend)
        : emptyCompareSeries(buildRecentTrend(allSnapshots, "system_valid_rate", fallback.trend)),
      aux: normalizeDistribution(categorySummary.aux),
      auxLabels: categorySummary.auxLabels.length ? categorySummary.auxLabels : fallback.auxLabels,
      ranking: buildRanking(categorySummary.ranking, "公共事件", " 次"),
      detailRows: buildDetailRows(category, categorySummary, compareCategorySummary, compareImport?.version),
      insight:
        compareImport && compareValidRate !== null
          ? `${categorySummary.insight} 与 ${compareImport.version} 相比，有效会话率 ${versionDelta(validRate, compareValidRate)}，异常占比 ${versionDelta(errorRate, compareErrorRate)}。`
          : categorySummary.insight,
      compareInsight: compareSummaryText
    };
  }

  if (category === "onboarding") {
    const reach = getMetric("onboarding_reach_rate");
    const compareReach = compareImport ? getCompareMetric("onboarding_reach_rate") : null;
    const completion = getMetric("onboarding_completion_rate");
    const compareCompletion = compareImport ? getCompareMetric("onboarding_completion_rate") : null;
    const drop = getMetric("onboarding_drop_rate");
    const compareDrop = compareImport ? getCompareMetric("onboarding_drop_rate") : null;
    const avgDuration = getMetric("onboarding_avg_duration");
    const compareDuration = compareImport ? getCompareMetric("onboarding_avg_duration") : null;

    const onboardingTrendRows = summary.onboardingStepTrend ?? summary.onboardingSteps ?? [];
    const onboardingRows = resolveOnboardingFunnelRows(summary);
    const compareOnboardingTrendRows = compareSummary.onboardingStepTrend ?? compareSummary.onboardingSteps ?? [];
    const compareOnboardingRows = resolveOnboardingFunnelRows(compareSummary);
    const funnelValues =
      onboardingRows.length > 0
        ? onboardingRows.map((item) => clampPercent((item.arrivals / Math.max(onboardingRows[0]?.arrivals || 1, 1)) * 100))
        : normalizeSeries(categorySummary.main, 6);
    const compareFunnelValues =
      compareOnboardingRows.length > 0
        ? compareOnboardingRows.map((item) => clampPercent((item.arrivals / Math.max(compareOnboardingRows[0]?.arrivals || 1, 1)) * 100))
        : compareCategorySummary
          ? normalizeSeries(compareCategorySummary.main, 6)
          : emptyCompareSeries(funnelValues);
    const durationSeries = deriveOnboardingDurationSeries(onboardingTrendRows, categorySummary.aux);

    return {
      ...base,
      metrics: [
        metricCard("首步到达率", formatMetric(reach), compareReach !== null ? formatMetric(compareReach) : null),
        metricCard("引导完成率", formatMetric(completion), compareCompletion !== null ? formatMetric(compareCompletion) : null),
        metricCard("中途流失率", formatMetric(drop), compareDrop !== null ? formatMetric(compareDrop) : null),
        metricCard("平均完成时长", `${avgDuration.toFixed(1)} 秒`, compareDuration !== null ? `${compareDuration.toFixed(1)} 秒` : null)
      ],
      main: funnelValues,
      compareMain: compareFunnelValues,
      trend: buildRecentTrend(allSnapshots, "onboarding_completion_rate", fallback.trend),
      compareTrend: compareImport
        ? buildRecentTrend(compareSnapshots, "onboarding_completion_rate", fallback.trend)
        : emptyCompareSeries(buildRecentTrend(allSnapshots, "onboarding_completion_rate", fallback.trend)),
      aux: durationSeries,
      auxLabels:
        onboardingTrendRows.length > 0
          ? onboardingTrendRows.map((item) => item.stepName || item.stepId)
          : categorySummary.auxLabels.length
            ? categorySummary.auxLabels
            : fallback.auxLabels,
      ranking:
        onboardingRows.length > 0
          ? onboardingRows
              .slice()
              .sort((a, b) => b.dropoffCount - a.dropoffCount)
              .slice(0, 5)
              .map((item) => [item.stepName || item.stepId, `流失 ${item.dropoffCount} / 完成率 ${item.completionRate.toFixed(1)}%`] as [string, string])
          : buildRanking(categorySummary.ranking, "引导步骤", " 次"),
      detailRows:
        onboardingRows.length > 0
          ? buildOnboardingStepRows(summary, compareSummary)
          : buildDetailRows(category, categorySummary, compareCategorySummary, compareImport?.version),
      insight:
        compareImport && compareCompletion !== null
          ? `${categorySummary.insight} 与 ${compareImport.version} 相比，引导完成率 ${versionDelta(completion, compareCompletion)}，流失率 ${versionDelta(drop, compareDrop)}。`
          : categorySummary.insight,
      compareInsight: buildOnboardingCompareInsight(summary, compareSummary, compareImport?.version),
      onboardingRows,
      onboardingFunnel: onboardingRows,
      onboardingStepTrend: onboardingTrendRows,
      compareOnboardingFunnel: compareOnboardingRows,
      compareOnboardingStepTrend: compareOnboardingTrendRows
    };
  }

  if (category === "level") {
    const start = getMetric("level_start_rate");
    const compareStart = compareImport ? getCompareMetric("level_start_rate") : null;
    const completion = getMetric("level_completion_rate");
    const compareCompletion = compareImport ? getCompareMetric("level_completion_rate") : null;
    const fail = getMetric("level_fail_rate");
    const compareFail = compareImport ? getCompareMetric("level_fail_rate") : null;
    const retry = getMetric("level_retry_avg");
    const compareRetry = compareImport ? getCompareMetric("level_retry_avg") : null;

    const levelRows = summary.levelFunnel ?? (summary.levelProgress ?? []).map((item) => ({
      ...item,
      completionRate: clampPercent((item.completes / Math.max(item.starts, 1)) * 100),
      failRate: clampPercent((item.fails / Math.max(item.starts, 1)) * 100)
    }));
    const compareLevelRows = compareSummary.levelFunnel ?? (compareSummary.levelProgress ?? []).map((item) => ({
      ...item,
      completionRate: clampPercent((item.completes / Math.max(item.starts, 1)) * 100),
      failRate: clampPercent((item.fails / Math.max(item.starts, 1)) * 100)
    }));
    const levelDiagnostics = getLevelDiagnostics({
      levelFunnel: levelRows,
      levelRetryRanking: summary.levelRetryRanking ?? [],
      microflowByLevel: summary.microflowByLevel ?? []
    });
    const mainValues =
      levelRows.length > 0
        ? levelRows.map((item) => item.completionRate)
        : normalizeSeries(categorySummary.main);
    const compareMainValues =
      compareLevelRows.length > 0
        ? compareLevelRows.map((item) => item.completionRate)
        : compareCategorySummary
          ? normalizeSeries(compareCategorySummary.main)
          : emptyCompareSeries(mainValues);

    return {
      ...base,
      metrics: [
        metricCard("关卡开局率", formatMetric(start), compareStart !== null ? formatMetric(compareStart) : null),
        metricCard("平均通关率", formatMetric(completion), compareCompletion !== null ? formatMetric(compareCompletion) : null),
        metricCard("平均失败率", formatMetric(fail), compareFail !== null ? formatMetric(compareFail) : null),
        metricCard("平均重试次数", retry.toFixed(1), compareRetry !== null ? compareRetry.toFixed(1) : null)
      ],
      main: mainValues,
      compareMain: compareMainValues,
      trend: buildRecentTrend(allSnapshots, "level_completion_rate", fallback.trend),
      compareTrend: compareImport
        ? buildRecentTrend(compareSnapshots, "level_completion_rate", fallback.trend)
        : emptyCompareSeries(buildRecentTrend(allSnapshots, "level_completion_rate", fallback.trend)),
      aux: categorySummary.aux,
      auxLabels: categorySummary.auxLabels.length ? categorySummary.auxLabels : fallback.auxLabels,
      ranking:
        levelRows.length > 0
          ? (summary.levelRetryRanking ?? [])
              .slice(0, 5)
              .map((item) => [
                item.levelType ? `${item.levelId} (${item.levelType})` : item.levelId,
                `重试 ${item.retries} / ${(item.retryRate ?? 0).toFixed(1)}%`
              ] as [string, string])
          : buildRanking(categorySummary.ranking, "关卡", " 次"),
      detailRows:
        levelRows.length > 0
          ? [...buildLevelRows(summary, compareSummary), ...buildMicroflowRows(summary)]
          : buildDetailRows(category, categorySummary, compareCategorySummary, compareImport?.version),
      insight:
        compareImport && compareCompletion !== null
          ? `${categorySummary.insight} 与 ${compareImport.version} 相比，通关率 ${versionDelta(completion, compareCompletion)}，失败率 ${versionDelta(fail, compareFail)}。`
          : categorySummary.insight,
      compareInsight: compareSummaryText,
      levelRows,
      microflowRows: summary.microflowRows ?? [],
      levelFunnel: levelRows,
      compareLevelFunnel: compareSummary.levelFunnel ?? compareLevelRows,
      levelFailReasonDistribution: summary.levelFailReasonDistribution ?? summary.failReasons ?? [],
      levelRetryRanking: levelDiagnostics.levelRetryHot,
      microflowByLevel: summary.microflowByLevel ?? [],
      levelDiagnostics
    };
  }

  if (category === "monetization") {
    const conversion = monetizationConversion(summary) || getMetric("monetization_conversion_rate");
    const compareConversion = compareImport ? getCompareMetric("monetization_conversion_rate") : null;
    const storeExposure = summary.monetizationStoreFunnel?.[0]?.count ?? getMetric("monetization_event_count");
    const compareStoreExposure = compareSummary.monetizationStoreFunnel?.[0]?.count ?? (compareImport ? getCompareMetric("monetization_event_count") : null);
    const clickRate = summary.monetizationStoreFunnel?.[1]?.rate ?? null;
    const compareClickRate = compareSummary.monetizationStoreFunnel?.[1]?.rate ?? null;
    const orderRate = summary.monetizationStoreFunnel?.[2]?.rate ?? 0;
    const compareOrderRate = compareSummary.monetizationStoreFunnel?.[2]?.rate ?? null;
    const successRate = summary.monetizationPaymentFunnel?.at(-1)?.rate ?? 0;
    const compareSuccessRate = compareSummary.monetizationPaymentFunnel?.at(-1)?.rate ?? null;

    return {
      ...base,
      metrics: [
        metricCard("商店曝光数", storeExposure.toFixed(0), compareStoreExposure !== null ? compareStoreExposure.toFixed(0) : null),
        metricCard("点击率", clickRate !== null ? formatMetric(clickRate) : "—", compareClickRate !== null ? formatMetric(compareClickRate) : null),
        metricCard("下单率", formatMetric(orderRate), compareOrderRate !== null ? formatMetric(compareOrderRate) : null),
        metricCard("支付成功率", formatMetric(successRate), compareSuccessRate !== null ? formatMetric(compareSuccessRate) : null)
      ],
      main: normalizeSeries((summary.monetizationStoreFunnel ?? []).map((stage) => stage.rate ?? stage.count)),
      compareMain: compareSummary.monetizationStoreFunnel?.length
        ? normalizeSeries((compareSummary.monetizationStoreFunnel ?? []).map((stage) => stage.rate ?? stage.count))
        : emptyCompareSeries(normalizeSeries((summary.monetizationStoreFunnel ?? []).map((stage) => stage.rate ?? stage.count))),
      trend: buildRecentTrend(allSnapshots, "monetization_conversion_rate", fallback.trend),
      compareTrend: compareImport
        ? buildRecentTrend(compareSnapshots, "monetization_conversion_rate", fallback.trend)
        : emptyCompareSeries(buildRecentTrend(allSnapshots, "monetization_conversion_rate", fallback.trend)),
      aux: normalizeDistribution((summary.giftPackDistribution ?? []).slice(0, 6).map((item) => item.exposures || item.successes)),
      auxLabels: (summary.giftPackDistribution ?? []).slice(0, 6).map((item) => item.name),
      ranking: (summary.giftPackDistribution ?? []).slice(0, 5).map((item) => [item.name, `成功率 ${item.successRate.toFixed(1)}%`] as [string, string]),
      detailRows:
        summary.giftPackDistribution?.length
          ? buildMonetizationRows(summary, compareSummary)
          : buildDetailRows(category, categorySummary, compareCategorySummary, compareImport?.version),
      insight:
        compareImport && compareConversion !== null
          ? `${categorySummary.insight} 与 ${compareImport.version} 相比，商业化转化率 ${versionDelta(conversion, compareConversion)}，支付成功率 ${versionDelta(successRate, compareSuccessRate)}。`
          : categorySummary.insight,
      compareInsight: compareSummaryText,
      monetizationStoreFunnel: summary.monetizationStoreFunnel ?? [],
      monetizationPaymentFunnel: summary.monetizationPaymentFunnel ?? [],
      giftPackDistribution: summary.giftPackDistribution ?? [],
      monetizationNote:
        summary.monetizationStoreFunnel?.some((item) => item.inferred) ||
        summary.monetizationPaymentFunnel?.some((item) => item.inferred) ||
        summary.giftPackDistribution?.some((item) => item.inferred)
          ? "当前部分商店、礼包或支付阶段基于可识别事件链路推断，更适合判断损耗区间，不建议直接作为绝对归因。"
          : null
    };
  }

  if (category === "ads") {
    const trigger = sumAdBreakdownCount(summary.adPlacementBreakdown, "requests") ?? sumAdFlowCount(summary.adPlacementFlow, "requests");
    const compareTrigger = sumAdBreakdownCount(compareSummary.adPlacementBreakdown, "requests") ?? sumAdFlowCount(compareSummary.adPlacementFlow, "requests");
    const completion = sumAdBreakdownCount(summary.adPlacementBreakdown, "plays") ?? sumAdFlowCount(summary.adPlacementFlow, "plays");
    const compareCompletion = sumAdBreakdownCount(compareSummary.adPlacementBreakdown, "plays") ?? sumAdFlowCount(compareSummary.adPlacementFlow, "plays");
    const reward = sumAdBreakdownCount(summary.adPlacementBreakdown, "clicks") ?? sumAdFlowCount(summary.adPlacementFlow, "clicks");
    const compareReward = sumAdBreakdownCount(compareSummary.adPlacementBreakdown, "clicks") ?? sumAdFlowCount(compareSummary.adPlacementFlow, "clicks");
    const rewardCompletion = summary.adPlacementBreakdown?.length
      ? clampPercent(
          (summary.adPlacementBreakdown.reduce((sum, item) => sum + item.rewards, 0) /
            Math.max(summary.adPlacementBreakdown.reduce((sum, item) => sum + item.plays, 0), 1)) *
            100
        )
      : getMetric("ad_reward_rate");
    const compareRewardCompletion = compareSummary.adPlacementBreakdown?.length
      ? clampPercent(
          (compareSummary.adPlacementBreakdown.reduce((sum, item) => sum + item.rewards, 0) /
            Math.max(compareSummary.adPlacementBreakdown.reduce((sum, item) => sum + item.plays, 0), 1)) *
            100
        )
      : null;

    return {
      ...base,
      metrics: [
        countMetricCard("请求数", trigger, compareTrigger),
        countMetricCard("播放数", completion, compareCompletion),
        countMetricCard("点击数", reward, compareReward),
        metricCard("发奖完成率", formatMetric(rewardCompletion), compareRewardCompletion !== null ? formatMetric(compareRewardCompletion) : null)
      ],
      main: normalizeSeries((summary.adPlacementFlow ?? []).map((item) => item.plays)),
      compareMain: compareSummary.adPlacementFlow?.length
        ? normalizeSeries((compareSummary.adPlacementFlow ?? []).map((item) => item.plays))
        : emptyCompareSeries(normalizeSeries((summary.adPlacementFlow ?? []).map((item) => item.plays))),
      trend: buildRecentTrend(allSnapshots, "ad_completion_rate", fallback.trend),
      compareTrend: compareImport
        ? buildRecentTrend(compareSnapshots, "ad_completion_rate", fallback.trend)
        : emptyCompareSeries(buildRecentTrend(allSnapshots, "ad_completion_rate", fallback.trend)),
      aux: normalizeDistribution((summary.adPlacementBreakdown ?? []).slice(0, 6).map((item) => item.requests)),
      auxLabels: (summary.adPlacementBreakdown ?? []).slice(0, 6).map((item) => item.placement),
      ranking: (summary.adPlacementBreakdown ?? []).slice(0, 5).map((item) => [item.placement, `请求 ${item.requests} / 点击率 ${item.clickRate.toFixed(1)}%`] as [string, string]),
      detailRows:
        summary.adPlacementBreakdown?.length
          ? buildAdRows(summary, compareSummary)
          : buildDetailRows(category, categorySummary, compareCategorySummary, compareImport?.version),
      insight:
        compareImport && completion !== null && compareCompletion !== null && reward !== null && compareReward !== null
          ? `${categorySummary.insight} 与 ${compareImport.version} 相比，广告播放数 ${versionDelta(completion, compareCompletion, "")}，点击数 ${versionDelta(reward, compareReward, "")}。`
          : categorySummary.insight,
      compareInsight: compareSummaryText,
      adPlacementBreakdown: summary.adPlacementBreakdown ?? [],
      adPlacementFlow: summary.adPlacementFlow ?? [],
      adsNote: summary.adPlacementBreakdown?.some((item) => item.inferred)
        ? "当前日志无法严格区分请求与播放时序，页面会把可识别的播放事件兼容推断为请求，因此请求 / 播放差值更适合定位埋点缺口，不宜直接解释为流量损耗。"
        : null
    };
  }

  const coverageRate = categorySummary.metrics.coverageRate ?? getMetric("import_success_rate");
  const compareCoverageRate = compareImport ? getCompareMetric("import_success_rate") : null;
  const usableRate = categorySummary.metrics.usableRate ?? getMetric("import_success_rate");
  const compareUsableRate = compareImport ? getCompareMetric("import_success_rate") : null;
  const eventCount = categorySummary.metrics.eventCount ?? ((summary.topEvents ?? []).length || 0);
  const compareEventCount = compareCategorySummary?.metrics.eventCount ?? ((compareSummary.topEvents ?? []).length || 0);
  const anomalyCount = categorySummary.metrics.anomalyCount ?? ((summary.failReasons ?? []).length || 0);
  const compareAnomalyCount = compareCategorySummary?.metrics.anomalyCount ?? ((compareSummary.failReasons ?? []).length || 0);

  return {
    ...base,
    metrics: [
      {
        label: "自定义事件数",
        value: String(eventCount),
        compareValue: compareImport ? String(compareEventCount) : null
      },
      { label: "字段覆盖率", value: formatMetric(coverageRate), compareValue: compareCoverageRate !== null ? formatMetric(compareCoverageRate) : null },
      { label: "分析可用率", value: formatMetric(usableRate), compareValue: compareUsableRate !== null ? formatMetric(compareUsableRate) : null },
      {
        label: "待补异常标签",
        value: String(anomalyCount),
        compareValue: compareImport ? String(compareAnomalyCount) : null
      }
    ],
    main: normalizeSeries(categorySummary.main),
    compareMain: compareCategorySummary ? normalizeSeries(compareCategorySummary.main) : emptyCompareSeries(normalizeSeries(categorySummary.main)),
    trend: buildRecentTrend(allSnapshots, "import_success_rate", fallback.trend),
    compareTrend: compareImport
      ? buildRecentTrend(compareSnapshots, "import_success_rate", fallback.trend)
      : emptyCompareSeries(buildRecentTrend(allSnapshots, "import_success_rate", fallback.trend)),
    aux: categorySummary.aux.length ? categorySummary.aux : fallback.aux,
    auxLabels: categorySummary.auxLabels.length ? categorySummary.auxLabels : fallback.auxLabels,
    ranking: buildRanking(categorySummary.ranking, "自定义事件", " 次"),
    detailRows: buildDetailRows(category, categorySummary, compareCategorySummary, compareImport?.version),
    insight:
      compareImport
        ? `${categorySummary.insight} 与 ${compareImport.version} 相比，字段覆盖率 ${versionDelta(coverageRate, compareCoverageRate)}。`
        : categorySummary.insight,
    compareInsight: compareSummaryText
  };
}
