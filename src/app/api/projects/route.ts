import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { createProjectForUser, getProjectsForUser } from "@/lib/server/projects";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }
  const projects = await getProjectsForUser(user.id);
  return NextResponse.json({ items: projects });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录。" }, { status: 401 });
    }
    const body = await request.json();
    const project = await createProjectForUser(user.id, body);
    return NextResponse.json({ item: project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建项目失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
