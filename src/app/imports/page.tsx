import styles from "@/components/import-page.module.css";
import { AppShell } from "@/components/app-shell";
import { ImportsClient } from "@/components/imports-client";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { getImportsForProject, getLatestImportForProject } from "@/lib/server/imports";
import { getPlansForProject } from "@/lib/server/plans";
import { getProjectsForUser } from "@/lib/server/projects";

export default async function ImportsPage({
  searchParams
}: {
  searchParams: Promise<{ projectId?: string; importId?: string }>;
}) {
  const user = await requireUser();
  const { projectId, importId } = await searchParams;
  const projects = await getProjectsForUser(user.id);
  const resolvedProjectId = projectId ?? projects[0]?.id ?? null;
  const plansByProject = Object.fromEntries(
    await Promise.all(
      projects.map(async (project) => [project.id, await getPlansForProject(project.id)])
    )
  );
  const latestImportsByProject = Object.fromEntries(
    await Promise.all(
      projects.map(async (project) => [project.id, await getLatestImportForProject(project.id)])
    )
  );
  const importsHistoryByProject = Object.fromEntries(
    await Promise.all(
      projects.map(async (project) => [project.id, await getImportsForProject(project.id)])
    )
  );

  return (
    <AppShell currentPath="/imports">
      <PageHeader
        title="数据导入"
        copy="将日志数据绑定到具体项目、版本和打点方案后，统一完成字段映射、清洗预览、严格诊断和导入摘要，减少分析前的人工整理。"
      />

      <div className={styles.pageLead}>
        当前导入会同时保存清洗后的预览数据、严格诊断结果和核心聚合指标，方便你先判断日志质量，再进入运营分析。
      </div>

      <ImportsClient
        projects={projects as never[]}
        initialProjectId={resolvedProjectId}
        initialImportId={importId ?? null}
        plansByProject={plansByProject as never}
        latestImportsByProject={latestImportsByProject as never}
        importsHistoryByProject={importsHistoryByProject as never}
      />
    </AppShell>
  );
}
