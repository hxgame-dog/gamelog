import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import styles from "@/components/analytics-page.module.css";
import { AnalyticsBatchSwitcher } from "@/components/analytics-batch-client";
import { AnalyticsDetailClient } from "@/components/analytics-detail-client";
import { AnalyticsExportButton } from "@/components/analytics-export-client";
import { AppShell } from "@/components/app-shell";
import {
  AdPlacementFlowCard,
  BarChartCard,
  DonutChartCard,
  LevelProgressCard,
  LineChartCard,
  MonetizationDualFunnelCard,
  OnboardingDurationRankingCard,
  OnboardingFunnelCard,
  OnboardingTrendCard,
  PageHeader,
  VersionCompareSwitch
} from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { getAnalyticsCategoryData, getLevelDiagnostics, getMonetizationWorstLossStage } from "@/lib/server/analytics";
import { getProjectsForUser } from "@/lib/server/projects";

const validCategories = new Set(["system", "onboarding", "level", "monetization", "ads", "custom"]);

// Keep onboarding in this dedicated funnel-analysis sequence instead of the shared analytics chart ordering.
const onboardingSections = [
  "数据质量卡",
  "关键结论卡",
  "最大流失步骤信号",
  "步骤漏斗图",
  "步骤完成率曲线",
  "步骤耗时排行",
  "步骤明细表"
] as const;

// Keep level in this dedicated level-first analysis sequence instead of the shared analytics chart ordering.
const levelSections = [
  "数据质量卡",
  "关键结论卡",
  "失败最集中关卡",
  "重试最高关卡",
  "行为占比异常关卡",
  "关卡漏斗主图",
  "失败原因分布",
  "重试排行",
  "局内微观心流",
  "关卡明细表",
  "心流明细表"
] as const;

const monetizationSections = [
  "数据质量卡",
  "关键结论卡",
  "最大转化损耗点",
  "最佳礼包/计费点",
  "统计口径提示",
  "双漏斗主图",
  "计费点/礼包分布",
  "商业化明细表"
] as const;

const adsSections = [
  "数据质量卡",
  "关键结论卡",
  "最弱广告位",
  "流量最大广告位",
  "统计口径提示",
  "广告位流转主图",
  "广告位排行",
  "广告位构成",
  "广告明细表"
] as const;

function ModuleSectionHeader({
  title,
  copy,
  badge
}: {
  title: string;
  copy: string;
  badge: string;
}) {
  return (
    <div className={styles.moduleHeader}>
      <div>
        <h2 className="section-title" style={{ fontSize: 18 }}>
          {title}
        </h2>
        <p className={styles.sectionCopy}>{copy}</p>
      </div>
      <span className="pill">{badge}</span>
    </div>
  );
}

function ModuleQualityCards({
  importPreviewHref,
  qualityNote,
  compareVersionLabel,
  technicalSuccessRate,
  technicalErrorCount,
  businessFailureCount,
  moduleCoverage,
  compareTechnicalSuccessRate,
  compareTechnicalErrorCount,
  compareBusinessFailureCount,
  compareModuleCoverage,
  notes
}: {
  importPreviewHref: string | null;
  qualityNote: string;
  compareVersionLabel?: string | null;
  technicalSuccessRate?: number;
  technicalErrorCount?: number;
  businessFailureCount?: number;
  moduleCoverage?: number;
  compareTechnicalSuccessRate?: number | null;
  compareTechnicalErrorCount?: number | null;
  compareBusinessFailureCount?: number | null;
  compareModuleCoverage?: number | null;
  notes: {
    success: string;
    errors: string;
    business: string;
  };
}) {
  const cards = [
    {
      label: "技术通过率",
      value: `${technicalSuccessRate?.toFixed(1) ?? "0.0"}%`,
      compare:
        compareTechnicalSuccessRate !== null && compareTechnicalSuccessRate !== undefined && compareVersionLabel
          ? `对比 ${compareVersionLabel}: ${compareTechnicalSuccessRate.toFixed(1)}%`
          : notes.success
    },
    {
      label: "技术异常",
      value: `${technicalErrorCount ?? 0}`,
      compare:
        compareTechnicalErrorCount !== null && compareTechnicalErrorCount !== undefined && compareVersionLabel
          ? `对比 ${compareVersionLabel}: ${compareTechnicalErrorCount}`
          : notes.errors
    },
    {
      label: "业务失败事件",
      value: `${businessFailureCount ?? 0}`,
      compare:
        compareBusinessFailureCount !== null && compareBusinessFailureCount !== undefined && compareVersionLabel
          ? `对比 ${compareVersionLabel}: ${compareBusinessFailureCount}`
          : notes.business
    },
    {
      label: "模块覆盖率",
      value: `${moduleCoverage?.toFixed(1) ?? "0.0"}%`,
      compare:
        compareModuleCoverage !== null && compareModuleCoverage !== undefined && compareVersionLabel
          ? `对比 ${compareVersionLabel}: ${compareModuleCoverage.toFixed(1)}%`
          : qualityNote
    }
  ];

  return (
    <>
      <div className={styles.moduleGrid}>
        {cards.map((card) => (
          <article key={card.label} className={`${styles.moduleCard} ${importPreviewHref ? styles.moduleCardInteractive : ""}`}>
            {importPreviewHref ? (
              <Link
                href={importPreviewHref}
                className={styles.moduleCardLink}
                aria-label={`查看${card.label}对应的当前批次导入预览`}
              />
            ) : null}
            <div className={styles.moduleCardLabel}>{card.label}</div>
            <div className={styles.moduleCardValue}>{card.value}</div>
            <div className={styles.moduleCardMeta}>{card.compare}</div>
          </article>
        ))}
      </div>
      <div className={styles.moduleSubNote}>
        <span className="pill">质量底座</span>
        <span>{qualityNote}</span>
      </div>
    </>
  );
}

