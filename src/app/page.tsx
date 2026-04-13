import Link from "next/link";

import styles from "@/components/dashboard.module.css";
import { AppShell } from "@/components/app-shell";
import { CategoryPill, InsightCard, MetricCard, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { getDashboardOverview } from "@/lib/server/dashboard";
import { getLatestImportForProject } from "@/lib/server/imports";
import { getProjectsForUser } from "@/lib/server/projects";

export default async function HomePage() {
  const user = await requireUser();
  const overview = await getDashboardOverview();
  const recentImports = "recentImports" in overview ? overview.recentImports ?? [] : [];
  const categorySnapshots = "categorySnapshots" in overview ? overview.categorySnapshots ?? [] : [];
  const priorityAlerts = "priorityAlerts" in overview ? overview.priorityAlerts ?? [] : [];
  const projects = await getProjectsForUser(user.id);
  const activeProject = projects.find((project) => project.name === overview.projectName) ?? projects[0] ?? null;
  const activeProjectId = activeProject?.id ?? null;
  const latestImport = activeProjectId ? await getLatestImportForProject(activeProjectId) : null;
  const activeImportId = latestImport?.id ?? null;
  const compareVersionParam =
    overview.compareVersion && overview.compareVersion !== "上一版本" && overview.compareVersion !== overview.currentVersion
      ? overview.compareVersion
      : null;

  function buildAnalyticsCategoryHref(
    categoryKey: string,
    options?: { compareVersion?: string | null; detailFilter?: string | null }
  ) {
    const params = new URLSearchParams();

    if (activeProjectId) {
      params.set("projectId", activeProjectId);
    }
    if (activeImportId) {
      params.set("importId", activeImportId);
    }
    if (options?.compareVersion) {
      params.set("compareVersion", options.compareVersion);
    }
    if (options?.detailFilter) {
      params.set("detailFilter", options.detailFilter);
    }

    const qs = params.toString();
    return `/analytics/${categoryKey}${qs ? `?${qs}` : ""}`;
  }

  function mergeHrefWithContext(href: string, fallback: string) {
    const fallbackUrl = new URL(fallback, "http://localhost");
    const candidateUrl = new URL(href?.trim() ? href : fallback, "http://localhost");

    candidateUrl.searchParams.forEach((value, key) => {
      if (!fallbackUrl.searchParams.get(key)) {
        fallbackUrl.searchParams.set(key, value);
      }
    });

    if (activeProjectId && !fallbackUrl.searchParams.get("projectId")) {
      fallbackUrl.searchParams.set("projectId", activeProjectId);
    }
    if (activeImportId && !fallbackUrl.searchParams.get("importId")) {
      fallbackUrl.searchParams.set("importId", activeImportId);
    }
    if (compareVersionParam && !fallbackUrl.searchParams.get("compareVersion")) {
      fallbackUrl.searchParams.set("compareVersion", compareVersionParam);
    }

    return `${fallbackUrl.pathname}${fallbackUrl.search}${candidateUrl.hash || fallbackUrl.hash}`;
  }

  return (
    <AppShell currentPath="/">
      <PageHeader
        title="项目总览"
        copy="围绕事件分类查看当前版本的数据健康度、导入状态和 AI 洞察，帮助策划、数据和研发在同一视图里对齐问题。"
        actions={
          <div className="header-actions">
            <Link
              href={activeProjectId ? `/imports?${new URLSearchParams({ projectId: activeProjectId }).toString()}` : "/imports"}
              className="button-primary"
            >
              上传日志
            </Link>
          </div>
        }
      />

      <section className={`panel ${styles.hero}`}>
        <div className={styles.heroTop}>
          <div className={styles.heroCopy}>
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
        <div className={styles.compareSummary}>
          <div>
            <div className={styles.compareSummaryLabel}>版本差异总览</div>
            <div className={styles.compareSummaryTitle}>
              {overview.currentVersion}
              {overview.compareVersion ? ` vs ${overview.compareVersion}` : ""}
            </div>
          </div>
          <p className={styles.compareSummaryCopy}>
            首页现在会优先汇总最新导入批次和最近一个可对比版本的健康分、异常数与分类快照。
            如果某个模块出现显著波动，可以直接进入运营分析页继续看主图、趋势和结构化明细。
          </p>
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
                href={buildAnalyticsCategoryHref(category.key, { compareVersion: compareVersionParam })}
                className={`surface ${styles.categoryCard}`}
              >
                <div className={styles.categoryHeader}>
                  <CategoryPill label={category.label} color={category.color} />
                  <span className="pill">进入</span>
                </div>
                <h3 className={styles.categoryTitle}>{category.label} 看板</h3>
                <div className={styles.categoryMetricRow}>
                  <span className={styles.categoryMeta}>关键指标</span>
                  <strong className={styles.categoryMetricValue}>
                    {"keyMetric" in category ? category.keyMetric : "等待首批导入"}
                  </strong>
                </div>
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

      <div className={styles.splitGrid}>
        <section className={`panel ${styles.card}`}>
          <div className={styles.sectionRow}>
            <h2 className="section-title" style={{ fontSize: 18 }}>
              异常优先入口
            </h2>
            <span className="pill">直达异常明细</span>
          </div>
          <div className={styles.priorityAlertList}>
            {priorityAlerts.map((item) => {
              const fallback = buildAnalyticsCategoryHref(item.key, {
                compareVersion: compareVersionParam,
                detailFilter: "abnormal"
              });
              const href = mergeHrefWithContext(item.href ?? "", fallback);

              return (
                <Link key={item.key} href={href} className={`surface ${styles.priorityAlertItem}`}>
                  <div className={styles.statusRow}>
                    <strong>{item.title}</strong>
                    <span className="pill">{item.severity.toFixed(1)}%</span>
                  </div>
                  <p className={styles.taskDetail}>{item.detail}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className={`panel ${styles.card}`}>
          <div className={styles.sectionRow}>
            <h2 className="section-title" style={{ fontSize: 18 }}>
              最近导入批次
            </h2>
            <span className="pill">
              {overview.currentVersion} {overview.compareVersion ? `vs ${overview.compareVersion}` : ""}
            </span>
          </div>
          <div className={styles.importBatchList}>
            {recentImports.map((item) => (
              <div key={`${item.version}-${item.fileName}`} className={styles.importBatchItem}>
                <div className={styles.statusRow}>
                  <div>
                    <strong>{item.version}</strong>
                    <div className={styles.taskDetail}>{item.fileName}</div>
                  </div>
                  <span className="pill">{item.sourceLabel}</span>
                </div>
                <div className={styles.importBatchMeta}>
                  <span>通过率 {item.successRate}%</span>
                  <span>健康分 {item.healthScore}</span>
                  <span>异常 {item.anomalyCount}</span>
                </div>
                <div className={styles.importBatchScoreRow}>
                  <div className={styles.scoreCard}>
                    <div className={styles.scoreLabel}>通过率</div>
                    <div className={styles.scoreValue}>{item.successRate}%</div>
                  </div>
                  <div className={styles.scoreCard}>
                    <div className={styles.scoreLabel}>健康分</div>
                    <div className={styles.scoreValue}>{item.healthScore}</div>
                  </div>
                  <div className={styles.scoreCard}>
                    <div className={styles.scoreLabel}>异常数</div>
                    <div className={styles.scoreValue}>{item.anomalyCount}</div>
                  </div>
                </div>
                <div className={styles.taskDetail}>{item.uploadedAtLabel}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={`panel ${styles.card}`}>
          <div className={styles.sectionRow}>
            <h2 className="section-title" style={{ fontSize: 18 }}>
              分类状态快照
            </h2>
            <span className="pill">当前 vs 对比</span>
          </div>
          <div className={styles.snapshotList}>
            {categorySnapshots.map((item) => (
              <Link
                key={item.key}
                href={buildAnalyticsCategoryHref(item.key, { compareVersion: compareVersionParam })}
                className={`surface ${styles.snapshotItem}`}
              >
                <div className={styles.categoryHeader}>
                  <CategoryPill label={item.label} color={item.color} />
                  <span className="pill">{item.currentValue}</span>
                </div>
                <div className={styles.snapshotCompare}>
                  <span>对比版本</span>
                  <strong>{item.compareValue ?? "等待对比版本"}</strong>
                </div>
                <div className={styles.snapshotMetricRow}>
                  <span className={styles.categoryMeta}>当前版本</span>
                  <strong className={styles.categoryMetricValue}>{item.currentValue}</strong>
                </div>
                <p className={styles.categoryMeta}>{item.insight}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
