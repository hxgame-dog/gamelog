import { notFound } from "next/navigation";

import styles from "@/components/analytics-page.module.css";
import { AppShell } from "@/components/app-shell";
import {
  BarChartCard,
  DonutChartCard,
  InsightCard,
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
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requireUser();
  const { category } = await params;

  if (!validCategories.has(category)) {
    notFound();
  }

  const projects = await getProjectsForUser(user.id);
  const { projectId } = await searchParams;
  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const config = await getAnalyticsCategoryData(
    category as "system" | "onboarding" | "level" | "monetization" | "ads" | "custom",
    activeProjectId
  );

  return (
    <AppShell currentPath="/analytics">
      <PageHeader
        title={config.title}
        copy="围绕当前分类展示版本对比、关键指标、核心结构图和 AI 判断，帮助团队快速确认问题位置与影响范围。"
        actions={
          <div className="header-actions">
            <span className="pill">{config.sourceLabel}</span>
            <span className="pill">版本 {config.versionLabel}</span>
            <button className="button-secondary">导出图表</button>
          </div>
        }
      />

      <div className={styles.layout}>
        <section className={`panel ${styles.hero}`}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
              flexWrap: "wrap"
            }}
          >
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
            <VersionCompareSwitch />
          </div>

          <div className={styles.metricGrid}>
            {config.metrics.map((metric) => (
              <div key={metric.label} className={`surface ${styles.metricCard}`}>
                <div className={styles.metricLabel}>{metric.label}</div>
                <div className={styles.metricValue} style={{ color: config.color }}>
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.chartGrid}>
          <BarChartCard
            title="核心漏斗"
            copy="主图始终比辅助图更大，用来承载页面最重要的结论。"
            values={config.main}
            color={config.color}
          />
          <LineChartCard
            title="版本趋势"
            copy="观察最近导入或模拟批次的变化，判断问题是偶发波动还是持续趋势。"
            values={config.trend}
            color={config.color}
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

        <div className={styles.detailGrid}>
          <section className={`panel ${styles.tableCard}`}>
            <h2 className="section-title" style={{ fontSize: 18 }}>
              重点事件排行
            </h2>
            <div className={styles.rankList}>
              {config.ranking.map(([name, meta], index) => (
                <div key={`${name}-${index}`} className={styles.rankItem}>
                  <div className={styles.rankIndex}>{index + 1}</div>
                  <div>
                    <strong>{name}</strong>
                    <div className={styles.rankMeta}>{meta}</div>
                  </div>
                  <span className="pill">查看明细</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.insightCard}>
            <InsightCard title="AI 分类洞察" copy={config.insight} tone={config.color} />
          </section>
        </div>
      </div>
    </AppShell>
  );
}
