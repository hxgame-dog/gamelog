import Link from "next/link";

import styles from "@/components/dashboard.module.css";
import { AppShell } from "@/components/app-shell";
import { CategoryPill, InsightCard, MetricCard, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { getDashboardOverview } from "@/lib/server/dashboard";

export default async function HomePage() {
  await requireUser();
  const overview = await getDashboardOverview();

  return (
    <AppShell currentPath="/">
      <PageHeader
        title="项目总览"
        copy="围绕事件分类查看当前版本的数据健康度、导入状态和 AI 洞察，帮助策划、数据和研发在同一视图里对齐问题。"
        actions={
          <div className="header-actions">
            <Link href="/imports" className="button-primary">
              上传日志
            </Link>
          </div>
        }
      />

      <section className={`panel ${styles.hero}`}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.heroBadgeRow}>
              <span className="pill">Vercel 部署</span>
              <span className="pill">Neon 数据库</span>
              <span className="pill">Gemini 已连接</span>
              <span className="pill">
                {overview.storageMode === "database" ? "实时数据源" : "演示数据源"}
              </span>
            </div>
            <h2 className="section-title" style={{ marginTop: 18 }}>
              当前版本的关键状态，一眼看清
            </h2>
            <p className="section-copy">
              最新导入批次、待处理异常和本周 AI 洞察都集中在首屏，适合先快速判断风险，再进入具体分类看板深挖。
            </p>
          </div>
          <Link href="/reports" className="button-primary">
            查看 AI 报告
          </Link>
        </div>
        <div className={styles.metricGrid}>
          {overview.metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>
      </section>

      <div className={styles.splitGrid}>
        <section className={`panel ${styles.card}`}>
          <h2 className="section-title" style={{ fontSize: 18 }}>
            按事件分类查看
          </h2>
          <p className="section-copy">从公共事件到商业化与广告，每个分类页都只保留最关键的指标、排行和 AI 判断。</p>
          <div className={styles.categoryGrid}>
            {overview.categories.map((category) => (
              <Link
                key={category.key}
                href={`/analytics/${category.key}`}
                className={`surface ${styles.categoryCard}`}
              >
                <div className={styles.categoryHeader}>
                  <CategoryPill label={category.label} color={category.color} />
                  <span className="pill">进入</span>
                </div>
                <h3 className={styles.categoryTitle}>{category.label} 看板</h3>
                <p className={styles.categoryMeta}>
                  {"keyMetric" in category ? category.keyMetric : "等待首批导入"}
                </p>
                <p className={styles.categoryMeta}>
                  {"insight" in category ? category.insight : "查看版本对比、核心漏斗、趋势图与 AI 洞察，保持统一视觉和统一认知路径。"}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className={`panel ${styles.card}`}>
          <h2 className="section-title" style={{ fontSize: 18 }}>
            AI 摘要与最近任务
          </h2>
          <div className={styles.insightList}>
            {overview.overviewInsights.map((item) => (
              <InsightCard key={item.title} title={item.title} copy={item.description} tone={item.tone} />
            ))}
          </div>

          <div className={styles.taskList}>
            {overview.recentTasks.map((task) => (
              <div key={task.name} className={styles.taskItem}>
                <div className={styles.statusRow}>
                  <h3 className={styles.taskName}>{task.name}</h3>
                  <span className="pill">{task.status}</span>
                </div>
                <p className={styles.taskDetail}>{task.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
