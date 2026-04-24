import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { deleteLogImportForUser } from "@/lib/server/imports";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  try {
    const { importId } = await params;
    const result = await deleteLogImportForUser(user.id, importId);
    return NextResponse.json({ item: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除导入批次失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