function ModuleRiskBanner({
  moduleRisk,
  importPreviewHref
}: {
  moduleRisk?: {
    status: "PENDING" | "PASS" | "HIGH_RISK" | "SEVERE_GAP" | "MISSING";
    canAnalyze: boolean;
    issueCount: number;
    globalIssueCount: number;
    missingEvents: string[];
    missingFields: string[];
    topIssues: Array<{
      severity: "error" | "warning" | "info";
      target: string;
      message: string;
      suggestion?: string;
    }>;
    note: string;
  } | null;
  importPreviewHref: string | null;
}) {
  if (!moduleRisk) {
    return null;
  }

  const statusMeta =
    moduleRisk.status === "PASS"
      ? {
          title: "严格诊断通过",
          badge: "PASS",
          className: styles.riskBannerPass
        }
      : moduleRisk.status === "PENDING"
        ? {
            title: "严格诊断待生成",
            badge: "PENDING",
            className: styles.riskBannerPending
          }
        : moduleRisk.status === "SEVERE_GAP"
          ? {
              title: "严格诊断发现严重缺口",
              badge: "SEVERE_GAP",
              className: styles.riskBannerSevere
            }
          : {
              title: moduleRisk.status === "MISSING" ? "严格诊断提示当前结构缺失" : "严格诊断提示当前存在高风险",
              badge: moduleRisk.status,
              className: styles.riskBannerRisk
            };
  const summaryCopy =
    moduleRisk.status === "PASS"
      ? "下方图表可以直接拿来解释业务变化，如果仍有异常，更像真实体验或策略问题。"
      : moduleRisk.status === "PENDING"
        ? "下方图表仍会继续展示，但当前更适合把它们当成待补诊断的复核线索，而不是明确风险结论。"
        : moduleRisk.canAnalyze
          ? "下方图表仍会继续展示，但需要把异常结论和诊断缺口一起阅读，避免过度归因。"
          : "下方图表仍会继续展示，但当前缺口会明显削弱解释力，建议先修复导入结构再做定性。";
  const conclusionLabel =
    moduleRisk.status === "PENDING"
      ? "等待诊断"
      : moduleRisk.status === "PASS"
        ? "可直接阅读"
        : moduleRisk.canAnalyze
          ? "谨慎解读"
          : "先修结构";

  return (
    <section className={`${styles.riskBanner} ${statusMeta.className}`}>
      <div className={styles.riskBannerHeader}>
        <div>
          <div className={styles.riskBannerEyebrow}>模块风险提示</div>
          <h2 className={styles.riskBannerTitle}>{statusMeta.title}</h2>
          <p className={styles.riskBannerCopy}>{moduleRisk.note}</p>
        </div>
        <span className={`pill ${styles.riskBannerPill}`}>{statusMeta.badge}</span>
      </div>

      <div className={styles.riskBannerStats}>
        <div className={styles.riskBannerStat}>
          <span className={styles.riskBannerStatLabel}>相关问题</span>
          <strong>{moduleRisk.issueCount}</strong>
        </div>
        <div className={styles.riskBannerStat}>
          <span className={styles.riskBannerStatLabel}>公共属性影响</span>
          <strong>{moduleRisk.globalIssueCount}</strong>
        </div>
        <div className={styles.riskBannerStat}>
          <span className={styles.riskBannerStatLabel}>当前结论</span>
          <strong>{conclusionLabel}</strong>
        </div>
      </div>

      <p className={styles.riskBannerSupport}>{summaryCopy}</p>

      {moduleRisk.missingEvents.length || moduleRisk.missingFields.length ? (
        <div className={styles.riskBannerMissing}>
          {moduleRisk.missingEvents.length ? <span>缺事件：{moduleRisk.missingEvents.join(" / ")}</span> : null}
          {moduleRisk.missingFields.length ? <span>缺字段：{moduleRisk.missingFields.join(" / ")}</span> : null}
        </div>
      ) : null}

      {moduleRisk.topIssues.length ? (
        <div className={styles.riskBannerIssueList}>
          {moduleRisk.topIssues.map((issue) => (
            <div key={`${issue.severity}-${issue.target}`} className={styles.riskBannerIssue}>
              <strong>{issue.target}</strong>
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {importPreviewHref ? (
        <Link href={importPreviewHref} className={styles.riskBannerLink}>
          回到当前批次导入预览核对原始字段
        </Link>
      ) : null}
    </section>
  );
}

function ModuleConclusionCards({
  metrics,
  color,
  compareVersionLabel,
  emptyLabel,
  children
}: {
  metrics: Array<{ label: string; value: string; compareValue?: string | null }>;
  color: string;
  compareVersionLabel?: string | null;
  emptyLabel: string;
  children?: ReactNode;
}) {
  return (
    <>
      <div className={styles.moduleGrid}>
        {metrics.length ? (
          metrics.map((metric) => (
            <article key={metric.label} className={styles.moduleCard}>
              <div className={styles.moduleCardLabel}>{metric.label}</div>
              <div className={styles.moduleCardValue} style={{ color }}>
                {metric.value}
              </div>
              <div className={styles.moduleCardMeta}>
                {metric.compareValue && compareVersionLabel
                  ? `对比 ${compareVersionLabel}: ${metric.compareValue}`
                  : emptyLabel}
              </div>
            </article>
          ))
        ) : (
          <div className={styles.moduleEmptyState}>当前批次还没有足够的结论指标，导入更多业务样本后会自动补齐。</div>
        )}
      </div>
      {children}
    </>
  );
}

export default async function AnalyticsCategoryPage({
  params,
  searchParams
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ projectId?: string; compareVersion?: string; importId?: string; detailFilter?: "all" | "abnormal" | "delta" }>;
}) {
  const user = await requireUser();
  const { category } = await params;

  if (!validCategories.has(category)) {
    notFound();
  }

  const projects = await getProjectsForUser(user.id);
  const { projectId, compareVersion, importId, detailFilter } = await searchParams;
  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const config = await getAnalyticsCategoryData(
    category as "system" | "onboarding" | "level" | "monetization" | "ads" | "custom",
    activeProjectId,
    compareVersion,
    importId
  ) as unknown as {
    title: string;
    color: string;
    sourceLabel: string;
    versionLabel: string;
    currentImportId?: string | null;
    compareVersionLabel?: string | null;
    technicalSuccessRate?: number;
    technicalErrorCount?: number;
    businessFailureCount?: number;
    moduleCoverage?: number;
    compareTechnicalSuccessRate?: number | null;
    compareTechnicalErrorCount?: number | null;
    compareBusinessFailureCount?: number | null;
    compareModuleCoverage?: number | null;
    moduleRisk?: {
      status: "PENDING" | "PASS" | "HIGH_RISK" | "SEVERE_GAP" | "MISSING";
      canAnalyze: boolean;
      issueCount: number;
      globalIssueCount: number;
      missingEvents: string[];
      missingFields: string[];
      topIssues: Array<{
        severity: "error" | "warning" | "info";
        target: string;
        message: string;
        suggestion?: string;
      }>;
      note: string;
    } | null;
    versionOptions?: string[];
    importOptions?: Array<{ id: string; label: string; source?: string | null }>;
    categories: ReadonlyArray<{ key: string; label: string }>;
    metrics: Array<{ label: string; value: string; compareValue?: string | null }>;
    main: number[];
    compareMain?: number[];
    trend: number[];
    compareTrend?: number[];
    aux: number[];
    auxLabels: string[];
    ranking: Array<[string, string]>;
    detailRows: Array<{ label: string; current: string; compare?: string | null; delta?: string | null; note: string }>;
    onboardingRows?: Array<{ stepId: string; stepName: string; arrivals: number; completions: number; completionRate: number; avgDuration: number }>;
    levelRows?: Array<{ levelId: string; levelType: string; starts: number; completes: number; fails: number; retries: number; topFailReason: string }>;
    microflowRows?: Array<{ levelId: string; action: string; count: number; ratio: number; avgDuration: number }>;
    onboardingFunnel?: Array<{ stepId: string; stepName: string; arrivals: number; completions: number; completionRate: number; dropoffCount: number; avgDuration: number }>;
    onboardingStepTrend?: Array<{ stepId: string; stepName: string; arrivals: number; completions: number; completionRate: number; avgDuration: number }>;
    compareOnboardingFunnel?: Array<{ stepId: string; stepName: string; arrivals: number; completions: number; completionRate: number; dropoffCount: number; avgDuration: number }>;
    compareOnboardingStepTrend?: Array<{ stepId: string; stepName: string; arrivals: number; completions: number; completionRate: number; avgDuration: number }>;
    levelFunnel?: Array<{ levelId: string; levelType: string; starts: number; completes: number; fails: number; retries: number; completionRate: number; failRate: number; topFailReason: string }>;
    levelFailReasonDistribution?: Array<{ name: string; count: number }>;
    levelRetryRanking?: Array<{ levelId: string; levelType: string; retries: number; starts: number; retryRate: number }>;
    microflowByLevel?: Array<{ levelId: string; actions: Array<{ action: string; count: number; ratio: number; avgDuration: number }> }>;
    levelDiagnostics?: {
      levelWorst: Array<{ levelId: string; levelType: string; starts: number; completes: number; fails: number; retries: number; completionRate: number; failRate: number; topFailReason: string }>;
      levelRetryHot: Array<{ levelId: string; levelType: string; retries: number; starts: number; retryRate: number }>;
      microflowHot: Array<{ levelId: string; action: string; count: number; ratio: number; avgDuration: number }>;
    };
    compareLevelFunnel?: Array<{ levelId: string; levelType: string; starts: number; completes: number; fails: number; retries: number; completionRate: number; failRate: number; topFailReason: string }>;
    monetizationStoreFunnel?: Array<{ label: string; count: number; rate?: number; inferred?: boolean }>;
    monetizationPaymentFunnel?: Array<{ label: string; count: number; rate?: number; inferred?: boolean }>;
    giftPackDistribution?: Array<{ name: string; exposures: number; clicks: number; orders: number; successes: number; successRate: number; inferred?: boolean }>;
    monetizationNote?: string | null;
    adPlacementBreakdown?: Array<{ placement: string; requests: number; plays: number; clicks: number; rewards: number; clickRate: number; rewardRate: number; inferred?: boolean }>;
    adPlacementFlow?: Array<{ placement: string; requests: number; plays: number; clicks: number }>;
    adsNote?: string | null;
    insight: string;
    compareInsight?: string | null;
  };

  const chartTitle =
    category === "onboarding"
      ? "步骤漏斗图"
      : category === "level"
        ? "关卡漏斗图"
        : category === "monetization"
          ? "商店转化漏斗"
          : category === "ads"
            ? "广告位漏斗对比"
            : "核心漏斗";
  const chartCopy =
    category === "onboarding"
      ? "按 step_id / step_name 展示步骤到达与流失，优先识别掉队最多的节点。"
      : category === "level"
        ? "按关卡展示 start / complete / fail 的主漏斗，判断哪关最容易卡住。"
        : category === "monetization"
          ? "主图展示商店/礼包曝光到支付成功的漏斗，辅助判断入口和支付链路是否衰减。"
          : category === "ads"
            ? "主图展示广告位请求、播放、点击的差异，优先识别表现异常的广告位。"
            : "主图承载当前分类最关键的漏斗或主流程结论。";
  const trendTitle =
    category === "onboarding" ? "步骤趋势图" : category === "level" ? "关卡趋势图" : category === "monetization" ? "支付趋势图" : category === "ads" ? "广告位趋势图" : "版本趋势";
  const auxTitle =
    category === "onboarding" ? "步骤耗时排行" : category === "level" ? "失败原因分布" : category === "monetization" ? "礼包分布" : category === "ads" ? "广告位构成" : "构成分析";
  const auxCopy =
    category === "onboarding"
      ? "查看耗时异常步骤，确认高耗时是否与高流失同时出现。"
      : category === "level"
        ? "优先看失败原因分布，判断是超时、资源不足还是操作问题。"
        : category === "monetization"
          ? "礼包分布用于判断哪个礼包承担了主要曝光、下单和成功。"
        : category === "ads"
          ? "广告位构成用于识别流量主要集中在哪些 placement。"
          : "查看当前分类中最主要的事件构成、广告位分布或失败原因。";
  const pageCopy =
    category === "onboarding"
      ? "围绕新手引导步骤展示漏斗、流失、耗时和版本差异，帮助团队快速定位最容易掉队的步骤。"
      : category === "level"
        ? "围绕关卡开始、完成、失败、重试和局内行为构成，帮助团队判断哪一关卡住、为什么卡住。"
        : category === "monetization"
          ? "围绕商店/礼包曝光到支付成功的链路，查看转化损耗点、礼包分布和版本变化。"
          : category === "ads"
            ? "围绕广告位请求、播放、点击和发奖流转，帮助团队识别表现最弱的广告位和链路断点。"
          : "围绕当前模块展示版本对比、关键指标、核心结构图和 AI 判断，帮助团队快速确认问题位置与影响范围。";

  const levelDiagnostics =
    config.levelDiagnostics ??
    getLevelDiagnostics({
      levelFunnel: config.levelFunnel ?? [],
      levelRetryRanking: config.levelRetryRanking ?? [],
      microflowByLevel: config.microflowByLevel ?? []
    });
  const levelWorst = levelDiagnostics.levelWorst[0] ?? null;
  const levelRetryHot = levelDiagnostics.levelRetryHot[0] ?? null;
  const microflowHot = levelDiagnostics.microflowHot[0] ?? null;
  const nextWorstLevel = levelDiagnostics.levelWorst[1] ?? null;
  const nextRetryLevel = levelDiagnostics.levelRetryHot[1] ?? null;
  const nextMicroflowHot = levelDiagnostics.microflowHot[1] ?? null;
  const storeLossStage = getMonetizationWorstLossStage({
    monetizationStoreFunnel: config.monetizationStoreFunnel,
    monetizationPaymentFunnel: config.monetizationPaymentFunnel
  });
  const bestPack = config.giftPackDistribution?.slice().sort((a, b) => b.successRate - a.successRate)[0] ?? null;
  const weakestPlacement = config.adPlacementBreakdown?.slice().sort((a, b) => a.clickRate - b.clickRate)[0] ?? null;
  const highestVolumePlacement =
    config.adPlacementBreakdown?.slice().sort((a, b) => b.requests - a.requests)[0] ?? null;
  const hasInference =
    Boolean(config.monetizationStoreFunnel?.some((item) => item.inferred)) ||
    Boolean(config.monetizationPaymentFunnel?.some((item) => item.inferred)) ||
    Boolean(config.giftPackDistribution?.some((item) => item.inferred)) ||
    Boolean(config.adPlacementBreakdown?.some((item) => item.inferred));
  const qualityNote = hasInference
    ? "当前页面包含部分推断统计，建议结合导入预览一起核对口径。"
    : "当前页面主要基于显式日志链路统计，可直接用于版本对比。";
  const compareVersionParam = compareVersion ?? config.compareVersionLabel ?? null;
  const importPreviewHref =
    activeProjectId && config.currentImportId
      ? `/imports?${new URLSearchParams(
          Object.fromEntries(
            [
              ["projectId", activeProjectId],
              ["importId", config.currentImportId],
              compareVersionParam ? ["compareVersion", compareVersionParam] : null,
              detailFilter ? ["detailFilter", detailFilter] : null
            ].filter(Boolean) as Array<[string, string]>
          )
        ).toString()}`
      : null;
  const onboardingChecklist = onboardingSections.join(" / ");
  const levelChecklist = levelSections.join(" / ");
  const monetizationChecklist = monetizationSections.join(" / ");
  const adsChecklist = adsSections.join(" / ");
  const onboardingRows = category === "onboarding" ? config.onboardingFunnel ?? [] : [];
  const compareOnboardingRows = category === "onboarding" ? config.compareOnboardingFunnel ?? [] : [];
  const onboardingTrendRows = category === "onboarding" ? config.onboardingStepTrend ?? onboardingRows : [];
  const onboardingCompareMap = new Map(compareOnboardingRows.map((row) => [row.stepId || row.stepName, row]));
  const levelRows = category === "level" ? levelDiagnostics.levelWorst : [];
  const compareLevelMap = new Map((config.compareLevelFunnel ?? []).map((row) => [row.levelId, row]));
  const levelRetryRows = category === "level" ? levelDiagnostics.levelRetryHot : [];
  const levelMicroflowRows = category === "level" ? levelDiagnostics.microflowHot : [];
  const levelMicroflowGroups =
    category === "level"
      ? (config.microflowByLevel ?? [])
          .map((group) => ({
            ...group,
            actions: group.actions.slice().sort((a, b) => b.ratio - a.ratio)
          }))
          .sort((a, b) => (b.actions[0]?.ratio ?? 0) - (a.actions[0]?.ratio ?? 0))
      : [];
  const topLevelFailReason = (config.levelFailReasonDistribution ?? []).slice().sort((a, b) => b.count - a.count)[0] ?? null;
  const levelActionItems = [
    levelWorst
      ? {
          title: "先处理失败最集中的关卡",
          detail: `${levelWorst.levelType ? `${levelWorst.levelId} (${levelWorst.levelType})` : levelWorst.levelId} 当前失败率 ${levelWorst.failRate.toFixed(
            1
          )}% ，主要失败原因是 ${levelWorst.topFailReason || "未记录"}，建议先回看关卡目标、时间压力和关键阻塞交互。`
        }
      : {
          title: "等待更多关卡失败样本",
          detail: "当前批次还没有足够的关卡样本，暂时无法判断最该优先修复哪一关。"
        },
    levelRetryHot
      ? {
          title: "复核最高重试热点",
          detail: `${levelRetryHot.levelType ? `${levelRetryHot.levelId} (${levelRetryHot.levelType})` : levelRetryHot.levelId} 当前重试率 ${levelRetryHot.retryRate.toFixed(
            1
          )}% ，说明玩家愿意反复尝试但仍过不去，适合优先检查失败反馈和复活/道具承接。`
        }
      : {
          title: "等待更多重试样本",
          detail: "当前批次还没有显著的重试堆积，暂时无法判断哪一关最容易把玩家拖进反复尝试。"
        },
    microflowHot
      ? {
          title: "排查异常局内行为",
          detail: `${microflowHot.levelId} 中 ${microflowHot.action} 占比 ${microflowHot.ratio.toFixed(
            1
          )}% ，平均耗时 ${microflowHot.avgDuration.toFixed(1)} 秒，建议确认它是不是玩家卡住后的补救动作。`
        }
      : {
          title: "等待更多局内行为样本",
          detail: "当前批次还没有明显的动作占比异常，暂时无法判断局内是否存在特定补救行为被过度触发。"
        },
    topLevelFailReason
      ? {
          title: "观察主要失败原因是否扩散",
          detail: `${topLevelFailReason.name} 当前出现 ${topLevelFailReason.count} 次，如果它同时出现在多个热点关卡，优先按系统性难点处理，而不是逐关微调。`
        }
      : {
          title: "等待失败原因分布",
          detail: "当前批次还没有足够的失败原因数据，先补齐失败原因埋点再做更细的难度诊断会更稳。"
        }
  ];
  const onboardingLargestDrop = onboardingRows.slice().sort((a, b) => b.dropoffCount - a.dropoffCount)[0] ?? null;
  const onboardingSlowestStep = onboardingRows.slice().sort((a, b) => b.avgDuration - a.avgDuration)[0] ?? null;
  const onboardingLastStep = onboardingRows.at(-1) ?? null;
  const onboardingAverageCompletion = onboardingRows.length
    ? onboardingRows.reduce((sum, row) => sum + row.completionRate, 0) / onboardingRows.length
    : 0;
  const compareOnboardingAverageCompletion = compareOnboardingRows.length
    ? compareOnboardingRows.reduce((sum, row) => sum + row.completionRate, 0) / compareOnboardingRows.length
    : null;
  const onboardingAverageDuration = onboardingRows.length
    ? onboardingRows.reduce((sum, row) => sum + row.avgDuration, 0) / onboardingRows.length
    : 0;
  const onboardingDropoffRate = onboardingLargestDrop
    ? onboardingLargestDrop.arrivals
      ? (onboardingLargestDrop.dropoffCount / onboardingLargestDrop.arrivals) * 100
      : 0
    : 0;
  const onboardingActionItems = [
    onboardingLargestDrop
      ? {
          title: "优先修复最大流失步骤",
          detail: `${onboardingLargestDrop.stepName || onboardingLargestDrop.stepId} 当前流失率 ${onboardingDropoffRate.toFixed(
            1
          )}% ，建议先检查引导文案、交互反馈和前后步骤衔接。`
        }
      : {
          title: "等待更多流失样本",
          detail: "当前批次还没有足够的步骤流失样本，建议继续导入新手引导明细后再判断最先修哪里。"
        },
    onboardingSlowestStep
      ? {
          title: "检查异常耗时步骤",
          detail: `${onboardingSlowestStep.stepName || onboardingSlowestStep.stepId} 平均耗时 ${onboardingSlowestStep.avgDuration.toFixed(
            1
          )} 秒，高于步骤均值 ${onboardingAverageDuration.toFixed(1)} 秒，适合优先排查理解成本和等待时机。`
        }
      : {
          title: "等待更多耗时样本",
          detail: "当前批次缺少足够的耗时数据，暂时无法判断哪一步骤最容易让玩家犹豫。"
        },
    onboardingLastStep
      ? {
          title: "复核尾步承接表现",
          detail: `${onboardingLastStep.stepName || onboardingLastStep.stepId} 完成率 ${onboardingLastStep.completionRate.toFixed(
            1
          )}% ，用于确认玩家是否在最后几步被奖励承接或难度陡增挡住。`
        }
      : {
          title: "等待尾步完成样本",
          detail: "当前批次还没有足够的尾步样本，暂时无法判断最终收口步骤是否存在问题。"
        }
  ];
  const monetizationDistributionRows = (config.giftPackDistribution ?? [])
    .slice()
    .sort((a, b) => b.exposures - a.exposures || b.successRate - a.successRate);
  const monetizationDistributionValues = monetizationDistributionRows
    .slice(0, 6)
    .map((item) => Math.max(item.exposures, item.successes, item.orders, 1));
  const monetizationDistributionLabels = monetizationDistributionRows.slice(0, 6).map((item) => item.name);
  const monetizationMethodNote =
    config.monetizationNote ?? "当前批次的商店曝光、下单和支付成功节点都来自显式事件链路，可直接用于版本对比。";
  const monetizationActionItems = [
    storeLossStage
      ? {
          title: "优先修复最大转化损耗点",
          detail: `${storeLossStage.funnelLabel} 的 ${storeLossStage.label} 当前流失 ${storeLossStage.drop} 次，建议先检查${
            storeLossStage.funnel === "payment" ? "支付确认、支付回调和订单状态落地" : "礼包入口文案、点击承接和下单前引导"
          }。`
        }
      : {
          title: "等待更多损耗链路样本",
          detail: "当前批次还没有足够的漏斗样本，暂时无法判断最大损耗发生在哪个商业化阶段。"
        },
    bestPack
      ? {
          title: "放大高转化礼包 / 计费点",
          detail: `${bestPack.name} 当前成功率 ${bestPack.successRate.toFixed(1)}% ，曝光 ${bestPack.exposures} 次，适合作为下一轮放量或承接优化的优先候选。`
        }
      : {
          title: "等待更多礼包分布样本",
          detail: "当前批次还没有足够的礼包或计费点分布，暂时无法判断哪一个入口最值得优先放大。"
        },
    monetizationDistributionRows[0]
      ? {
          title: "检查流量是否过度集中",
          detail: `${monetizationDistributionRows[0].name} 当前承担了最多曝光，如果它同时也是主要损耗点，优先做入口分流或强化其他礼包承接。`
        }
      : {
          title: "等待更多流量分布样本",
          detail: "当前批次还没有足够的商业化入口流量分布，暂时无法判断是否存在单点承压。"
        }
  ];
  const adsRankingRows = (config.adPlacementBreakdown ?? [])
    .slice()
    .sort((a, b) => b.requests - a.requests || b.clickRate - a.clickRate);
  const adsCompositionValues = adsRankingRows.slice(0, 6).map((item) => Math.max(item.requests, item.plays, item.clicks, 1));
  const adsCompositionLabels = adsRankingRows.slice(0, 6).map((item) => item.placement);
  const adsMethodNote =
    config.adsNote ?? "当前批次 request 与 play 已显式区分，可以直接比较广告位流转效率与发奖表现。";
  const adsMethodGuidance = config.adsNote
    ? "出现 request / play 歧义时，先把它当成埋点排查线索，而不是直接解释为流量损耗。"
    : "当前批次可以直接对比请求、播放、点击与发奖，不需要额外兼容推断。";
  const adsActionItems = [
    weakestPlacement
      ? {
          title: "优先修复最弱广告位",
          detail: `${weakestPlacement.placement} 当前点击率 ${weakestPlacement.clickRate.toFixed(
            1
          )}% 、发奖率 ${weakestPlacement.rewardRate.toFixed(1)}% ，建议优先检查展示时机、素材质量和回调链路。`
        }
      : {
          title: "等待更多广告位样本",
          detail: "当前批次还没有足够的广告位数据，暂时无法判断哪一个 placement 最该优先修复。"
        },
    highestVolumePlacement
      ? {
          title: "确认主流量广告位是否拖累整体体验",
          detail: `${highestVolumePlacement.placement} 当前请求 ${highestVolumePlacement.requests} 次，是主要流量入口；如果它表现偏弱，会直接拉低整体广告效率。`
        }
      : {
          title: "等待更多流量分布样本",
          detail: "当前批次还没有足够的广告位流量分布，暂时无法判断是否存在单个 placement 过度承压。"
        },
    config.adsNote
      ? {
          title: "先排查 request / play 口径歧义",
          detail: adsMethodGuidance
        }
      : {
          title: "直接按广告位效率做归因",
          detail: "当前批次 request 与 play 口径清晰，可以直接把表现差异解释为 placement、素材或奖励承接问题。"
        }
  ];

  return (
    <AppShell currentPath="/analytics">
      <PageHeader
        title={config.title}
        copy={pageCopy}
        actions={
          <div className="header-actions">
            <span className="pill">{config.sourceLabel}</span>
            <span className="pill">版本 {config.versionLabel}</span>
            {config.currentImportId ? <span className="pill">按导入批次查看</span> : null}
            {config.compareVersionLabel ? <span className="pill">对比 {config.compareVersionLabel}</span> : null}
            <AnalyticsBatchSwitcher
              category={category}
              projectId={activeProjectId}
              compareVersion={config.compareVersionLabel}
              currentImportId={config.currentImportId}
              importOptions={config.importOptions}
            />
            <AnalyticsExportButton
              payload={{
                title: config.title,
                category,
                versionLabel: config.versionLabel,
                compareVersionLabel: config.compareVersionLabel,
                metrics: config.metrics,
                main: config.main,
                compareMain: config.compareMain,
                trend: config.trend,
                compareTrend: config.compareTrend,
                aux: config.aux,
                auxLabels: config.auxLabels,
                ranking: config.ranking,
                detailRows: config.detailRows
              }}
            />
          </div>
        }
      />

      <div className={styles.layout}>
        <section className={`panel ${styles.hero}`}>
          <div className={styles.heroTop}>
            <div className={styles.heroLeft}>
              <div className={styles.switcher}>
                {config.categories.map((item) => (
                  <a
                    key={item.key}
                    href={`/analytics/${item.key}${
                      activeProjectId || config.compareVersionLabel || config.currentImportId
                        ? `?${new URLSearchParams(
                            Object.fromEntries(
                              [
                                activeProjectId ? ["projectId", activeProjectId] : null,
                                config.compareVersionLabel ? ["compareVersion", config.compareVersionLabel] : null,
                                config.currentImportId ? ["importId", config.currentImportId] : null,
                                detailFilter ? ["detailFilter", detailFilter] : null
                              ].filter(Boolean) as Array<[string, string]>
                            )
                          ).toString()}`
                        : ""
                    }`}
                    className={`${styles.pillButton} ${item.key === category ? styles.active : ""}`}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div className={styles.heroMeta}>
                <span className="pill">{config.sourceLabel}</span>
                <span className="pill">当前版本 {config.versionLabel}</span>
                {config.compareVersionLabel ? <span className="pill">对比版本 {config.compareVersionLabel}</span> : null}
              </div>
            </div>
            <div className={styles.heroRight}>
              <VersionCompareSwitch
                currentVersion={config.versionLabel}
                compareVersion={config.compareVersionLabel}
                versionOptions={config.versionOptions}
                buildHref={(version) =>
                  `/analytics/${category}${
                    activeProjectId || version || config.currentImportId || detailFilter
                      ? `?${new URLSearchParams(
                          Object.fromEntries(
                            [
                              activeProjectId ? ["projectId", activeProjectId] : null,
                              version ? ["compareVersion", version] : null,
                              config.currentImportId ? ["importId", config.currentImportId] : null,
                              detailFilter ? ["detailFilter", detailFilter] : null
                            ].filter(Boolean) as Array<[string, string]>
                          )
                        ).toString()}`
                      : ""
                  }`
                }
              />
            </div>
          </div>

          <div className={styles.compareSummary}>
            <div>
              <div className={styles.compareSummaryLabel}>版本差异总览</div>
              <div className={styles.compareSummaryTitle}>
                {config.compareVersionLabel ? `${config.versionLabel} vs ${config.compareVersionLabel}` : `${config.versionLabel} 当前视角`}
              </div>
            </div>
            <p className={styles.compareSummaryCopy}>{config.compareInsight ?? config.insight}</p>
          </div>

          {category === "system" || category === "custom" ? (
            <>
              <div className={styles.qualityGrid}>
                <div className={`${styles.qualityCard} ${importPreviewHref ? styles.qualityCardInteractive : ""}`}>
                  {importPreviewHref ? <Link href={importPreviewHref} className={styles.qualityCardLink} aria-label="查看技术通过率对应的当前批次导入预览" /> : null}
                  <div className={styles.qualityLabel}>技术通过率</div>
                  <div className={styles.qualityValue}>{config.technicalSuccessRate?.toFixed(1) ?? "0.0"}%</div>
                  {config.compareTechnicalSuccessRate !== null && config.compareTechnicalSuccessRate !== undefined ? (
                    <div className={styles.qualityMeta}>对比 {config.compareVersionLabel}: {config.compareTechnicalSuccessRate.toFixed(1)}%</div>
                  ) : null}
                </div>
                <div className={`${styles.qualityCard} ${importPreviewHref ? styles.qualityCardInteractive : ""}`}>
                  {importPreviewHref ? <Link href={importPreviewHref} className={styles.qualityCardLink} aria-label="查看技术异常对应的当前批次导入预览" /> : null}
                  <div className={styles.qualityLabel}>技术异常</div>
                  <div className={styles.qualityValue}>{config.technicalErrorCount ?? 0}</div>
                  {config.compareTechnicalErrorCount !== null && config.compareTechnicalErrorCount !== undefined ? (
                    <div className={styles.qualityMeta}>对比 {config.compareVersionLabel}: {config.compareTechnicalErrorCount}</div>
                  ) : null}
                </div>
                <div className={`${styles.qualityCard} ${importPreviewHref ? styles.qualityCardInteractive : ""}`}>
                  {importPreviewHref ? <Link href={importPreviewHref} className={styles.qualityCardLink} aria-label="查看业务失败事件对应的当前批次导入预览" /> : null}
                  <div className={styles.qualityLabel}>业务失败事件</div>
                  <div className={styles.qualityValue}>{config.businessFailureCount ?? 0}</div>
                  {config.compareBusinessFailureCount !== null && config.compareBusinessFailureCount !== undefined ? (
                    <div className={styles.qualityMeta}>对比 {config.compareVersionLabel}: {config.compareBusinessFailureCount}</div>
                  ) : null}
                </div>
                <div className={`${styles.qualityCard} ${importPreviewHref ? styles.qualityCardInteractive : ""}`}>
                  {importPreviewHref ? <Link href={importPreviewHref} className={styles.qualityCardLink} aria-label="查看模块覆盖率对应的当前批次导入预览" /> : null}
                  <div className={styles.qualityLabel}>模块覆盖率</div>
                  <div className={styles.qualityValue}>{config.moduleCoverage?.toFixed(1) ?? "0.0"}%</div>
                  {config.compareModuleCoverage !== null && config.compareModuleCoverage !== undefined ? (
                    <div className={styles.qualityMeta}>对比 {config.compareVersionLabel}: {config.compareModuleCoverage.toFixed(1)}%</div>
                  ) : null}
                </div>
              </div>

              <div className={styles.qualityHint}>
                <span className="pill">{hasInference ? "含推断统计" : "显式统计优先"}</span>
                <span>{qualityNote}</span>
              </div>

              <div className={styles.metricGrid}>
                {config.metrics.map((metric) => (
                  <div key={metric.label} className={`surface ${styles.metricCard}`}>
                    <div className={styles.metricLabel}>{metric.label}</div>
                    <div className={styles.metricValue} style={{ color: config.color }}>
                      {metric.value}
                    </div>
                    {metric.compareValue ? (
                      <div className={styles.metricCompare}>对比 {config.compareVersionLabel}: {metric.compareValue}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>

        {category === "onboarding" ? (
          <>
            <section className={styles.moduleSection} data-onboarding-checklist={onboardingChecklist}>
              <ModuleSectionHeader
                title={onboardingSections[0]}
                copy="先确认导入质量与版本上下文，再进入步骤漏斗判断，避免把口径问题误当成体验问题。"
                badge={config.compareVersionLabel ? "带版本对比" : "当前批次"}
              />
              <ModuleQualityCards
                importPreviewHref={importPreviewHref}
                qualityNote={qualityNote}
                compareVersionLabel={config.compareVersionLabel}
                technicalSuccessRate={config.technicalSuccessRate}
                technicalErrorCount={config.technicalErrorCount}
                businessFailureCount={config.businessFailureCount}
                moduleCoverage={config.moduleCoverage}
                compareTechnicalSuccessRate={config.compareTechnicalSuccessRate}
                compareTechnicalErrorCount={config.compareTechnicalErrorCount}
                compareBusinessFailureCount={config.compareBusinessFailureCount}
                compareModuleCoverage={config.compareModuleCoverage}
                notes={{
                  success: "导入质量稳定时，这一页的漏斗结论才更可信。",
                  errors: "优先排除埋点缺失、字段错位和批次导入异常。",
                  business: "如果业务失败事件同步增多，先复核是否存在流程阻断。"
                }}
              />
            </section>

            <ModuleRiskBanner moduleRisk={config.moduleRisk} importPreviewHref={importPreviewHref} />

            <section className={styles.moduleSection}>
              <ModuleSectionHeader
                title={onboardingSections[1]}
                copy="这一段只总结 onboarding 主链路结论，不和其他模块复用通用排行榜结构。"
                badge={onboardingRows.length ? `${onboardingRows.length} 个步骤` : "等待步骤数据"}
              />
              <div className={styles.moduleGrid}>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>引导完成率</div>
                  <div className={styles.moduleCardValue}>{config.metrics[1]?.value ?? "0.0%"}</div>
                  <div className={styles.moduleCardMeta}>
                    {config.metrics[1]?.compareValue
                      ? `对比 ${config.compareVersionLabel}: ${config.metrics[1].compareValue}`
                      : "对应整条 onboarding 链路的最终完成表现。"}
                  </div>
                </article>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>步骤平均完成率</div>
                  <div className={styles.moduleCardValue}>{onboardingAverageCompletion.toFixed(1)}%</div>
                  <div className={styles.moduleCardMeta}>
                    {compareOnboardingAverageCompletion !== null
                      ? `对比均值 ${(onboardingAverageCompletion - compareOnboardingAverageCompletion > 0 ? "+" : "")}${(
                          onboardingAverageCompletion - compareOnboardingAverageCompletion
                        ).toFixed(1)}%`
                      : "按步骤均值看当前链路是否整体吃力。"}
                  </div>
                </article>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>尾步完成情况</div>
                  <div className={styles.moduleCardValue}>{onboardingLastStep ? `${onboardingLastStep.completionRate.toFixed(1)}%` : "—"}</div>
                  <div className={styles.moduleCardMeta}>
                    {onboardingLastStep
                      ? `${onboardingLastStep.stepName || onboardingLastStep.stepId} · ${onboardingLastStep.completions}/${onboardingLastStep.arrivals}`
                      : "当前批次还没有足够的步骤明细。"}
                  </div>
                </article>
              </div>
              <div className={styles.moduleNarrative}>{config.compareInsight ?? config.insight}</div>
            </section>

            <section id="onboarding-signal" className={styles.moduleSection}>
              <ModuleSectionHeader
                title={onboardingSections[2]}
                copy="把最大流失步骤单独抬出来，避免它淹没在通用图表和杂项说明里。"
                badge="优先处理"
              />
              <div className={styles.moduleSignalGrid}>
                <article className={styles.moduleSignalCard}>
                  <div className={styles.moduleSignalLabel}>最大流失步骤</div>
                  <div className={styles.moduleSignalTitle}>
                    {onboardingLargestDrop ? onboardingLargestDrop.stepName || onboardingLargestDrop.stepId : "暂无明显流失步骤"}
                  </div>
                  <div className={styles.moduleSignalMeta}>
                    {onboardingLargestDrop
                      ? `${onboardingLargestDrop.arrivals} 到达 / ${onboardingLargestDrop.completions} 完成 / 流失 ${onboardingLargestDrop.dropoffCount}`
                      : "当前批次缺少足够步骤数据，暂时无法判断最大流失点。"}
                  </div>
                </article>
                <article className={styles.moduleSignalCard}>
                  <div className={styles.moduleSignalLabel}>伴随耗时信号</div>
                  <div className={styles.moduleSignalTitle}>
                    {onboardingSlowestStep ? onboardingSlowestStep.stepName || onboardingSlowestStep.stepId : "暂无耗时热点"}
                  </div>
                  <div className={styles.moduleSignalMeta}>
                    {onboardingSlowestStep
                      ? `平均耗时 ${onboardingSlowestStep.avgDuration.toFixed(1)} 秒，步骤均值 ${onboardingAverageDuration.toFixed(1)} 秒`
                      : "当前批次缺少耗时样本，暂时无法判断理解成本是否抬升。"}
                  </div>
                </article>
              </div>
              <div className={styles.infoPanel}>
                <div className={styles.infoPanelTitle}>运营建议</div>
                <div className={styles.infoPanelList}>
                  {onboardingActionItems.map((item) => (
                    <div key={item.title} className={styles.infoPanelRowStack}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    漏斗主图
                  </h2>
                  <p className={styles.sectionCopy}>主图永远使用 onboarding 专属漏斗卡；即使没有标准漏斗数组，也会用步骤趋势/步骤明细推导后继续渲染。</p>
                </div>
                <span className="pill">{onboardingSections[3]}</span>
              </div>
              <OnboardingFunnelCard
                title={onboardingSections[3]}
                copy={
                  config.compareVersionLabel
                    ? `按步骤展示到达、完成与流失，优先看掉队最多的环节；同时对比 ${config.compareVersionLabel} 的完成率变化。`
                    : chartCopy
                }
                steps={onboardingRows}
                compareSteps={compareOnboardingRows}
                color={config.color}
              />
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    趋势 + 耗时排行
                  </h2>
                  <p className={styles.sectionCopy}>完成率曲线回答“哪一步骤开始掉”，耗时排行回答“为什么玩家会在这里犹豫”。</p>
                </div>
                <span className="pill">双视角复核</span>
              </div>
              <div className={styles.moduleChartGrid}>
                <OnboardingTrendCard
                  title={onboardingSections[4]}
                  copy={
                    config.compareVersionLabel
                      ? `按步骤查看完成率曲线，实线为 ${config.versionLabel}，虚线为 ${config.compareVersionLabel}。`
                      : "按步骤查看完成率曲线，判断是某一步骤突然陡降，还是整体理解成本持续升高。"
                  }
                  steps={onboardingTrendRows}
                  compareSteps={config.compareOnboardingStepTrend}
                  color={config.color}
                />
                <OnboardingDurationRankingCard
                  title={onboardingSections[5]}
                  copy="查看耗时异常步骤，确认高耗时是否与高流失同时出现。"
                  steps={onboardingRows}
                />
              </div>
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {onboardingSections[6]}
                  </h2>
                  <p className={styles.sectionCopy}>用步骤级明细直接核对到达、完成、流失、耗时和版本差异，不再走通用结构化明细表。</p>
                </div>
                <span className="pill">
                  {config.compareVersionLabel ? `${config.versionLabel} vs ${config.compareVersionLabel}` : config.versionLabel}
                </span>
              </div>
              <div className={styles.moduleDetailTable}>
                <div className={styles.moduleDetailTableRow}>
                  <div className={styles.moduleDetailTableHead}>步骤</div>
                  <div className={styles.moduleDetailTableHead}>到达</div>
                  <div className={styles.moduleDetailTableHead}>完成</div>
                  <div className={styles.moduleDetailTableHead}>流失</div>
                  <div className={styles.moduleDetailTableHead}>完成率</div>
                  <div className={styles.moduleDetailTableHead}>平均耗时</div>
                  <div className={styles.moduleDetailTableHead}>对比完成率</div>
                </div>
                {onboardingRows.map((row) => {
                  const compare = onboardingCompareMap.get(row.stepId || row.stepName);
                  return (
                    <div key={`${row.stepId}-${row.stepName}`} className={styles.moduleDetailTableRow}>
                      <div className={styles.moduleDetailPrimary}>
                        <strong>{row.stepName || row.stepId}</strong>
                        <span>{row.stepId || "未命名步骤"}</span>
                      </div>
                      <div>{row.arrivals}</div>
                      <div>{row.completions}</div>
                      <div>{row.dropoffCount}</div>
                      <div className={styles.moduleDetailStrong}>{row.completionRate.toFixed(1)}%</div>
                      <div>{row.avgDuration.toFixed(1)} 秒</div>
                      <div>{compare ? `${compare.completionRate.toFixed(1)}%` : "—"}</div>
                    </div>
                  );
                })}
              </div>
              {!onboardingRows.length ? (
                <div className={styles.moduleEmptyState}>当前批次还没有可展示的 onboarding 步骤明细，漏斗卡会在导入步骤日志后自动补齐。</div>
              ) : null}
            </section>
          </>
        ) : null}

        {category === "level" ? (
          <>
            <section className={styles.moduleSection} data-level-checklist={levelChecklist}>
              <ModuleSectionHeader
                title={levelSections[0]}
                copy="先确认关卡页的数据质量，再判断失败、重试和行为异常，避免把导入口径问题误判为难度问题。"
                badge={config.compareVersionLabel ? "带版本对比" : "当前批次"}
              />
              <ModuleQualityCards
                importPreviewHref={importPreviewHref}
                qualityNote={qualityNote}
                compareVersionLabel={config.compareVersionLabel}
                technicalSuccessRate={config.technicalSuccessRate}
                technicalErrorCount={config.technicalErrorCount}
                businessFailureCount={config.businessFailureCount}
                moduleCoverage={config.moduleCoverage}
                compareTechnicalSuccessRate={config.compareTechnicalSuccessRate}
                compareTechnicalErrorCount={config.compareTechnicalErrorCount}
                compareBusinessFailureCount={config.compareBusinessFailureCount}
                compareModuleCoverage={config.compareModuleCoverage}
                notes={{
                  success: "导入质量稳定时，关卡页的失败和重试结论才有解释力。",
                  errors: "优先排除埋点缺失、level_id 错位或批次导入截断。",
                  business: "如果失败事件同步抬升，优先结合失败原因分布复核是体验问题还是链路问题。"
                }}
              />
            </section>

            <ModuleRiskBanner moduleRisk={config.moduleRisk} importPreviewHref={importPreviewHref} />

            <section className={styles.moduleSection}>
              <ModuleSectionHeader
                title={levelSections[1]}
                copy="关键指标只服务关卡诊断叙事，帮助团队先判断是整体难度、失败密度，还是重试黏滞在变坏。"
                badge={levelRows.length ? `${levelRows.length} 个关卡` : "等待关卡数据"}
              />
              <ModuleConclusionCards
                metrics={config.metrics}
                color={config.color}
                compareVersionLabel={config.compareVersionLabel}
                emptyLabel="用于判断当前关卡链路是整体波动还是局部卡点。"
              />
              <div className={styles.moduleNarrative}>{config.compareInsight ?? config.insight}</div>
            </section>

            <section id="level-signal" className={styles.moduleSection}>
              <ModuleSectionHeader
                title="失败 / 重试 / 行为异常信号"
                copy="这里直接使用排序后的一级诊断信号，不再把关卡热点埋在通用排行或附属图表里。"
                badge="level first signals"
              />
              <div className={styles.levelSignalGrid}>
                <article className={styles.moduleSignalCard}>
                  <div className={styles.moduleSignalLabel}>{levelSections[2]}</div>
                  <div className={styles.moduleSignalTitle}>
                    {levelWorst ? (levelWorst.levelType ? `${levelWorst.levelId} (${levelWorst.levelType})` : levelWorst.levelId) : "暂无高失败关卡"}
                  </div>
                  <div className={styles.moduleSignalMeta}>
                    {levelWorst
                      ? `失败率 ${levelWorst.failRate.toFixed(1)}%，失败 ${levelWorst.fails} 次，主要失败原因 ${levelWorst.topFailReason || "未记录"}。${nextWorstLevel ? `其次是 ${nextWorstLevel.levelType ? `${nextWorstLevel.levelId} (${nextWorstLevel.levelType})` : nextWorstLevel.levelId}。` : ""}`
                      : "当前批次还没有足够的关卡样本，暂时无法判断失败最集中关卡。"}
                  </div>
                </article>
                <article className={styles.moduleSignalCard}>
                  <div className={styles.moduleSignalLabel}>{levelSections[3]}</div>
                  <div className={styles.moduleSignalTitle}>
                    {levelRetryHot
                      ? levelRetryHot.levelType
                        ? `${levelRetryHot.levelId} (${levelRetryHot.levelType})`
                        : levelRetryHot.levelId
                      : "暂无重试热点"}
                  </div>
                  <div className={styles.moduleSignalMeta}>
                    {levelRetryHot
                      ? `重试率 ${levelRetryHot.retryRate.toFixed(1)}%，累计 ${levelRetryHot.retries} 次。${nextRetryLevel ? `次高为 ${nextRetryLevel.levelType ? `${nextRetryLevel.levelId} (${nextRetryLevel.levelType})` : nextRetryLevel.levelId}。` : ""}`
                      : "当前批次未识别到显著的重试堆积。"}
                  </div>
                </article>
                <article className={styles.moduleSignalCard}>
                  <div className={styles.moduleSignalLabel}>{levelSections[4]}</div>
                  <div className={styles.moduleSignalTitle}>
                    {microflowHot ? `${microflowHot.levelId} / ${microflowHot.action}` : "暂无异常行为占比"}
                  </div>
                  <div className={styles.moduleSignalMeta}>
                    {microflowHot
                      ? `占比 ${microflowHot.ratio.toFixed(1)}%，平均耗时 ${microflowHot.avgDuration.toFixed(1)} 秒。${nextMicroflowHot ? `次高异常为 ${nextMicroflowHot.levelId} / ${nextMicroflowHot.action}。` : ""}`
                      : "当前批次未识别到需要单独抬出的局内行为异常。"}
                  </div>
                </article>
              </div>
              <div className={styles.infoPanel}>
                <div className={styles.infoPanelTitle}>关卡运营建议</div>
                <div className={styles.infoPanelList}>
                  {levelActionItems.map((item) => (
                    <div key={item.title} className={styles.infoPanelRowStack}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {levelSections[5]}
                  </h2>
                  <p className={styles.sectionCopy}>主图只服务关卡漏斗判断，先确认哪些关卡通关率塌陷，再回看失败原因和微观心流。</p>
                </div>
                <span className="pill">{config.compareVersionLabel ? "带版本对比" : "当前批次"}</span>
              </div>
              {levelRows.length ? (
                <LevelProgressCard
                  title={levelSections[5]}
                  copy={
                    config.compareVersionLabel
                      ? `按关卡展示开始、完成、失败与重试，并对比 ${config.compareVersionLabel} 的通关率变化。`
                      : "按关卡展示开始、完成、失败与重试，优先判断问题是少数关卡集中失守，还是整条关卡链路普遍吃力。"
                  }
                  rows={levelRows}
                  compareRows={config.compareLevelFunnel}
                />
              ) : (
                <div className={styles.moduleEmptyState}>当前批次还没有可展示的关卡漏斗主图，导入 level_start / level_complete / level_fail 后会自动补齐。</div>
              )}
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    失败原因 + 重试排行
                  </h2>
                  <p className={styles.sectionCopy}>失败原因解释“为什么卡住”，重试排行解释“玩家是否被迫反复尝试”，两者一起看才知道优先级。</p>
                </div>
                <span className="pill">双侧复核</span>
              </div>
              <div className={styles.sideBySidePanels}>
                <div className={styles.infoPanel}>
                  <div className={styles.infoPanelTitle}>{levelSections[6]}</div>
                  <div className={styles.infoPanelList}>
                    {(config.levelFailReasonDistribution ?? []).slice(0, 6).map((item) => (
                      <div key={item.name} className={styles.infoPanelRow}>
                        <span>{item.name}</span>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                  {!(config.levelFailReasonDistribution ?? []).length ? (
                    <div className={styles.moduleEmptyState}>当前批次还没有可展示的失败原因分布。</div>
                  ) : null}
                </div>
                <div className={styles.infoPanel}>
                  <div className={styles.infoPanelTitle}>{levelSections[7]}</div>
                  <div className={styles.infoPanelList}>
                    {levelRetryRows.slice(0, 6).map((item) => (
                      <div key={`${item.levelId}-${item.levelType}`} className={styles.infoPanelRow}>
                        <span>{item.levelType ? `${item.levelId} (${item.levelType})` : item.levelId}</span>
                        <strong>{item.retryRate.toFixed(1)}%</strong>
                      </div>
                    ))}
                  </div>
                  {!levelRetryRows.length ? <div className={styles.moduleEmptyState}>当前批次还没有可展示的重试排行。</div> : null}
                </div>
              </div>
            </section>

            <section id="level-microflow" className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {levelSections[8]}
                  </h2>
                  <p className={styles.sectionCopy}>微观心流保留在关卡页下半区，单独解释玩家在局内到底被什么动作拖慢，而不是挤在侧栏里当附属信息。</p>
                </div>
                <span className="pill">same page, lower section</span>
              </div>
              {microflowHot ? (
                <div className={styles.levelMicroflowHighlight}>
                  <div>
                    <div className={styles.highlightLabel}>当前最高占比异常动作</div>
                    <div className={styles.highlightTitle}>{microflowHot.levelId} / {microflowHot.action}</div>
                  </div>
                  <div className={styles.levelMicroflowHighlightStats}>
                    <span>{microflowHot.count} 次</span>
                    <span>{microflowHot.ratio.toFixed(1)}%</span>
                    <span>{microflowHot.avgDuration.toFixed(1)} 秒</span>
                  </div>
                </div>
              ) : null}
              <div className={styles.levelMicroflowGrid}>
                {levelMicroflowGroups.slice(0, 6).map((group) => (
                  <article key={group.levelId} className={styles.levelMicroflowPanel}>
                    <div className={styles.levelMicroflowPanelTop}>
                      <div>
                        <div className={styles.levelMicroflowPanelTitle}>关卡 {group.levelId}</div>
                        <div className={styles.rankMeta}>按行为占比从高到低排序</div>
                      </div>
                      <span className="pill">{group.actions.length} 个动作</span>
                    </div>
                    <div className={styles.levelMicroflowList}>
                      {group.actions.slice(0, 4).map((row) => (
                        <div key={`${group.levelId}-${row.action}`} className={styles.levelMicroflowItem}>
                          <div>
                            <strong>{row.action}</strong>
                            <div className={styles.rankMeta}>局内动作</div>
                          </div>
                          <div className={styles.levelMicroflowItemStats}>
                            <span>{row.count} 次</span>
                            <span>{row.ratio.toFixed(1)}%</span>
                            <span>{row.avgDuration.toFixed(1)} 秒</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              {!levelMicroflowGroups.length ? (
                <div className={styles.moduleEmptyState}>当前批次还没有足够的微观心流样本，导入局内行为事件后这里会展示动作占比和耗时热点。</div>
              ) : null}
            </section>

            <section id="level-detail" className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    明细表
                  </h2>
                  <p className={styles.sectionCopy}>最后用关卡明细表和心流明细表收口，方便团队逐行核对热点关卡、失败率、重试率和局内动作异常。</p>
                </div>
                <span className="pill">
                  {config.compareVersionLabel ? `${config.versionLabel} vs ${config.compareVersionLabel}` : config.versionLabel}
                </span>
              </div>
              <div className={styles.levelDetailTables}>
                <div className={styles.levelDetailBlock}>
                  <div className={styles.levelDetailBlockTitle}>{levelSections[9]}</div>
                  <div className={styles.levelDetailTable}>
                    <div className={`${styles.levelDetailTableRow} ${styles.levelDetailTableHeaderRow}`}>
                      <div className={styles.levelDetailTableHead}>关卡</div>
                      <div className={styles.levelDetailTableHead}>开始</div>
                      <div className={styles.levelDetailTableHead}>完成</div>
                      <div className={styles.levelDetailTableHead}>失败率</div>
                      <div className={styles.levelDetailTableHead}>重试率</div>
                      <div className={styles.levelDetailTableHead}>主要失败原因</div>
                      <div className={styles.levelDetailTableHead}>对比通关率</div>
                    </div>
                    {levelRows.map((row) => {
                      const compare = compareLevelMap.get(row.levelId);
                      const retryRate = row.starts ? (row.retries / Math.max(row.starts, 1)) * 100 : 0;
                      return (
                        <div key={`${row.levelId}-${row.levelType}`} className={styles.levelDetailTableRow}>
                          <div className={styles.levelDetailPrimary}>
                            <strong>{row.levelType ? `${row.levelId} (${row.levelType})` : row.levelId}</strong>
                            <span>{row.completes} 完成 / {row.fails} 失败</span>
                          </div>
                          <div>{row.starts}</div>
                          <div>{row.completes}</div>
                          <div className={styles.moduleDetailStrong}>{row.failRate.toFixed(1)}%</div>
                          <div>{retryRate.toFixed(1)}%</div>
                          <div>{row.topFailReason || "—"}</div>
                          <div>{compare ? `${compare.completionRate.toFixed(1)}%` : "—"}</div>
                        </div>
                      );
                    })}
                  </div>
                  {!levelRows.length ? <div className={styles.moduleEmptyState}>当前批次还没有可展示的关卡明细。</div> : null}
                </div>
                <div className={styles.levelDetailBlock}>
                  <div className={styles.levelDetailBlockTitle}>{levelSections[10]}</div>
                  <div className={styles.levelFlowTable}>
                    <div className={`${styles.levelFlowTableRow} ${styles.levelFlowTableHeaderRow}`}>
                      <div className={styles.levelDetailTableHead}>关卡</div>
                      <div className={styles.levelDetailTableHead}>动作</div>
                      <div className={styles.levelDetailTableHead}>次数</div>
                      <div className={styles.levelDetailTableHead}>占比</div>
                      <div className={styles.levelDetailTableHead}>平均耗时</div>
                    </div>
                    {levelMicroflowRows.slice(0, 12).map((row) => (
                      <div key={`${row.levelId}-${row.action}`} className={styles.levelFlowTableRow}>
                        <div className={styles.levelDetailPrimary}>
                          <strong>{row.levelId}</strong>
                          <span>行为热点</span>
                        </div>
                        <div>{row.action}</div>
                        <div>{row.count}</div>
                        <div className={styles.moduleDetailStrong}>{row.ratio.toFixed(1)}%</div>
                        <div>{row.avgDuration.toFixed(1)} 秒</div>
                      </div>
                    ))}
                  </div>
                  {!levelMicroflowRows.length ? <div className={styles.moduleEmptyState}>当前批次还没有可展示的心流明细。</div> : null}
                </div>
              </div>
            </section>
          </>
        ) : null}

        {category === "system" || category === "custom" ? (
          <section className={`panel ${styles.chartSection}`}>
            <div className={styles.sectionTop}>
              <div>
                <h2 className="section-title" style={{ fontSize: 18 }}>
                  关键图表
                </h2>
                <p className={styles.sectionCopy}>先看主图确认当前版本结论，再用趋势和构成图验证问题是否持续、是否集中。</p>
              </div>
              <span className="pill">{config.compareVersionLabel ? "双版本分析" : "单版本分析"}</span>
            </div>
            <div className={styles.chartGrid}>
              <div className={styles.primaryChart}>
                <BarChartCard
                  title={chartTitle}
                  copy={config.compareVersionLabel ? `深色柱为 ${config.versionLabel}，浅色柱为 ${config.compareVersionLabel}。${chartCopy}` : chartCopy}
                  values={config.main}
                  color={config.color}
                  compareValues={config.compareVersionLabel ? config.compareMain : undefined}
                />
              </div>
              <div className={styles.secondaryCharts}>
                <LineChartCard
                  title={trendTitle}
                  copy={config.compareVersionLabel ? `实线为 ${config.versionLabel}，虚线为 ${config.compareVersionLabel}。` : "观察最近导入或模拟批次的变化，判断问题是偶发波动还是持续趋势。"}
                  values={config.trend}
                  color={config.color}
                  compareValues={config.compareVersionLabel ? config.compareTrend : undefined}
                />
                <DonutChartCard
                  title={auxTitle}
                  copy={auxCopy}
                  values={config.aux}
                  labels={config.auxLabels}
                  colors={[config.color, "var(--blue)", "var(--violet)", "var(--teal)", "var(--red)", "var(--gold)"].slice(
                    0,
                    config.aux.length
                  )}
                />
              </div>
            </div>
          </section>
        ) : null}

        {category === "monetization" ? (
          <>
            <section className={styles.moduleSection} data-monetization-checklist={monetizationChecklist}>
              <ModuleSectionHeader
                title={monetizationSections[0]}
                copy="先确认导入质量与版本上下文，再判断商业化损耗，不让口径问题混进转化分析。"
                badge={config.compareVersionLabel ? "带版本对比" : "当前批次"}
              />
              <ModuleQualityCards
                importPreviewHref={importPreviewHref}
                qualityNote={qualityNote}
                compareVersionLabel={config.compareVersionLabel}
                technicalSuccessRate={config.technicalSuccessRate}
                technicalErrorCount={config.technicalErrorCount}
                businessFailureCount={config.businessFailureCount}
                moduleCoverage={config.moduleCoverage}
                compareTechnicalSuccessRate={config.compareTechnicalSuccessRate}
                compareTechnicalErrorCount={config.compareTechnicalErrorCount}
                compareBusinessFailureCount={config.compareBusinessFailureCount}
                compareModuleCoverage={config.compareModuleCoverage}
                notes={{
                  success: "技术通过率稳定时，双漏斗里的损耗结论才值得直接讨论。",
                  errors: "优先排除礼包字段缺失、支付阶段漏记和批次截断。",
                  business: "如果业务失败事件同步抬升，要先确认支付链路是否存在结构性中断。"
                }}
              />
            </section>

            <ModuleRiskBanner moduleRisk={config.moduleRisk} importPreviewHref={importPreviewHref} />

            <section className={styles.moduleSection}>
              <ModuleSectionHeader
                title={monetizationSections[1]}
                copy="这里先给商业化团队一个能直接复述的版本结论，再往下展开损耗和礼包分布。"
                badge={config.metrics.length ? `${config.metrics.length} 个结论指标` : "等待商业化数据"}
              />
              <ModuleConclusionCards
                metrics={config.metrics}
                color={config.color}
                compareVersionLabel={config.compareVersionLabel}
                emptyLabel="优先用来判断入口规模、点击意愿、下单效率和支付落地是否同步波动。"
              />
              <div className={styles.moduleNarrative}>{config.compareInsight ?? config.insight}</div>
            </section>

            <section id="monetization-signal" className={styles.moduleSection}>
              <ModuleSectionHeader
                title="损耗 / 礼包信号"
                copy="把最大损耗点和最优礼包先抬到页面上方，业务团队进入页面就能直接看到最该处理的动作。"
                badge="signal first"
              />
              <div className={styles.moduleSignalGrid}>
                <article className={styles.moduleSignalCard}>
                  <div className={styles.moduleSignalLabel}>{monetizationSections[2]}</div>
                  <div className={styles.moduleSignalTitle}>
                    {storeLossStage ? `${storeLossStage.funnelLabel} · ${storeLossStage.label}` : "暂无明显损耗阶段"}
                  </div>
                  <div className={styles.moduleSignalMeta}>
                    {storeLossStage
                      ? `当前阶段流失 ${storeLossStage.drop} 次，建议优先复核${storeLossStage.funnel === "payment" ? "支付承接、确认回调和支付成功落地" : "入口文案、礼包承接和支付触发"}。`
                      : "当前批次的商业化漏斗阶段较短，暂时无法识别单独抬出的最大损耗点。"}
                  </div>
                </article>
                <article className={styles.moduleSignalCard}>
                  <div className={styles.moduleSignalLabel}>{monetizationSections[3]}</div>
                  <div className={styles.moduleSignalTitle}>{bestPack?.name ?? "暂无礼包 / 计费点数据"}</div>
                  <div className={styles.moduleSignalMeta}>
                    {bestPack
                      ? `成功率 ${bestPack.successRate.toFixed(1)}%，曝光 ${bestPack.exposures} 次，支付成功 ${bestPack.successes} 次。`
                      : "当前批次还没有足够的礼包或计费点分布，暂时无法判断最佳承接入口。"}
                  </div>
                </article>
              </div>
              <div className={styles.infoPanel}>
                <div className={styles.infoPanelTitle}>商业化建议</div>
                <div className={styles.infoPanelList}>
                  {monetizationActionItems.map((item) => (
                    <div key={item.title} className={styles.infoPanelRowStack}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {monetizationSections[4]}
                  </h2>
                  <p className={styles.sectionCopy}>先讲清楚哪些阶段是显式统计、哪些阶段带有兼容推断，避免把口径边界当成产品结论。</p>
                </div>
                <span className="pill">{hasInference ? "含推断链路" : "显式统计优先"}</span>
              </div>
              <div className={styles.moduleGrid}>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>口径边界</div>
                  <div className={styles.moduleCardValue}>{config.monetizationNote ? "含推断" : "显式"}</div>
                  <div className={styles.moduleCardMeta}>{monetizationMethodNote}</div>
                </article>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>使用建议</div>
                  <div className={styles.moduleCardValue}>{importPreviewHref ? "可复核" : "直接分析"}</div>
                  <div className={styles.moduleCardMeta}>
                    {importPreviewHref
                      ? "如果要确认礼包字段或支付阶段映射，可回到导入预览交叉核对原始字段。"
                      : "当前批次可以直接用双漏斗判断入口损耗和支付落地的主问题。"}
                  </div>
                </article>
              </div>
            </section>

            <section id="monetization-main-chart" className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {monetizationSections[5]}
                  </h2>
                  <p className={styles.sectionCopy}>主图固定使用双漏斗，先判断损耗发生在商店入口还是支付落地，再决定后续优化方向。</p>
                </div>
                <span className="pill">{config.compareVersionLabel ? "商业化专属主图" : "商业化主视图"}</span>
              </div>
              {config.monetizationStoreFunnel?.length ? (
                <MonetizationDualFunnelCard
                  title={monetizationSections[5]}
                  copy={
                    config.compareVersionLabel
                      ? `双漏斗主图展示 ${config.versionLabel} 当前批次的入口链路和支付链路；版本差异结论保留在上方关键结论卡中统一阅读。`
                      : "双漏斗主图同时展示商店 / 礼包曝光链路与支付请求链路，优先判断最大损耗发生在哪一层。"
                  }
                  storeFunnel={config.monetizationStoreFunnel}
                  paymentFunnel={config.monetizationPaymentFunnel ?? []}
                />
              ) : (
                <div className={styles.moduleEmptyState}>当前批次还没有可展示的商业化双漏斗，导入曝光、点击、下单和支付成功事件后会自动补齐。</div>
              )}
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {monetizationSections[6]}
                  </h2>
                  <p className={styles.sectionCopy}>分布图回答“主要量级落在哪些礼包”，右侧列表回答“谁既有量又有转化”。</p>
                </div>
                <span className="pill">{monetizationDistributionRows.length ? `${monetizationDistributionRows.length} 个礼包 / 计费点` : "等待礼包分布"}</span>
              </div>
              <div className={styles.moduleChartGrid}>
                {monetizationDistributionValues.length ? (
                  <DonutChartCard
                    title={monetizationSections[6]}
                    copy="按曝光量查看主要礼包 / 计费点构成，帮助团队判断营收承接是否过度集中。"
                    values={monetizationDistributionValues}
                    labels={monetizationDistributionLabels}
                    colors={["var(--gold)", "var(--teal)", "var(--blue)", "var(--violet)", "var(--red)", "var(--amber)"].slice(
                      0,
                      monetizationDistributionValues.length
                    )}
                    valueFormat="count"
                  />
                ) : (
                  <div className={styles.moduleEmptyState}>当前批次还没有可展示的礼包 / 计费点分布。</div>
                )}
                <div className={styles.infoPanel}>
                  <div className={styles.infoPanelTitle}>高价值礼包排行</div>
                  <div className={styles.infoPanelList}>
                    {monetizationDistributionRows.slice(0, 6).map((item) => (
                      <div key={item.name} className={styles.infoPanelRow}>
                        <span>{item.name}</span>
                        <strong>{`${item.successRate.toFixed(1)}% / ${item.successes} 成功`}</strong>
                      </div>
                    ))}
                  </div>
                  {!monetizationDistributionRows.length ? (
                    <div className={styles.moduleEmptyState}>当前批次还没有可展示的礼包排行。</div>
                  ) : null}
                </div>
              </div>
            </section>

            <section id="monetization-detail" className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {monetizationSections[7]}
                  </h2>
                  <p className={styles.sectionCopy}>把礼包和计费点的曝光、点击、下单、成功拉平到一张表里，方便直接落到运营动作。</p>
                </div>
                <span className="pill">
                  {config.compareVersionLabel ? `${config.versionLabel} vs ${config.compareVersionLabel}` : config.versionLabel}
                </span>
              </div>
              <div className={styles.moduleDetailTable}>
                <div className={styles.moduleDetailTableRow}>
                  <div className={styles.moduleDetailTableHead}>计费点 / 礼包</div>
                  <div className={styles.moduleDetailTableHead}>曝光</div>
                  <div className={styles.moduleDetailTableHead}>点击</div>
                  <div className={styles.moduleDetailTableHead}>下单</div>
                  <div className={styles.moduleDetailTableHead}>成功</div>
                  <div className={styles.moduleDetailTableHead}>成功率</div>
                  <div className={styles.moduleDetailTableHead}>口径</div>
                </div>
                {monetizationDistributionRows.map((item) => (
                  <div key={item.name} className={styles.moduleDetailTableRow}>
                    <div className={styles.moduleDetailPrimary}>
                      <strong>{item.name}</strong>
                      <span>{item.inferred ? "部分阶段为兼容推断" : "显式链路"}</span>
                    </div>
                    <div>{item.exposures}</div>
                    <div>{item.clicks}</div>
                    <div>{item.orders}</div>
                    <div>{item.successes}</div>
                    <div className={styles.moduleDetailStrong}>{item.successRate.toFixed(1)}%</div>
                    <div>{item.inferred ? "推断" : "显式"}</div>
                  </div>
                ))}
              </div>
              {!monetizationDistributionRows.length ? (
                <div className={styles.moduleEmptyState}>当前批次还没有可展示的商业化明细表。</div>
              ) : null}
            </section>
          </>
        ) : null}

        {category === "ads" ? (
          <>
            <section className={styles.moduleSection} data-ads-checklist={adsChecklist}>
              <ModuleSectionHeader
                title={adsSections[0]}
                copy="先确认广告链路的导入质量，再判断 placement 强弱，避免把 request/play 歧义误判成真实流量损耗。"
                badge={config.compareVersionLabel ? "带版本对比" : "当前批次"}
              />
              <ModuleQualityCards
                importPreviewHref={importPreviewHref}
                qualityNote={qualityNote}
                compareVersionLabel={config.compareVersionLabel}
                technicalSuccessRate={config.technicalSuccessRate}
                technicalErrorCount={config.technicalErrorCount}
                businessFailureCount={config.businessFailureCount}
                moduleCoverage={config.moduleCoverage}
                compareTechnicalSuccessRate={config.compareTechnicalSuccessRate}
                compareTechnicalErrorCount={config.compareTechnicalErrorCount}
                compareBusinessFailureCount={config.compareBusinessFailureCount}
                compareModuleCoverage={config.compareModuleCoverage}
                notes={{
                  success: "广告位判断之前先确认导入链路没有明显缺口。",
                  errors: "优先排除 placement 缺失、request 事件漏记和字段混写。",
                  business: "如果业务失败事件同步增多，要同时检查广告回调和发奖链路。"
                }}
              />
            </section>

            <ModuleRiskBanner moduleRisk={config.moduleRisk} importPreviewHref={importPreviewHref} />

            <section className={styles.moduleSection}>
              <ModuleSectionHeader
                title={adsSections[1]}
                copy="关键指标只服务广告位经营判断，帮助团队先回答“哪里最弱、哪里最占量、发奖是否稳定”。"
                badge={config.metrics.length ? `${config.metrics.length} 个结论指标` : "等待广告位数据"}
              />
              <ModuleConclusionCards
                metrics={config.metrics}
                color={config.color}
                compareVersionLabel={config.compareVersionLabel}
                emptyLabel="优先用来判断广告位规模、播放承接、点击意愿和发奖完成是否同步变化。"
              />
              <div className={styles.moduleNarrative}>{config.compareInsight ?? config.insight}</div>
            </section>

            <section id="ads-signal" className={styles.moduleSection}>
              <ModuleSectionHeader
                title="广告位强弱信号"
                copy="把最弱广告位和最大流量广告位顶到主图之前，页面一打开就先看到优先级。"
                badge="signal first"
              />
              <div className={styles.moduleSignalGrid}>
                <article className={styles.moduleSignalCard}>
                  <div className={styles.moduleSignalLabel}>{adsSections[2]}</div>
                  <div className={styles.moduleSignalTitle}>{weakestPlacement?.placement ?? "暂无最弱广告位"}</div>
                  <div className={styles.moduleSignalMeta}>
                    {weakestPlacement
                      ? `点击率 ${weakestPlacement.clickRate.toFixed(1)}%，发奖率 ${weakestPlacement.rewardRate.toFixed(1)}%，优先检查承接场景和素材质量。`
                      : "当前批次还没有足够的广告位样本，暂时无法识别最弱 placement。"}
                  </div>
                </article>
                <article className={styles.moduleSignalCard}>
                  <div className={styles.moduleSignalLabel}>{adsSections[3]}</div>
                  <div className={styles.moduleSignalTitle}>{highestVolumePlacement?.placement ?? "暂无主流量广告位"}</div>
                  <div className={styles.moduleSignalMeta}>
                    {highestVolumePlacement
                      ? `请求 ${highestVolumePlacement.requests} 次，播放 ${highestVolumePlacement.plays} 次，建议优先确认它是否拖累整体体验。`
                      : "当前批次还没有足够的广告位样本，暂时无法识别主流量 placement。"}
                  </div>
                </article>
              </div>
              <div className={styles.infoPanel}>
                <div className={styles.infoPanelTitle}>广告建议</div>
                <div className={styles.infoPanelList}>
                  {adsActionItems.map((item) => (
                    <div key={item.title} className={styles.infoPanelRowStack}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {adsSections[4]}
                  </h2>
                  <p className={styles.sectionCopy}>广告页必须把 request/play 的解释边界讲清楚，特别是导入里没有显式 request 事件的时候。</p>
                </div>
                <span className="pill">{config.adsNote ? "含 request/play 推断" : "显式 request/play"}</span>
              </div>
              <div className={styles.moduleGrid}>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>口径边界</div>
                  <div className={styles.moduleCardValue}>{config.adsNote ? "存在歧义" : "口径清晰"}</div>
                  <div className={styles.moduleCardMeta}>{adsMethodNote}</div>
                </article>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>使用建议</div>
                  <div className={styles.moduleCardValue}>{config.adsNote ? "先排查埋点" : "可直接归因"}</div>
                  <div className={styles.moduleCardMeta}>{adsMethodGuidance}</div>
                </article>
              </div>
            </section>

            <section id="ads-main-chart" className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {adsSections[5]}
                  </h2>
                  <p className={styles.sectionCopy}>主图固定使用广告位流转卡，先看 placement 间的 request、play、click、reward 差异，再决定优化顺序。</p>
                </div>
                <span className="pill">{config.compareVersionLabel ? "广告运营主视图" : "广告位主视图"}</span>
              </div>
              {config.adPlacementBreakdown?.length ? (
                <AdPlacementFlowCard
                  title={adsSections[5]}
                  copy={
                    config.compareVersionLabel
                      ? `广告位流转主图聚焦 ${config.versionLabel} 当前批次；版本差异结论保留在上方关键结论卡中统一阅读。`
                      : "按广告位展示 request、play、click 与 reward，优先识别最弱广告位和播放承接异常的 placement。"
                  }
                  placements={config.adPlacementBreakdown}
                  note={config.adsNote}
                />
              ) : (
                <div className={styles.moduleEmptyState}>当前批次还没有可展示的广告位流转主图，导入 request / play / click / reward 事件后会自动补齐。</div>
              )}
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {adsSections[6]}
                  </h2>
                  <p className={styles.sectionCopy}>排行先按流量规模排序，再补充点击率和发奖率，方便商业化和运营一起排优先级。</p>
                </div>
                <span className="pill">{adsRankingRows.length ? `${adsRankingRows.length} 个广告位` : "等待广告位排行"}</span>
              </div>
              <div className={styles.infoPanel}>
                <div className={styles.infoPanelTitle}>{adsSections[6]}</div>
                <div className={styles.infoPanelList}>
                  {adsRankingRows.slice(0, 8).map((item) => (
                    <div key={item.placement} className={styles.infoPanelRow}>
                      <span>{item.placement}</span>
                      <strong>{`${item.requests} 请求 / ${item.clickRate.toFixed(1)}% CTR`}</strong>
                    </div>
                  ))}
                </div>
                {!adsRankingRows.length ? <div className={styles.moduleEmptyState}>当前批次还没有可展示的广告位排行。</div> : null}
              </div>
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {adsSections[7]}
                  </h2>
                  <p className={styles.sectionCopy}>构成图帮助团队识别主要流量是否过度集中在少数 placement，上线节奏是否需要重新均衡。</p>
                </div>
                <span className="pill">placement mix</span>
              </div>
              {adsCompositionValues.length ? (
                <DonutChartCard
                  title={adsSections[7]}
                  copy="按请求量查看广告位构成，判断流量是否过度集中在少数 placement。"
                  values={adsCompositionValues}
                  labels={adsCompositionLabels}
                  colors={["var(--violet)", "var(--teal)", "var(--blue)", "var(--gold)", "var(--red)", "var(--amber)"].slice(
                    0,
                    adsCompositionValues.length
                  )}
                  valueFormat="count"
                />
              ) : (
                <div className={styles.moduleEmptyState}>当前批次还没有可展示的广告位构成。</div>
              )}
            </section>

            <section id="ads-detail" className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {adsSections[8]}
                  </h2>
                  <p className={styles.sectionCopy}>广告明细表保留 request / play / click / reward 全量列，方便直接核对 placement 级问题和埋点口径。</p>
                </div>
                <span className="pill">
                  {config.compareVersionLabel ? `${config.versionLabel} vs ${config.compareVersionLabel}` : config.versionLabel}
                </span>
              </div>
              <div className={styles.moduleDetailTable}>
                <div className={styles.moduleDetailTableRow}>
                  <div className={styles.moduleDetailTableHead}>广告位</div>
                  <div className={styles.moduleDetailTableHead}>请求</div>
                  <div className={styles.moduleDetailTableHead}>播放</div>
                  <div className={styles.moduleDetailTableHead}>点击</div>
                  <div className={styles.moduleDetailTableHead}>发奖</div>
                  <div className={styles.moduleDetailTableHead}>点击率 / 发奖率</div>
                  <div className={styles.moduleDetailTableHead}>口径</div>
                </div>
                {adsRankingRows.map((item) => (
                  <div key={item.placement} className={styles.moduleDetailTableRow}>
                    <div className={styles.moduleDetailPrimary}>
                      <strong>{item.placement}</strong>
                      <span>{item.inferred ? "request 由播放兼容推断" : "显式 request / play"}</span>
                    </div>
                    <div>{item.requests}</div>
                    <div>{item.plays}</div>
                    <div>{item.clicks}</div>
                    <div>{item.rewards}</div>
                    <div className={styles.moduleDetailStrong}>{`${item.clickRate.toFixed(1)}% / ${item.rewardRate.toFixed(1)}%`}</div>
                    <div>{item.inferred ? "推断" : "显式"}</div>
                  </div>
                ))}
              </div>
              {!adsRankingRows.length ? <div className={styles.moduleEmptyState}>当前批次还没有可展示的广告明细表。</div> : null}
            </section>
          </>
        ) : null}

        {category === "system" || category === "custom" ? (
          <AnalyticsDetailClient
            ranking={config.ranking}
            detailRows={config.detailRows}
            versionLabel={config.versionLabel}
            compareVersionLabel={config.compareVersionLabel}
            insight={config.insight}
            compareInsight={config.compareInsight}
            color={config.color}
            initialFilter={detailFilter ?? "all"}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
