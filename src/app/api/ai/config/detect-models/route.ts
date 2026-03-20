import { NextRequest, NextResponse } from "next/server";

import { detectAndPersistGeminiModels } from "@/lib/server/ai-config";
import { getCurrentUser, isAdminUser } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  const isAdmin = await isAdminUser(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "仅管理员可检测模型。" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { apiKey?: string };
    const config = await detectAndPersistGeminiModels(body.apiKey);
    return NextResponse.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "检测 Gemini 模型失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
