import assert from "node:assert/strict";
import test from "node:test";

import type { ImportSummary } from "./import-summary";
import {
  deriveImportStatusKey,
  getVisibleImportIssues,
  resolveImportWorkspaceState
} from "./imports-workspace";

function createSummary(overrides: Partial<ImportSummary> = {}): ImportSummary {
  return {
    recordCount: 12,
    successRate: 98,
    errorCount: 0,
    unmatchedEvents: 0,
    previewRows: [],
    topEvents: [],
    topPlacements: [],
    topLevels: [],
    failReasons: [],
    onboardingFunnel: [],
    onboardingStepTrend: [],
    onboardingSteps: [],
    levelProgress: [],
    levelFunnel: [],
    levelFailReasonDistribution: [],
    levelRetryRanking: [],
    microflowRows: [],
    microflowByLevel: [],
    monetizationStoreFunnel: [],
    monetizationPaymentFunnel: [],
    giftPackDistribution: [],
    adPlacementBreakdown: [],
    adPlacementFlow: [],
    metrics: [],
    categories: {
      system: { metrics: {}, main: [], aux: [], auxLabels: [], ranking: [], insight: "" },
      onboarding: { metrics: {}, main: [], aux: [], auxLabels: [], ranking: [], insight: "" },
      level: { metrics: {}, main: [], aux: [], auxLabels: [], ranking: [], insight: "" },
      monetization: { metrics: {}, main: [], aux: [], auxLabels: [], ranking: [], insight: "" },
      ads: { metrics: {}, main: [], aux: [], auxLabels: [], ranking: [], insight: "" },
      custom: { metrics: {}, main: [], aux: [], auxLabels: [], ranking: [], insight: "" }
    },
    overview: {
      activeUsers: 0,
      healthScore: 0,
      keyAnomalyCount: 0,
      monetizationValue: 0
    },
    ...overrides
  };
}

test("resolveImportWorkspaceState suppresses previous persisted batch while a new local upload is waiting to import", () => {
  const latestImport = { id: "latest", summaryJson: createSummary() };
  const selectedHistoryImport = { id: "selected", summaryJson: createSummary() };

  const state = resolveImportWorkspaceState({
    summary: null,
    hasPendingLocalUpload: true,
    selectedHistoryImport,
    latestImport
  });

  assert.equal(state.activeImport, null);
  assert.equal(state.displaySummary, null);
});

test("deriveImportStatusKey treats summary without strict diagnostics as pending instead of high risk", () => {
  assert.equal(deriveImportStatusKey(createSummary()), "PENDING");
  assert.equal(
    deriveImportStatusKey(
      createSummary({
        diagnostics: {
          overallStatus: "HIGH_RISK",
          technicalSuccessRate: 78,
          technicalErrorCount: 2,
          businessFailureCount: 1,
          moduleCoverage: 60,
          moduleChecks: {
            global: { status: "PASS", canAnalyze: true, matchedRows: 1, expectedEvents: [], missingEvents: [], missingFields: [] },
            onboarding: { status: "PASS", canAnalyze: true, matchedRows: 1, expectedEvents: [], missingEvents: [], missingFields: [] },
            level: { status: "PASS", canAnalyze: true, matchedRows: 1, expectedEvents: [], missingEvents: [], missingFields: [] },
            ads: { status: "PASS", canAnalyze: true, matchedRows: 1, expectedEvents: [], missingEvents: [], missingFields: [] },
            monetization: { status: "PASS", canAnalyze: true, matchedRows: 1, expectedEvents: [], missingEvents: [], missingFields: [] },
            liveops: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
            economy: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
            social: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] }
          },
          issues: []
        }
      })
    ),
    "HIGH_RISK"
  );
});

test("getVisibleImportIssues keeps the full diagnostics issue list", () => {
  const summary = createSummary({
    diagnostics: {
      overallStatus: "SEVERE_GAP",
      technicalSuccessRate: 42,
      technicalErrorCount: 8,
      businessFailureCount: 3,
      moduleCoverage: 20,
      moduleChecks: {
        global: { status: "SEVERE_GAP", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        onboarding: { status: "HIGH_RISK", canAnalyze: true, matchedRows: 1, expectedEvents: [], missingEvents: [], missingFields: [] },
        level: { status: "PASS", canAnalyze: true, matchedRows: 1, expectedEvents: [], missingEvents: [], missingFields: [] },
        ads: { status: "PASS", canAnalyze: true, matchedRows: 1, expectedEvents: [], missingEvents: [], missingFields: [] },
        monetization: { status: "PASS", canAnalyze: true, matchedRows: 1, expectedEvents: [], missingEvents: [], missingFields: [] },
        liveops: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        economy: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        social: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] }
      },
      issues: Array.from({ length: 12 }, (_, index) => ({
        severity: index % 2 === 0 ? "error" : "warning",
        code: "missing_field",
        module: "global",
        target: `field_${index}`,
        message: `missing ${index}`,
        suggestion: `fix ${index}`
      }))
    }
  });

  const issues = getVisibleImportIssues(summary);
  assert.equal(issues.length, 12);
  assert.equal(issues[11]?.target, "field_11");
});
