import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { confirmPlan } from "@/lib/server/plans";

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
    const item = await confirmPlan(planId);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "确认方案失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
