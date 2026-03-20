import { NextResponse } from "next/server";

import { getDashboardOverview } from "@/lib/server/dashboard";

export async function GET() {
  const data = await getDashboardOverview();
  return NextResponse.json(data);
}
