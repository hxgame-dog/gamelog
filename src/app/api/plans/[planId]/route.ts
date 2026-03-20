import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { updatePlan } from "@/lib/server/plans";

export async function PATCH(
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
    const item = await updatePlan(planId, body);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新方案失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
