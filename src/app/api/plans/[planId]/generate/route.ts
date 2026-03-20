import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { createPlanJob } from "@/lib/server/plan-jobs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  try {
    const { planId } = await params;
    const body = await request.json();
    const item = createPlanJob(planId, "GENERATE", body);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 生成方案失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
