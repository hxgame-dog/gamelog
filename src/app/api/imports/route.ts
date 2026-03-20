import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { createLogImport } from "@/lib/server/imports";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const item = await createLogImport(body);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "日志导入失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
