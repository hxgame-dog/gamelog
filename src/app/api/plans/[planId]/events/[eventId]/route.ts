import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { deleteEvent, updateEvent } from "@/lib/server/plans";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string; eventId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  try {
    const { eventId } = await params;
    const body = await request.json();
    const item = await updateEvent(eventId, body);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存事件失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string; eventId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  try {
    const { eventId } = await params;
    const item = await deleteEvent(eventId);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除事件失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
