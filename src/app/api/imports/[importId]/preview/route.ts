import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { getImportPreviewById } from "@/lib/server/imports";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  const { importId } = await params;
  const item = await getImportPreviewById(importId);

  if (!item) {
    return NextResponse.json({ error: "未找到导入批次。" }, { status: 404 });
  }

  return NextResponse.json({ item });
}
