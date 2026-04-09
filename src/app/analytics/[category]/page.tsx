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
import { getAnalyticsCategoryData } from "@/lib/server/analytics";
import { getProjectsForUser } from "@/lib/server/projects";

const validCategories = new Set(["system", "onboarding", "level", "monetization", "ads", "custom"]);

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

  return (
    <AppShell currentPath="/analytics">
      <PageHeader
        title={config.title}
        copy="围绕当前分类展示版本对比、关键指标、核心结构图和 AI 判断，帮助团队快速确认问题位置与影响范围。"
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
        </section>

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
              {category === "onboarding" && config.onboardingFunnel?.length ? (
                <OnboardingFunnelCard
                  title={chartTitle}
                  copy={
                    config.compareVersionLabel
                      ? `按步骤展示到达、完成与流失，优先看掉队最多的环节；同时对比 ${config.compareVersionLabel} 的完成率变化。`
                      : chartCopy
                  }
                  steps={config.onboardingFunnel}
                  compareSteps={config.compareOnboardingFunnel}
                  color={config.color}
                />
              ) : category === "level" && config.levelFunnel?.length ? (
                <LevelProgressCard
                  title={chartTitle}
                  copy={
                    config.compareVersionLabel
                      ? `按关卡展示开始、完成、失败与重试，并对比 ${config.compareVersionLabel} 的通关率变化。`
                      : chartCopy
                  }
                  rows={config.levelFunnel}
                  compareRows={config.compareLevelFunnel}
                />
              ) : category === "monetization" && config.monetizationStoreFunnel?.length ? (
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
              {category === "onboarding" && config.onboardingStepTrend?.length ? (
                <>
                  <OnboardingTrendCard
                    title={trendTitle}
                    copy={
                      config.compareVersionLabel
                        ? `按步骤查看完成率曲线，实线为 ${config.versionLabel}，虚线为 ${config.compareVersionLabel}。`
                        : "按步骤查看完成率曲线，判断是某一步骤突然陡降，还是整体理解成本持续升高。"
                    }
                    steps={config.onboardingStepTrend}
                    compareSteps={config.compareOnboardingStepTrend}
                    color={config.color}
                  />
                  <OnboardingDurationRankingCard title={auxTitle} copy={auxCopy} steps={config.onboardingFunnel ?? config.onboardingStepTrend} />
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </section>

        {category === "onboarding" && config.onboardingFunnel?.length ? (
          <section className={`panel ${styles.deepDiveSection}`}>
            <div className={styles.sectionTop}>
              <div>
                <h2 className="section-title" style={{ fontSize: 18 }}>
                  分步骤漏斗
                </h2>
                <p className={styles.sectionCopy}>基于真实日志中的 step_id / step_name 统计每一步的到达、完成与平均耗时。</p>
              </div>
              <span className="pill">{config.onboardingFunnel.length} 个步骤</span>
            </div>
            <div className={styles.highlightStrip}>
              <div>
                <div className={styles.highlightLabel}>最大流失步骤</div>
                <div className={styles.highlightTitle}>
                  {config.onboardingFunnel
                    .slice()
                    .sort((a, b) => b.dropoffCount - a.dropoffCount)[0]?.stepName ?? "暂无明显流失"}
                </div>
              </div>
              <div className={styles.highlightMeta}>
                流失{" "}
                {config.onboardingFunnel
                  .slice()
                  .sort((a, b) => b.dropoffCount - a.dropoffCount)[0]?.dropoffCount ?? 0}{" "}
                人
              </div>
            </div>
            <div className={styles.deepDiveGrid}>
              {config.onboardingFunnel.map((row) => (
                <div key={`${row.stepId}-${row.stepName}`} className={styles.deepDiveCard}>
                  <div className={styles.deepDiveTitle}>{row.stepName || row.stepId}</div>
                  <div className={styles.deepDiveMeta}>步骤 {row.stepId || "未命名"}</div>
                  <div className={styles.deepDiveValue}>{row.completionRate.toFixed(1)}%</div>
                  <div className={styles.deepDiveStats}>
                    <span>{row.arrivals} 到达</span>
                    <span>{row.completions} 完成</span>
                    <span>流失 {row.dropoffCount}</span>
                    <span>{row.avgDuration.toFixed(1)} 秒</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {category === "level" && config.levelFunnel?.length ? (
          <section className={`panel ${styles.deepDiveSection}`}>
            <div className={styles.sectionTop}>
              <div>
                <h2 className="section-title" style={{ fontSize: 18 }}>
                  关卡进度与局内微观心流
                </h2>
                <p className={styles.sectionCopy}>按关卡查看开始、完成、失败、重试，并在同一页观察局内行为占比。</p>
              </div>
              <span className="pill">{config.levelFunnel.length} 个关卡</span>
            </div>
            <div className={styles.levelGrid}>
              <div className={styles.levelTable}>
                <div className={styles.levelTableHeader}>
                  <span>关卡</span>
                  <span>开始</span>
                  <span>完成</span>
                  <span>失败</span>
                  <span>重试</span>
                  <span>主要失败原因</span>
                </div>
                {config.levelFunnel.map((row) => (
                  <div key={`${row.levelId}-${row.levelType}`} className={styles.levelTableRow}>
                    <span>{row.levelType ? `${row.levelId} (${row.levelType})` : row.levelId}</span>
                    <span>{row.starts}</span>
                    <span>{row.completes}</span>
                    <span>{row.fails}</span>
                    <span>{row.retries}</span>
                    <span>{row.topFailReason || "—"}</span>
                  </div>
                ))}
              </div>
              <div className={styles.microflowPanel}>
                <div className={styles.microflowTitle}>局内微观心流</div>
                <div className={styles.microflowList}>
                  {(config.microflowByLevel ?? []).slice(0, 4).map((group) => (
                    <div key={group.levelId} className={styles.microflowGroup}>
                      <div className={styles.microflowGroupTitle}>关卡 {group.levelId}</div>
                      {group.actions.slice(0, 4).map((row) => (
                        <div key={`${group.levelId}-${row.action}`} className={styles.microflowItem}>
                          <div>
                            <strong>{row.action}</strong>
                            <div className={styles.rankMeta}>行为占比</div>
                          </div>
                          <div className={styles.microflowStats}>
                            <span>{row.count} 次</span>
                            <span>{row.ratio.toFixed(1)}%</span>
                            <span>{row.avgDuration.toFixed(1)} 秒</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.sideBySidePanels}>
              <div className={styles.infoPanel}>
                <div className={styles.infoPanelTitle}>失败原因分布</div>
                <div className={styles.infoPanelList}>
                  {(config.levelFailReasonDistribution ?? []).slice(0, 5).map((item) => (
                    <div key={item.name} className={styles.infoPanelRow}>
                      <span>{item.name}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.infoPanel}>
                <div className={styles.infoPanelTitle}>重试排行</div>
                <div className={styles.infoPanelList}>
                  {(config.levelRetryRanking ?? []).slice(0, 5).map((item) => (
                    <div key={`${item.levelId}-${item.levelType}`} className={styles.infoPanelRow}>
                      <span>{item.levelType ? `${item.levelId} (${item.levelType})` : item.levelId}</span>
                      <strong>{item.retries} 次</strong>
                    </div>
                  ))}
                </div>
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
      </div>
    </AppShell>
  );
}
