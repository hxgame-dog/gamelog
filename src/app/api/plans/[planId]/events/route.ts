import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { createEvent } from "@/lib/server/plans";

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
    const item = await createEvent(planId, body);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建事件失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
