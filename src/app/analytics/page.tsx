import { AppShell } from "@/components/app-shell";
import { OperationsOverviewClient } from "@/components/operations-overview-client";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { getOperationsOverviewData } from "@/lib/server/analytics";
import { getProjectsForUser } from "@/lib/server/projects";

export default async function AnalyticsOverviewPage({
  searchParams
}: {
  searchParams: Promise<{ projectId?: string; compareVersion?: string; importId?: string }>;
}) {
  const user = await requireUser();
  const projects = await getProjectsForUser(user.id);
  const { projectId, compareVersion, importId } = await searchParams;
  const activeProject = (projectId
    ? projects.find((project) => project.id === projectId)
    : null) ?? projects[0] ?? null;
  const activeProjectId = activeProject?.id ?? null;
  const overview = await getOperationsOverviewData(activeProjectId, compareVersion, importId);

  return (
    <AppShell currentPath="/analytics">
      <PageHeader
        title="运营分析"
        copy="从当前导入批次的数据质量出发，快速定位最值得优先查看的业务模块与异常问题。"
        actions={
          <div className="header-actions">
            <span className="pill">{activeProject?.name ?? "未选择项目"}</span>
            <span className="pill">{overview.sourceLabel}</span>
            <span className="pill">版本 {overview.versionLabel}</span>
            {overview.compareVersionLabel ? <span className="pill">对比 {overview.compareVersionLabel}</span> : null}
          </div>
        }
      />
      <OperationsOverviewClient overview={overview} />
    </AppShell>
  );
}
