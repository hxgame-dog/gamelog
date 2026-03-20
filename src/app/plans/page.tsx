import { AppShell } from "@/components/app-shell";
import { PlansClient, PlansHeaderActions } from "@/components/plans-client";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { getPlansForProject } from "@/lib/server/plans";
import { getCategoriesForProject, getProjectsForUser } from "@/lib/server/projects";

export default async function PlansPage({
  searchParams
}: {
  searchParams: Promise<{ projectId?: string; planId?: string; eventId?: string; focusField?: string; step?: string }>;
}) {
  const user = await requireUser();
  const projects = await getProjectsForUser(user.id);
  const { projectId, planId, eventId, focusField, step } = await searchParams;
  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const plans = activeProjectId ? await getPlansForProject(activeProjectId) : [];
  const categories = activeProjectId ? await getCategoriesForProject(activeProjectId) : [];

  return (
    <AppShell currentPath="/plans">
      <PageHeader
        title="方案设计"
        copy="通过四步流程完成方案创建、输入生成、结果审查和字段结构查看，确保方案包可追溯、可诊断、可确认。"
        actions={<PlansHeaderActions />}
      />

      <PlansClient
        key={`${activeProjectId ?? "none"}:${planId ?? "none"}:${eventId ?? "none"}:${plans.length}`}
        projects={projects}
        activeProjectId={activeProjectId}
        activePlanId={planId ?? null}
        activeEventId={eventId ?? null}
        initialFocusField={focusField ?? null}
        initialStep={
          step === "create" || step === "generate" || step === "results" || step === "schema"
            ? step
            : "create"
        }
        initialPlans={plans as never[]}
        categories={categories as never[]}
      />
    </AppShell>
  );
}
