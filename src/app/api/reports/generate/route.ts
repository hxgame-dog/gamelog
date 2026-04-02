import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/auth";
import { generateAiReport } from "@/lib/server/reports";

export async function POST(request: Request) {
  await requireUser();

  try {
    const body = await request.json();
    const projectId = typeof body?.projectId === "string" ? body.projectId : "";
    const compareVersion = typeof body?.compareVersion === "string" ? body.compareVersion : null;
    const importId = typeof body?.importId === "string" ? body.importId : null;

    if (!projectId) {
      return NextResponse.json({ error: "缺少 projectId。" }, { status: 400 });
    }

    const result = await generateAiReport(projectId, compareVersion, importId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 报告生成失败。" },
      { status: 400 }
    );
  }
}
