import { notFound } from "next/navigation";

import styles from "@/components/analytics-page.module.css";
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
  searchParams: Promise<{ projectId?: string; compareVersion?: string }>;
}) {
  const user = await requireUser();
  const { category } = await params;

  if (!validCategories.has(category)) {
    notFound();
  }

  const projects = await getProjectsForUser(user.id);
  const { projectId, compareVersion } = await searchParams;
  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const config = await getAnalyticsCategoryData(
    category as "system" | "onboarding" | "level" | "monetization" | "ads" | "custom",
    activeProjectId,
    compareVersion
  ) as unknown as {
    title: string;
    color: string;
    sourceLabel: string;
    versionLabel: string;
    compareVersionLabel?: string | null;
    versionOptions?: string[];
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
            {config.compareVersionLabel ? <span className="pill">对比 {config.compareVersionLabel}</span> : null}
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
                    href={`/analytics/${item.key}${activeProjectId ? `?projectId=${activeProjectId}` : ""}`}
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
                  `/analytics/${category}${activeProjectId ? `?projectId=${activeProjectId}&compareVersion=${encodeURIComponent(version)}` : `?compareVersion=${encodeURIComponent(version)}`}`
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
