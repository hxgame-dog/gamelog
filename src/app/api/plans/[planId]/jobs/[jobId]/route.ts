import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { getPlanJob } from "@/lib/server/plan-jobs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string; jobId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  const { planId, jobId } = await params;
  const item = getPlanJob(jobId);
  if (!item || item.trackingPlanId !== planId) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  return NextResponse.json({ item });
}
