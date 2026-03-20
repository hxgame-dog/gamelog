import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/auth";
import { generateSyntheticDataset } from "@/lib/server/synthetic-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ planId: string }> }
) {
  await requireUser();

  try {
    const { planId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await generateSyntheticDataset(planId, body);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "模拟数据生成失败。"
      },
      { status: 400 }
    );
  }
}
