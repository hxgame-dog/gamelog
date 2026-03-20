import { NextRequest, NextResponse } from "next/server";

import { clearAiConfig, getAiConfig, saveAiConfig } from "@/lib/server/ai-config";
import { getCurrentUser, isAdminUser } from "@/lib/server/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  const isAdmin = await isAdminUser(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "仅管理员可查看 AI 设置。" }, { status: 403 });
  }

  const config = await getAiConfig();
  return NextResponse.json(config);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  const isAdmin = await isAdminUser(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "仅管理员可修改 AI 设置。" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const config = await saveAiConfig(body);
    return NextResponse.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存配置失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  const isAdmin = await isAdminUser(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "仅管理员可删除 AI 设置。" }, { status: 403 });
  }

  const config = await clearAiConfig();
  return NextResponse.json(config);
}
