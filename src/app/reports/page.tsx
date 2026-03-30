import styles from "@/components/report-page.module.css";
import { AppShell } from "@/components/app-shell";
import { ReportsActions } from "@/components/reports-client";
import {
  BarChartCard,
  DonutChartCard,
  InsightCard,
  LineChartCard,
  PageHeader,
  VersionCompareSwitch
} from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { getProjectsForUser } from "@/lib/server/projects";
import { getAiReportView } from "@/lib/server/reports";

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requireUser();
  const projects = await getProjectsForUser(user.id);
  const { projectId } = await searchParams;
  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const reportView = activeProjectId ? await getAiReportView(activeProjectId) : null;

  const report = reportView?.report;

  return (
    <AppShell currentPath="/reports">
      <PageHeader
        title="AI 报告"
        copy="将版本对比、异常归因和调优建议整理成一份可阅读、可分享的分析摘要，方便团队快速对齐优先级。"
        actions={
          <div className="header-actions">
            <VersionCompareSwitch currentVersion={reportView?.versionLabel ?? "未导入"} />
            <ReportsActions projectId={activeProjectId} />
          </div>
        }
      />

      <section className={`panel ${styles.hero}`}>
        <div className={styles.summaryRow}>
          <div className={`surface ${styles.summaryCard}`}>
            <span className="pill">一句话摘要</span>
            <p className={styles.summaryText} style={{ marginTop: 14 }}>
              {report?.headline ?? "当前还没有可用报告。先生成模拟数据或导入真实日志，再重新分析。"}
            </p>
          </div>
          <div className={`surface ${styles.riskCard}`}>
            <span className={styles.riskBadge}>{reportView?.riskLevel ?? "待分析"}</span>
            <p className={styles.summaryText} style={{ marginTop: 14 }}>
              {report?.riskSummary ?? "系统会在你完成一次导入或生成模拟数据后，自动给出风险判断。"}
            </p>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pill">{reportView?.dataSource ?? "暂无数据"}</span>
              <span className="pill">版本 {reportView?.versionLabel ?? "未导入"}</span>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.cards}>
        {report ? (
          [
            { title: "数据异动", content: report.anomaly, tone: "var(--red)" },
            { title: "归因推测", content: report.hypothesis, tone: "var(--blue)" },
            { title: "调优建议", content: report.recommendation, tone: "var(--teal)" }
          ].map((card) => (
            <div key={card.title} className={`panel ${styles.card}`}>
              <h2 className={styles.reportTitle} style={{ color: card.tone }}>
                {card.title}
              </h2>
              <p className={styles.reportCopy}>{card.content}</p>
            </div>
          ))
        ) : (
          <div className={`panel ${styles.card}`}>
            <h2 className={styles.reportTitle}>暂无报告</h2>
            <p className={styles.reportCopy}>先在方案设计中完成方案确认，再导入真实日志或模拟数据，最后回来重新分析。</p>
          </div>
        )}
      </div>

      <div className={styles.evidenceGrid}>
        <BarChartCard
          title="证据图表：引导漏斗"
          copy="报告会引用当前项目最新批次的关键指标，帮助团队快速对齐问题位置。"
          values={reportView?.evidence.onboarding.main ?? [66, 60, 52, 48, 44, 38]}
          color={reportView?.evidence.onboarding.color ?? "var(--green)"}
        />
        <LineChartCard
          title="证据图表：异常趋势"
          copy="趋势图优先反映最近批次的波动，辅助判断当前问题是持续还是偶发。"
          values={reportView?.evidence.level.trend ?? [28, 32, 29, 36, 42, 40, 45]}
          color="var(--red)"
        />
        <DonutChartCard
          title="证据图表：广告构成"
          copy="广告位或广告事件构成会直接影响完成率、关闭率和奖励领取表现。"
          values={reportView?.evidence.ads.aux ?? [42, 26, 18, 14]}
          labels={reportView?.evidence.ads.auxLabels ?? ["激励视频", "插屏", "Banner", "开屏"]}
          colors={["var(--violet)", "var(--blue)", "var(--teal)", "var(--gold)"]}
        />
        <BarChartCard
          title="证据图表：公共事件健康度"
          copy="用于观察启动、登录、会话和错误上报这类底层事件是否稳定，排除系统层异常。"
          values={reportView?.evidence.system.main ?? [82, 76, 68, 54]}
          color={reportView?.evidence.system.color ?? "var(--blue)"}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <InsightCard
          title="下一步建议"
          copy={
            report?.nextStep ??
            "优先回到新手引导和关卡事件看板确认异常是否持续，再决定是先改引导节奏还是先调关卡教学提示。"
          }
          tone="var(--teal)"
        />
      </div>
    </AppShell>
  );
}
