import Link from "next/link";
import { notFound } from "next/navigation";

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
import { getAnalyticsCategoryData, getLevelDiagnostics } from "@/lib/server/analytics";
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
  const storeLossStage =
    config.monetizationStoreFunnel && config.monetizationStoreFunnel.length > 1
      ? config.monetizationStoreFunnel
          .slice(1)
          .map((stage, index) => {
            const prev = config.monetizationStoreFunnel?.[index];
            const drop = Math.max((prev?.count ?? 0) - stage.count, 0);
            return {
              label: `${prev?.label ?? "上一阶段"} -> ${stage.label}`,
              drop
            };
          })
          .sort((a, b) => b.drop - a.drop)[0] ?? null
      : null;
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
  const importPreviewHref =
    activeProjectId && config.currentImportId
      ? `/imports?${new URLSearchParams({
          projectId: activeProjectId,
          importId: config.currentImportId
        }).toString()}`
      : null;
  const onboardingChecklist = onboardingSections.join(" / ");
  const levelChecklist = levelSections.join(" / ");
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

          {category !== "level" ? (
            <>
              <div className={styles.qualityGrid}>
                <div className={`${styles.qualityCard} ${importPreviewHref ? styles.qualityCardInteractive : ""}`}>
                  {importPreviewHref ? <Link href={importPreviewHref} className={styles.qualityCardLink} aria-label="查看当前批次导入预览" /> : null}
                  <div className={styles.qualityLabel}>技术通过率</div>
                  <div className={styles.qualityValue}>{config.technicalSuccessRate?.toFixed(1) ?? "0.0"}%</div>
                  {config.compareTechnicalSuccessRate !== null && config.compareTechnicalSuccessRate !== undefined ? (
                    <div className={styles.qualityMeta}>对比 {config.compareVersionLabel}: {config.compareTechnicalSuccessRate.toFixed(1)}%</div>
                  ) : null}
                </div>
                <div className={`${styles.qualityCard} ${importPreviewHref ? styles.qualityCardInteractive : ""}`}>
                  {importPreviewHref ? <Link href={importPreviewHref} className={styles.qualityCardLink} aria-label="查看当前批次导入预览" /> : null}
                  <div className={styles.qualityLabel}>技术异常</div>
                  <div className={styles.qualityValue}>{config.technicalErrorCount ?? 0}</div>
                  {config.compareTechnicalErrorCount !== null && config.compareTechnicalErrorCount !== undefined ? (
                    <div className={styles.qualityMeta}>对比 {config.compareVersionLabel}: {config.compareTechnicalErrorCount}</div>
                  ) : null}
                </div>
                <div className={`${styles.qualityCard} ${importPreviewHref ? styles.qualityCardInteractive : ""}`}>
                  {importPreviewHref ? <Link href={importPreviewHref} className={styles.qualityCardLink} aria-label="查看当前批次导入预览" /> : null}
                  <div className={styles.qualityLabel}>业务失败事件</div>
                  <div className={styles.qualityValue}>{config.businessFailureCount ?? 0}</div>
                  {config.compareBusinessFailureCount !== null && config.compareBusinessFailureCount !== undefined ? (
                    <div className={styles.qualityMeta}>对比 {config.compareVersionLabel}: {config.compareBusinessFailureCount}</div>
                  ) : null}
                </div>
                <div className={`${styles.qualityCard} ${importPreviewHref ? styles.qualityCardInteractive : ""}`}>
                  {importPreviewHref ? <Link href={importPreviewHref} className={styles.qualityCardLink} aria-label="查看当前批次导入预览" /> : null}
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
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {onboardingSections[0]}
                  </h2>
                  <p className={styles.sectionCopy}>先确认导入质量与版本上下文，再进入步骤漏斗判断，避免把口径问题误当成体验问题。</p>
                </div>
                <span className="pill">{config.compareVersionLabel ? "带版本对比" : "当前批次"}</span>
              </div>
              <div className={styles.moduleGrid}>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>技术通过率</div>
                  <div className={styles.moduleCardValue}>{config.technicalSuccessRate?.toFixed(1) ?? "0.0"}%</div>
                  <div className={styles.moduleCardMeta}>
                    {config.compareTechnicalSuccessRate !== null && config.compareTechnicalSuccessRate !== undefined
                      ? `对比 ${config.compareVersionLabel}: ${config.compareTechnicalSuccessRate.toFixed(1)}%`
                      : "导入质量稳定时，这一页的漏斗结论才更可信。"}
                  </div>
                </article>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>技术异常</div>
                  <div className={styles.moduleCardValue}>{config.technicalErrorCount ?? 0}</div>
                  <div className={styles.moduleCardMeta}>
                    {config.compareTechnicalErrorCount !== null && config.compareTechnicalErrorCount !== undefined
                      ? `对比 ${config.compareVersionLabel}: ${config.compareTechnicalErrorCount}`
                      : "优先排除埋点缺失、字段错位和批次导入异常。"}
                  </div>
                </article>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>业务失败事件</div>
                  <div className={styles.moduleCardValue}>{config.businessFailureCount ?? 0}</div>
                  <div className={styles.moduleCardMeta}>
                    {config.compareBusinessFailureCount !== null && config.compareBusinessFailureCount !== undefined
                      ? `对比 ${config.compareVersionLabel}: ${config.compareBusinessFailureCount}`
                      : "如果业务失败事件同步增多，先复核是否存在流程阻断。"}
                  </div>
                </article>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>模块覆盖率</div>
                  <div className={styles.moduleCardValue}>{config.moduleCoverage?.toFixed(1) ?? "0.0"}%</div>
                  <div className={styles.moduleCardMeta}>{qualityNote}</div>
                </article>
              </div>
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {onboardingSections[1]}
                  </h2>
                  <p className={styles.sectionCopy}>这一段只总结 onboarding 主链路结论，不和其他模块复用通用排行榜结构。</p>
                </div>
                <span className="pill">{onboardingRows.length ? `${onboardingRows.length} 个步骤` : "等待步骤数据"}</span>
              </div>
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
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {onboardingSections[2]}
                  </h2>
                  <p className={styles.sectionCopy}>把最大流失步骤单独抬出来，避免它淹没在通用图表和杂项说明里。</p>
                </div>
                <span className="pill">优先处理</span>
              </div>
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
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {levelSections[0]}
                  </h2>
                  <p className={styles.sectionCopy}>先确认关卡页的数据质量，再判断失败、重试和行为异常，避免把导入口径问题误判为难度问题。</p>
                </div>
                <span className="pill">{config.compareVersionLabel ? "带版本对比" : "当前批次"}</span>
              </div>
              <div className={styles.moduleGrid}>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>技术通过率</div>
                  <div className={styles.moduleCardValue}>{config.technicalSuccessRate?.toFixed(1) ?? "0.0"}%</div>
                  <div className={styles.moduleCardMeta}>
                    {config.compareTechnicalSuccessRate !== null && config.compareTechnicalSuccessRate !== undefined
                      ? `对比 ${config.compareVersionLabel}: ${config.compareTechnicalSuccessRate.toFixed(1)}%`
                      : "导入质量稳定时，关卡页的失败和重试结论才有解释力。"}
                  </div>
                </article>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>技术异常</div>
                  <div className={styles.moduleCardValue}>{config.technicalErrorCount ?? 0}</div>
                  <div className={styles.moduleCardMeta}>
                    {config.compareTechnicalErrorCount !== null && config.compareTechnicalErrorCount !== undefined
                      ? `对比 ${config.compareVersionLabel}: ${config.compareTechnicalErrorCount}`
                      : "优先排除埋点缺失、level_id 错位或批次导入截断。"}
                  </div>
                </article>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>业务失败事件</div>
                  <div className={styles.moduleCardValue}>{config.businessFailureCount ?? 0}</div>
                  <div className={styles.moduleCardMeta}>
                    {config.compareBusinessFailureCount !== null && config.compareBusinessFailureCount !== undefined
                      ? `对比 ${config.compareVersionLabel}: ${config.compareBusinessFailureCount}`
                      : "如果失败事件同步抬升，优先结合失败原因分布复核是体验问题还是链路问题。"}
                  </div>
                </article>
                <article className={styles.moduleCard}>
                  <div className={styles.moduleCardLabel}>模块覆盖率</div>
                  <div className={styles.moduleCardValue}>{config.moduleCoverage?.toFixed(1) ?? "0.0"}%</div>
                  <div className={styles.moduleCardMeta}>{qualityNote}</div>
                </article>
              </div>
            </section>

            <section className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {levelSections[1]}
                  </h2>
                  <p className={styles.sectionCopy}>关键指标只服务关卡诊断叙事，帮助团队先判断是整体难度、失败密度，还是重试黏滞在变坏。</p>
                </div>
                <span className="pill">{levelRows.length ? `${levelRows.length} 个关卡` : "等待关卡数据"}</span>
              </div>
              <div className={styles.moduleGrid}>
                {config.metrics.map((metric) => (
                  <article key={metric.label} className={styles.moduleCard}>
                    <div className={styles.moduleCardLabel}>{metric.label}</div>
                    <div className={styles.moduleCardValue} style={{ color: config.color }}>
                      {metric.value}
                    </div>
                    <div className={styles.moduleCardMeta}>
                      {metric.compareValue
                        ? `对比 ${config.compareVersionLabel}: ${metric.compareValue}`
                        : "用于判断当前关卡链路是整体波动还是局部卡点。"}
                    </div>
                  </article>
                ))}
              </div>
              <div className={styles.moduleNarrative}>{config.compareInsight ?? config.insight}</div>
            </section>

            <section id="level-signal" className={styles.moduleSection}>
              <div className={styles.moduleHeader}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    失败 / 重试 / 行为异常信号
                  </h2>
                  <p className={styles.sectionCopy}>这里直接使用排序后的一级诊断信号，不再把关卡热点埋在通用排行或附属图表里。</p>
                </div>
                <span className="pill">level first signals</span>
              </div>
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

        {category !== "onboarding" && category !== "level" ? (
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
                {category === "monetization" && config.monetizationStoreFunnel?.length ? (
                  <MonetizationDualFunnelCard
                    title={chartTitle}
                    copy="双漏斗同时展示商店/礼包曝光链路和支付请求链路，优先判断转化损耗发生在哪一层。"
                    storeFunnel={config.monetizationStoreFunnel}
                    paymentFunnel={config.monetizationPaymentFunnel ?? []}
                  />
                ) : category === "ads" && config.adPlacementBreakdown?.length ? (
                  <AdPlacementFlowCard
                    title={chartTitle}
                    copy="按广告位展示请求、播放、点击与发奖，优先识别表现最弱的 placement。"
                    placements={config.adPlacementBreakdown}
                  />
                ) : (
                  <BarChartCard
                    title={chartTitle}
                    copy={config.compareVersionLabel ? `深色柱为 ${config.versionLabel}，浅色柱为 ${config.compareVersionLabel}。${chartCopy}` : chartCopy}
                    values={config.main}
                    color={config.color}
                    compareValues={config.compareMain}
                  />
                )}
              </div>
              <div className={styles.secondaryCharts}>
                <LineChartCard
                  title={trendTitle}
                  copy={config.compareVersionLabel ? `实线为 ${config.versionLabel}，虚线为 ${config.compareVersionLabel}。` : "观察最近导入或模拟批次的变化，判断问题是偶发波动还是持续趋势。"}
                  values={config.trend}
                  color={config.color}
                  compareValues={config.compareTrend}
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

        {category === "monetization" && config.monetizationStoreFunnel?.length ? (
          <section className={`panel ${styles.deepDiveSection}`}>
            <div className={styles.sectionTop}>
              <div>
                <h2 className="section-title" style={{ fontSize: 18 }}>
                  商业化双漏斗
                </h2>
                <p className={styles.sectionCopy}>同时看商店/礼包曝光到支付成功，以及支付请求到支付成功的两条链路。</p>
              </div>
              {config.monetizationNote ? <span className="pill">{config.monetizationNote}</span> : null}
            </div>
            <div className={styles.signalGrid}>
              <div className={styles.signalCard}>
                <div className={styles.signalLabel}>最大转化损耗点</div>
                <div className={styles.signalTitle}>{storeLossStage?.label ?? "暂无明显损耗"}</div>
                <div className={styles.signalMeta}>
                  {storeLossStage ? `流失 ${storeLossStage.drop} 次` : "当前漏斗阶段较短，暂无法识别损耗点"}
                </div>
              </div>
              <div className={styles.signalCard}>
                <div className={styles.signalLabel}>最佳礼包 / 计费点</div>
                <div className={styles.signalTitle}>{bestPack?.name ?? "暂无礼包数据"}</div>
                <div className={styles.signalMeta}>
                  {bestPack
                    ? `成功率 ${bestPack.successRate.toFixed(1)}%，成功 ${bestPack.successes} 次`
                    : "当前批次未识别到可用礼包分布"}
                </div>
              </div>
              <div className={styles.signalCard}>
                <div className={styles.signalLabel}>统计口径提示</div>
                <div className={styles.signalTitle}>以可识别链路统计</div>
                <div className={styles.signalMeta}>
                  {config.monetizationNote ?? "若缺少支付阶段字段，页面会按当前能识别的曝光、点击、下单、成功链路统计。"}
                </div>
              </div>
            </div>
            <div className={styles.funnelCompareGrid}>
              <div className={styles.funnelCard}>
                <div className={styles.funnelTitle}>商店 / 礼包漏斗</div>
                <div className={styles.funnelStageList}>
                  {config.monetizationStoreFunnel.map((stage) => (
                    <div key={stage.label} className={styles.funnelStage}>
                      <strong>{stage.label}</strong>
                      <span>{stage.count}</span>
                      <span>{(stage.rate ?? 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.funnelCard}>
                <div className={styles.funnelTitle}>支付请求漏斗</div>
                <div className={styles.funnelStageList}>
                  {(config.monetizationPaymentFunnel ?? []).map((stage) => (
                    <div key={stage.label} className={styles.funnelStage}>
                      <strong>{stage.label}</strong>
                      <span>{stage.count}</span>
                      <span>{(stage.rate ?? 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.distributionTable}>
              <div className={styles.levelTableHeader}>
                <span>计费点 / 礼包</span>
                <span>曝光</span>
                <span>点击</span>
                <span>下单</span>
                <span>成功</span>
                <span>成功率</span>
              </div>
              {(config.giftPackDistribution ?? []).map((item) => (
                <div key={item.name} className={styles.levelTableRow}>
                  <span>{item.name}</span>
                  <span>{item.exposures}</span>
                  <span>{item.clicks}</span>
                  <span>{item.orders}</span>
                  <span>{item.successes}</span>
                  <span>{item.successRate.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {category === "ads" && config.adPlacementBreakdown?.length ? (
          <section className={`panel ${styles.deepDiveSection}`}>
            <div className={styles.sectionTop}>
              <div>
                <h2 className="section-title" style={{ fontSize: 18 }}>
                  广告位请求 / 播放 / 点击
                </h2>
                <p className={styles.sectionCopy}>按广告位比较 request、play、click 和 reward，优先识别表现最弱的 placement。</p>
              </div>
              {config.adsNote ? <span className="pill">{config.adsNote}</span> : null}
            </div>
            <div className={styles.signalGrid}>
              <div className={styles.signalCard}>
                <div className={styles.signalLabel}>最弱广告位</div>
                <div className={styles.signalTitle}>{weakestPlacement?.placement ?? "暂无广告位数据"}</div>
                <div className={styles.signalMeta}>
                  {weakestPlacement
                    ? `点击率 ${weakestPlacement.clickRate.toFixed(1)}%，发奖率 ${weakestPlacement.rewardRate.toFixed(1)}%`
                    : "当前批次未识别到可用广告位链路"}
                </div>
              </div>
              <div className={styles.signalCard}>
                <div className={styles.signalLabel}>流量最大广告位</div>
                <div className={styles.signalTitle}>{highestVolumePlacement?.placement ?? "暂无主流量广告位"}</div>
                <div className={styles.signalMeta}>
                  {highestVolumePlacement
                    ? `请求 ${highestVolumePlacement.requests} 次，播放 ${highestVolumePlacement.plays} 次`
                    : "当前批次未识别到主流量 placement"}
                </div>
              </div>
              <div className={styles.signalCard}>
                <div className={styles.signalLabel}>统计口径提示</div>
                <div className={styles.signalTitle}>请求 / 播放存在推断</div>
                <div className={styles.signalMeta}>
                  {config.adsNote ?? "若日志没有严格区分 request 与 play，本页会按现有曝光与播放字段进行兼容推断。"}
                </div>
              </div>
            </div>
            <div className={styles.distributionTable}>
              <div className={styles.levelTableHeader}>
                <span>广告位</span>
                <span>请求</span>
                <span>播放</span>
                <span>点击</span>
                <span>发奖</span>
                <span>点击率 / 发奖率</span>
              </div>
              {config.adPlacementBreakdown.map((item) => (
                <div key={item.placement} className={styles.levelTableRow}>
                  <span>{item.placement}</span>
                  <span>{item.requests}</span>
                  <span>{item.plays}</span>
                  <span>{item.clicks}</span>
                  <span>{item.rewards}</span>
                  <span>{item.clickRate.toFixed(1)}% / {item.rewardRate.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {category !== "onboarding" && category !== "level" ? (
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
