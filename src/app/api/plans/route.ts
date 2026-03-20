import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { createPlan, getPlansForProject } from "@/lib/server/plans";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }
  const projectId = request.nextUrl.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "缺少 projectId。" }, { status: 400 });
  }

  const items = await getPlansForProject(projectId);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录。" }, { status: 401 });
    }
    const body = await request.json();
    const item = await createPlan(body);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建方案失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
