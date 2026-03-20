import { requireUser } from "@/lib/server/auth";
import { exportPlanDocument } from "@/lib/server/plans";

export async function GET(
  request: Request,
  context: { params: Promise<{ planId: string }> }
) {
  await requireUser();

  try {
    const { planId } = await context.params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") === "xlsx" ? "xlsx" : "json";
    const variant = searchParams.get("variant") === "planner" ? "planner" : "developer";
    const exported = await exportPlanDocument(planId, format, variant);

    return new Response(exported.body, {
      status: 200,
      headers: {
        "Content-Type": exported.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(exported.fileName)}`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "方案导出失败。" },
      { status: 400 }
    );
  }
}
