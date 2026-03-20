"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function AuthMenuClient({
  user
}: {
  user: {
    name: string;
    email: string;
  } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!user) {
    return null;
  }

  return (
    <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
      <div className="surface" style={{ padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
        <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 12 }}>{user.email}</div>
      </div>
      <button
        className="button-secondary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.replace("/login");
            router.refresh();
          })
        }
      >
        退出登录
      </button>
    </div>
  );
}
