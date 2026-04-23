import type { ImportSummary } from "./import-summary";

type ImportLike = {
  summaryJson?: ImportSummary | null;
} | null;

export function resolveImportWorkspaceState<T extends ImportLike>(input: {
  summary: ImportSummary | null;
  hasPendingLocalUpload: boolean;
  selectedHistoryImport: T;
  latestImport: T;
}) {
  const activeImport = input.hasPendingLocalUpload
    ? null
    : input.selectedHistoryImport ?? input.latestImport ?? null;

  return {
    activeImport,
    displaySummary: input.summary ?? (input.hasPendingLocalUpload ? null : activeImport?.summaryJson ?? null)
  };
}

export function deriveImportStatusKey(summary: ImportSummary | null) {
  if (!summary?.diagnostics) {
    return "PENDING" as const;
  }

  return summary.diagnostics.overallStatus;
}

export function getVisibleImportIssues(summary: ImportSummary | null) {
  return summary?.diagnostics?.issues ?? [];
}
