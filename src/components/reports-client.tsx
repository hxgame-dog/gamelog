"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ReportsActions({
  projectId,
  compareVersion
}: {
  projectId: string | null;
  compareVersion?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="header-actions">
      <button
        className="button-primary"
        disabled={isPending || !projectId}
        onClick={() =>
          startTransition(async () => {
            if (!projectId) {
              return;
            }

            setError(null);
            setMessage(null);

            try {
              const response = await fetch("/api/reports/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, compareVersion })
              });
              const data = await response.json();
              if (!response.ok) {
                setError(data.error || "重新分析失败。");
                return;
              }
              setMessage("AI 报告已更新。");
              router.refresh();
            } catch {
              setError("网络异常，AI 报告未生成。");
            }
          })
        }
      >
        {isPending ? "正在分析..." : "重新分析"}
      </button>
      <button className="button-secondary">导出报告</button>
      {message ? <span className="pill">{message}</span> : null}
      {error ? <span className="pill" style={{ color: "var(--red)" }}>{error}</span> : null}
    </div>
  );
}
