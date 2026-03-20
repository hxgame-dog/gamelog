import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { loginWithPassword } from "@/lib/server/auth";

const loginSchema = z.object({
  email: z.string().email("请输入有效邮箱。"),
  password: z.string().min(6, "密码至少需要 6 位。"),
  name: z.string().optional().nullable()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = loginSchema.parse(body);
    const user = await loginWithPassword(payload);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
