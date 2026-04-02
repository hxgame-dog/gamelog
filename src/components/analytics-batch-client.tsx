"use client";

import { useRouter } from "next/navigation";

export function AnalyticsBatchSwitcher({
  category,
  projectId,
  compareVersion,
  currentImportId,
  importOptions
}: {
  category: string;
  projectId: string | null;
  compareVersion?: string | null;
  currentImportId?: string | null;
  importOptions?: Array<{
    id: string;
    label: string;
    source?: string | null;
  }>;
}) {
  const router = useRouter();

  if (!importOptions?.length) {
    return null;
  }

  return (
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
        router.push(`/analytics/${category}?${params.toString()}`);
      }}
    >
      {importOptions.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
