"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ReportsActions({
  projectId,
  compareVersion,
  currentImportId,
  importOptions
}: {
  projectId: string | null;
  compareVersion?: string | null;
  currentImportId?: string | null;
  importOptions?: Array<{
    id: string;
    label: string;
    source?: string | null;
    uploadedAt?: string | Date;
  }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="header-actions">
      {importOptions?.length ? (
        <select
          className="button-secondary"
          value={currentImportId ?? ""}
          onChange={(event) => {
            const params = new URLSearchParams();
            if (projectId) {
              params.set("projectId", projectId);
            }
            if (compareVersion) {
              params.set("compareVersion", compareVersion);
            }
            if (event.target.value) {
              params.set("importId", event.target.value);
            }
            router.push(`/reports?${params.toString()}`);
          }}
        >
          {importOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      ) : null}
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
                body: JSON.stringify({ projectId, compareVersion, importId: currentImportId })
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
