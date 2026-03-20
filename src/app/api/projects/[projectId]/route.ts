import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { deleteProjectForUser } from "@/lib/server/projects";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  try {
    const { projectId } = await params;
    await deleteProjectForUser(user.id, projectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除项目失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
