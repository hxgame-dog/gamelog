import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { deriveOnboardingTrendCompareSeries } from "../analytics-ui";
import { buildImportSummary } from "../import-summary";
import {
  deriveOnboardingDurationSeries,
  getAnalyticsCategoryData,
  getLevelDiagnostics,
  getOperationsOverviewData,
  resolveOnboardingFunnelRows
} from "./analytics";
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

function seedImportSummary(
  id: string,
  projectId: string,
  version: string,
  uploadedAt: number,
  summaryJson: Record<string, unknown>
) {
  getMemoryStore().logUploads.push({
    id,
    fileName: `${id}.csv`,
    source: "REAL",
    version,
    rawHeaders: [],
    fieldMappings: mappings,
    summaryJson,
    recordCount: 0,
    successRate: 100,
    errorCount: 0,
    unmatchedEvents: 0,
    status: "COMPLETED",
    uploadedAt,
    projectId,
    trackingPlanId: "plan-1"
  });
}

function seedMetricSnapshot(
  projectId: string,
  version: string,
  metricKey: string,
  metricValue: number,
  dimension: string,
  capturedAt: number
) {
  getMemoryStore().metricSnapshots.push({
    id: `${projectId}-${version}-${metricKey}-${capturedAt}`,
    metricKey,
    metricLabel: metricKey,
    metricValue,
    dimension,
    version,
    capturedAt,
    projectId
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

test("getLevelDiagnostics sorts worst levels, retry hotspots, and microflow hotspots by first-class severity", () => {
  const diagnostics = getLevelDiagnostics({
    levelFunnel: [
      {
        levelId: "L-2",
        levelType: "elite",
        starts: 100,
        completes: 35,
        fails: 65,
        retries: 44,
        completionRate: 35,
        failRate: 65,
        topFailReason: "timeout"
      },
      {
        levelId: "L-1",
        levelType: "normal",
        starts: 100,
        completes: 52,
        fails: 48,
        retries: 62,
        completionRate: 52,
        failRate: 48,
        topFailReason: "misclick"
      }
    ],
    levelRetryRanking: [
      {
        levelId: "L-2",
        levelType: "elite",
        retries: 44,
        starts: 100,
        retryRate: 44
      },
      {
        levelId: "L-1",
        levelType: "normal",
        retries: 62,
        starts: 100,
        retryRate: 62
      }
    ],
    microflowByLevel: [
      {
        levelId: "L-1",
        actions: [
          { action: "camera_rotate", count: 50, ratio: 50, avgDuration: 3.5 },
          { action: "item_use", count: 18, ratio: 18, avgDuration: 1.8 }
        ]
      },
      {
        levelId: "L-2",
        actions: [
          { action: "unlock_extra_slot", count: 71, ratio: 71, avgDuration: 5.4 }
        ]
      }
    ]
  });

  assert.equal(diagnostics.levelWorst[0]?.levelId, "L-2");
  assert.equal(diagnostics.levelRetryHot[0]?.levelId, "L-1");
  assert.equal(diagnostics.microflowHot[0]?.levelId, "L-2");
  assert.equal(diagnostics.microflowHot[0]?.action, "unlock_extra_slot");
});

test("level page keeps a dedicated checklist and lower microflow section instead of generic chart ordering", () => {
  const pagePath = path.resolve(process.cwd(), "src/app/analytics/[category]/page.tsx");
  const source = readFileSync(pagePath, "utf8");

  assert.match(source, /const levelSections = \[/);
  assert.match(source, /"数据质量卡"/);
  assert.match(source, /"局内微观心流"/);
  assert.match(source, /<section id="level-microflow" className=\{styles\.moduleSection\}>/);
  assert.match(source, /<section id="level-detail" className=\{styles\.moduleSection\}>/);
});

test("getOperationsOverviewData uses the globally worst level instead of pre-slicing the first eight rows", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const projectId = "project-level-overview";
  const levelFunnel = Array.from({ length: 9 }, (_, index) => ({
    levelId: `L-${index + 1}`,
    levelType: index === 8 ? "boss" : "normal",
    starts: 100,
    completes: 90 - index,
    fails: 10 + index,
    retries: 10 + index,
    completionRate: 90 - index,
    failRate: index === 8 ? 87 : 10 + index,
    topFailReason: index === 8 ? "timeout" : "misclick"
  }));

  seedImportSummary("import-level-overview", projectId, "9.0.0", 9, {
    levelFunnel
  });

  const overview = await getOperationsOverviewData(projectId, null, "import-level-overview");
  const levelCard = overview.moduleCards.find((item) => item.key === "level");
  const levelShortcut = overview.anomalyShortcuts.find((item) => item.label.startsWith("失败最集中关卡:"));

  assert.ok(levelCard);
  assert.match(levelCard.anomaly, /L-9 \(boss\) 失败率 87\.0%/);
  assert.ok(levelShortcut);
  assert.match(levelShortcut.label, /失败最集中关卡: L-9 \(boss\) 失败率 87\.0%/);
});

test("deriveOnboardingDurationSeries keeps long durations instead of clamping them to 100", () => {
  const series = deriveOnboardingDurationSeries(
    [
      { avgDuration: 135.5 },
      { avgDuration: 241.2 }
    ],
    [12, 18]
  );

  assert.deepEqual(series, [135.5, 241.2]);
});

test("getAnalyticsCategoryData does not render ad rate metrics as counts when true ad counts are unavailable", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const projectId = "project-ads-count-safety";
  const summary = buildImportSummary(
    [
      { event_name: "session_start", user_id: "u1" },
      { event_name: "tutorial_step", user_id: "u1", step_id: "1", step_name: "show_tip", duration_sec: 4 }
    ],
    mappings
  );

  seedImportSummary("import-ads-count-safety", projectId, "2.4.0", 24, summary as unknown as Record<string, unknown>);
  seedMetricSnapshot(projectId, "2.4.0", "ad_trigger_rate", 42.4, "ads", 24);
  seedMetricSnapshot(projectId, "2.4.0", "ad_completion_rate", 76.3, "ads", 24);
  seedMetricSnapshot(projectId, "2.4.0", "ad_reward_rate", 71.8, "ads", 24);

  const ads = await getAnalyticsCategoryData("ads", projectId, null, "import-ads-count-safety");

  assert.equal(ads.metrics[0]?.value, "—");
  assert.equal(ads.metrics[1]?.value, "—");
  assert.equal(ads.metrics[2]?.value, "—");
  assert.equal(ads.metrics[3]?.value, "71.8%");
});
