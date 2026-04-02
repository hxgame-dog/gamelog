import styles from "@/components/import-page.module.css";
import { AppShell } from "@/components/app-shell";
import { ImportsClient } from "@/components/imports-client";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { getLatestImportForProject } from "@/lib/server/imports";
import { getPlansForProject } from "@/lib/server/plans";
import { getProjectsForUser } from "@/lib/server/projects";

export default async function ImportsPage() {
  const user = await requireUser();
  const projects = await getProjectsForUser(user.id);
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

  return (
    <AppShell currentPath="/imports">
      <PageHeader
        title="数据导入"
        copy="将日志数据绑定到具体项目、版本和打点方案后，统一完成字段映射、格式校验和导入摘要，减少分析前的人工整理。"
      />

      <div className={styles.pageLead}>
        首版会先保存导入批次摘要和核心聚合指标，方便你快速验证方案与看板是否打通。
      </div>

      <ImportsClient
        projects={projects as never[]}
        initialProjectId={projects[0]?.id ?? null}
        plansByProject={plansByProject as never}
        latestImportsByProject={latestImportsByProject as never}
      />
    </AppShell>
  );
}
