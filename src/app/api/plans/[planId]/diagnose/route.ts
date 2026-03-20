import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { createPlanJob } from "@/lib/server/plan-jobs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  try {
    const { planId } = await params;
    const item = createPlanJob(planId, "DIAGNOSE");
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 方案诊断失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
