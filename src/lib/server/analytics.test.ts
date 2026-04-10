import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { deriveOnboardingTrendCompareSeries } from "../analytics-ui";
import { buildImportSummary } from "../import-summary";
import { getOperationsOverviewData, resolveOnboardingFunnelRows } from "./analytics";
import { getMemoryStore } from "./store";

const mappings = [
  { source: "event_name", target: "event_name" },
  { source: "user_id", target: "user_id" },
  { source: "level_id", target: "level_id" },
  { source: "level_type", target: "level_type" },
  { source: "step_id", target: "step_id" },
  { source: "step_name", target: "step_name" },
  { source: "result", target: "result" },
  { source: "fail_reason", target: "fail_reason" },
  { source: "duration_sec", target: "duration_sec" },
  { source: "placement", target: "placement" },
  { source: "price", target: "price" },
  { source: "reward_type", target: "reward_type" }
];

function resetMemoryStore() {
  const store = getMemoryStore();
  store.projects = [];
  store.memberships = [];
  store.categories = [];
  store.plans = [];
  store.planInputSources = [];
  store.planDiagnoses = [];
  store.events = [];
  store.properties = [];
  store.globalProperties = [];
  store.dictionaries = [];
  store.dictionaryMappings = [];
  store.logUploads = [];
  store.metricSnapshots = [];
  store.aiReports = [];
  store.planTasks = [];
}

function seedImport(id: string, projectId: string, version: string, uploadedAt: number) {
  const summary = buildImportSummary(
    [
      { event_name: "tutorial_step", user_id: `${id}-u1`, step_id: "1", step_name: "show_tip", duration_sec: 4 },
      { event_name: "tutorial_step_complete", user_id: `${id}-u1`, step_id: "1", step_name: "show_tip", result: "success", duration_sec: 4 },
      { event_name: "level_start", user_id: `${id}-u1`, level_id: "1", level_type: "normal" },
      { event_name: "level_complete", user_id: `${id}-u1`, level_id: "1", level_type: "normal", result: "success" },
      { event_name: "af_initiated_checkout", user_id: `${id}-u1` },
      { event_name: "af_purchase", user_id: `${id}-u1`, price: 6.66, reward_type: "starter_pack" },
      { event_name: "af_ad_view", user_id: `${id}-u1`, placement: "FreeBox1" },
      { event_name: "af_ad_click", user_id: `${id}-u1`, placement: "FreeBox1" }
    ],
    mappings
  );

  getMemoryStore().logUploads.push({
    id,
    fileName: `${id}.csv`,
    source: "REAL",
    version,
    rawHeaders: [],
    fieldMappings: mappings,
    summaryJson: summary,
    recordCount: summary.recordCount,
    successRate: summary.successRate,
    errorCount: summary.errorCount,
    unmatchedEvents: summary.unmatchedEvents,
    status: "COMPLETED",
    uploadedAt,
    projectId,
    trackingPlanId: "plan-1"
  });
}

test("getOperationsOverviewData clears compare version when it matches the selected current import version", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const projectId = "project-1";
  seedImport("import-v1", projectId, "1.0.0", 1);
  seedImport("import-v2", projectId, "2.0.0", 2);

  const overview = await getOperationsOverviewData(projectId, "2.0.0", "import-v2");

  assert.equal(overview.versionLabel, "2.0.0");
  assert.equal(overview.currentImportId, "import-v2");
  assert.equal(overview.compareVersionLabel, null);
});

test("resolveOnboardingFunnelRows falls back to step trend rows when funnel rows are missing", () => {
  const rows = resolveOnboardingFunnelRows({
    onboardingStepTrend: [
      {
        stepId: "step-1",
        stepName: "打开引导",
        arrivals: 100,
        completions: 92,
        completionRate: 92,
        avgDuration: 4.6
      },
      {
        stepId: "step-2",
        stepName: "完成操作",
        arrivals: 73,
        completions: 70,
        completionRate: 95.9,
        avgDuration: 7.2
      }
    ]
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.stepName, "打开引导");
  assert.equal(rows[0]?.dropoffCount, 27);
  assert.equal(rows[1]?.dropoffCount, 3);
});

test("deriveOnboardingTrendCompareSeries keeps missing compare steps empty instead of fabricating zeroes", () => {
  const comparison = deriveOnboardingTrendCompareSeries(
    [
      {
        stepId: "step-1",
        stepName: "打开引导",
        completionRate: 90
      },
      {
        stepId: "step-2",
        stepName: "完成操作",
        completionRate: 90
      }
    ],
    [
      {
        stepId: "step-1",
        stepName: "打开引导",
        completionRate: 88
      }
    ]
  );

  assert.deepEqual(comparison.compareValues, [88, null]);
  assert.equal(comparison.compareLatest, null);
});

test("getOperationsOverviewData links onboarding anomaly shortcut to the redesigned onboarding signal section", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const projectId = "project-2";
  seedImport("import-v3", projectId, "3.0.0", 3);

  const overview = await getOperationsOverviewData(projectId, null, "import-v3");
  const onboardingShortcut = overview.anomalyShortcuts.find((item) => item.label.startsWith("最大流失步骤:"));

  assert.ok(onboardingShortcut);
  assert.match(onboardingShortcut.href, /\/analytics\/onboarding\?/);
  assert.match(onboardingShortcut.href, /#onboarding-signal$/);
  assert.doesNotMatch(onboardingShortcut.href, /detailFilter=abnormal/);
});

test("onboarding signal anchor is attached to the actual signal section", () => {
  const pagePath = path.resolve(process.cwd(), "src/app/analytics/[category]/page.tsx");
  const source = readFileSync(pagePath, "utf8");
  const signalSectionPattern = /<section id="onboarding-signal" className=\{styles\.moduleSection\}>[\s\S]*?\{onboardingSections\[2\]\}/;

  assert.match(source, signalSectionPattern);
});
