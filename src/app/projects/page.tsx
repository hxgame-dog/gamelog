import { AppShell } from "@/components/app-shell";
import { ProjectsClient } from "@/components/projects-client";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { getProjectsForUser } from "@/lib/server/projects";

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await getProjectsForUser(user.id);

  return (
    <AppShell currentPath="/projects">
      <PageHeader
        title="项目管理"
        copy="在这里创建和管理你的游戏项目。每个项目都会拥有独立的事件分类、打点方案、日志导入与分析结果。"
      />
      <ProjectsClient initialProjects={projects} />
    </AppShell>
  );
}
