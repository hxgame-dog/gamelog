import { notFound } from "next/navigation";

import styles from "@/components/analytics-page.module.css";
import { AnalyticsBatchSwitcher } from "@/components/analytics-batch-client";
import { AnalyticsDetailClient } from "@/components/analytics-detail-client";
import { AnalyticsExportButton } from "@/components/analytics-export-client";
import { AppShell } from "@/components/app-shell";
import {
  BarChartCard,
  DonutChartCard,
  LineChartCard,
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
  searchParams: Promise<{ projectId?: string; compareVersion?: string; importId?: string }>;
}) {
  const user = await requireUser();
  const { category } = await params;

  if (!validCategories.has(category)) {
    notFound();
  }

  const projects = await getProjectsForUser(user.id);
  const { projectId, compareVersion, importId } = await searchParams;
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
    insight: string;
    compareInsight?: string | null;
  };

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
                                config.currentImportId ? ["importId", config.currentImportId] : null
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
                  `/analytics/${category}${activeProjectId ? `?projectId=${activeProjectId}&compareVersion=${encodeURIComponent(version)}${config.currentImportId ? `&importId=${encodeURIComponent(config.currentImportId)}` : ""}` : `?compareVersion=${encodeURIComponent(version)}`}`
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
              <BarChartCard
                title="核心漏斗"
                copy={config.compareVersionLabel ? `深色柱为 ${config.versionLabel}，浅色柱为 ${config.compareVersionLabel}。` : "主图承载当前分类最关键的漏斗或主流程结论。"}
                values={config.main}
                color={config.color}
                compareValues={config.compareMain}
              />
            </div>
            <div className={styles.secondaryCharts}>
              <LineChartCard
                title="版本趋势"
                copy={config.compareVersionLabel ? `实线为 ${config.versionLabel}，虚线为 ${config.compareVersionLabel}。` : "观察最近导入或模拟批次的变化，判断问题是偶发波动还是持续趋势。"}
                values={config.trend}
                color={config.color}
                compareValues={config.compareTrend}
              />
              <DonutChartCard
                title="构成分析"
                copy="查看当前分类中最主要的事件构成、广告位分布或失败原因。"
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

        {category === "onboarding" && config.onboardingRows?.length ? (
          <section className={`panel ${styles.deepDiveSection}`}>
            <div className={styles.sectionTop}>
              <div>
                <h2 className="section-title" style={{ fontSize: 18 }}>
                  分步骤漏斗
                </h2>
                <p className={styles.sectionCopy}>基于真实日志中的 step_id / step_name 统计每一步的到达、完成与平均耗时。</p>
              </div>
              <span className="pill">{config.onboardingRows.length} 个步骤</span>
            </div>
            <div className={styles.deepDiveGrid}>
              {config.onboardingRows.map((row) => (
                <div key={`${row.stepId}-${row.stepName}`} className={styles.deepDiveCard}>
                  <div className={styles.deepDiveTitle}>{row.stepName || row.stepId}</div>
                  <div className={styles.deepDiveMeta}>步骤 {row.stepId || "未命名"}</div>
                  <div className={styles.deepDiveValue}>{row.completionRate.toFixed(1)}%</div>
                  <div className={styles.deepDiveStats}>
                    <span>{row.arrivals} 到达</span>
                    <span>{row.completions} 完成</span>
                    <span>{row.avgDuration.toFixed(1)} 秒</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {category === "level" && config.levelRows?.length ? (
          <section className={`panel ${styles.deepDiveSection}`}>
            <div className={styles.sectionTop}>
              <div>
                <h2 className="section-title" style={{ fontSize: 18 }}>
                  关卡进度与局内微观心流
                </h2>
                <p className={styles.sectionCopy}>按关卡查看开始、完成、失败、重试，并在同一页观察局内行为占比。</p>
              </div>
              <span className="pill">{config.levelRows.length} 个关卡</span>
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
                {config.levelRows.map((row) => (
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
                <div className={styles.microflowTitle}>局内行为占比</div>
                <div className={styles.microflowList}>
                  {(config.microflowRows ?? []).slice(0, 10).map((row) => (
                    <div key={`${row.levelId}-${row.action}`} className={styles.microflowItem}>
                      <div>
                        <strong>{row.action}</strong>
                        <div className={styles.rankMeta}>{row.levelId}</div>
                      </div>
                      <div className={styles.microflowStats}>
                        <span>{row.count} 次</span>
                        <span>{row.ratio.toFixed(1)}%</span>
                        <span>{row.avgDuration.toFixed(1)} 秒</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
        />
      </div>
    </AppShell>
  );
}
