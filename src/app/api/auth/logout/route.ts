import { NextResponse } from "next/server";

import { logoutCurrentUser } from "@/lib/server/auth";

export async function POST() {
  await logoutCurrentUser();
  return NextResponse.json({ ok: true });
}
