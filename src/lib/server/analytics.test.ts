import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { deriveOnboardingTrendCompareSeries } from "../analytics-ui";
import { buildImportSummary } from "../import-summary";
import {
  deriveOnboardingDurationSeries,
  getAnalyticsCategoryData,
  getCategoryRiskContext,
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

test("homepage anomaly shortcuts preserve analytics context when linking into rebuilt module pages", () => {
  const pagePath = path.resolve(process.cwd(), "src/app/page.tsx");
  const source = readFileSync(pagePath, "utf8");

  assert.match(source, /function mergeHrefWithContext\(href: string, fallback: string\)/);
  assert.match(source, /const fallbackUrl = new URL\(fallback, "http:\/\/localhost"\)/);
  assert.match(source, /candidateUrl\.hash \|\| fallbackUrl\.hash/);
  assert.match(source, /return `\$\{fallbackUrl\.pathname\}\$\{fallbackUrl\.search\}\$\{candidateUrl\.hash \|\| fallbackUrl\.hash\}`/);
  assert.match(source, /buildAnalyticsCategoryHref\(item\.key, \{\s*compareVersion: compareVersionParam,\s*detailFilter: "abnormal"/);
});

test("analytics pages still preserve import preview context while removing business quality cards", () => {
  const pagePath = path.resolve(process.cwd(), "src/app/analytics/[category]/page.tsx");
  const source = readFileSync(pagePath, "utf8");

  assert.match(source, /compareVersionParam \? \["compareVersion", compareVersionParam\] : null/);
  assert.match(source, /detailFilter \? \["detailFilter", detailFilter\] : null/);
  assert.match(source, /`\/imports\?\$\{new URLSearchParams\(/);
  assert.match(source, /aria-label="查看技术通过率对应的当前批次导入预览"/);
  assert.doesNotMatch(source, /function ModuleQualityCards/);
  assert.doesNotMatch(source, /质量底座/);
});

test("operations overview entry page uses the new operations-first IA instead of generic analytics cards", () => {
  const pagePath = path.resolve(process.cwd(), "src/components/operations-overview-client.tsx");
  const source = readFileSync(pagePath, "utf8");

  assert.match(source, /当前批次质量总览/);
  assert.match(source, /四个核心模块/);
  assert.match(source, /建议阅读顺序/);
  assert.match(source, /异常优先入口/);
  assert.match(source, /查看导入预览/);
  assert.match(source, /aria-label={`查看\$\{card\.label\}对应的导入预览`}/);
  assert.match(source, /aria-label={`进入\$\{card\.label\}模块`}/);
  assert.doesNotMatch(source, /按事件分类查看/);
});

test("projects page links analytics entry to the operations overview instead of onboarding directly", () => {
  const pagePath = path.resolve(process.cwd(), "src/components/projects-client.tsx");
  const source = readFileSync(pagePath, "utf8");

  assert.match(source, /href=\{`\/analytics\?projectId=\$\{project\.id\}`\}/);
  assert.match(source, />\s*运营分析\s*</);
  assert.doesNotMatch(source, /\/analytics\/onboarding\?projectId=/);
});

test("imports CTAs use operations language and preserve the selected batch when returning to analytics", () => {
  const pagePath = path.resolve(process.cwd(), "src/components/imports-client.tsx");
  const source = readFileSync(pagePath, "utf8");

  assert.match(source, /进入新手引导分析/);
  assert.match(source, /进入关卡与局内行为分析/);
  assert.match(source, /进入广告分析/);
  assert.match(source, /进入商业化分析/);
  assert.match(source, /查看完整诊断/);
  assert.match(source, /searchParams\.get\("compareVersion"\)/);
  assert.match(source, /searchParams\.get\("detailFilter"\)/);
  assert.match(source, /params\.set\("importId", selectedHistoryImport\.id\)/);
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
  assert.match(source, /"高摩擦关卡"/);
  assert.match(source, /"关卡压力条"/);
  assert.match(source, /"局内微观心流"/);
  assert.match(source, /styles\.opsSnapshot/);
  assert.match(source, /levelSummaryRows/);
  assert.match(source, /ITEM_USE_RATE/);
  assert.match(source, /<section id="level-microflow" className=\{styles\.moduleSection\}>/);
  assert.match(source, /<section id="level-detail" className=\{styles\.moduleSection\}>/);
});

test("monetization and ads pages keep dedicated business sections without top-level quality cards", () => {
  const pagePath = path.resolve(process.cwd(), "src/app/analytics/[category]/page.tsx");
  const source = readFileSync(pagePath, "utf8");

  assert.match(source, /const monetizationSections = \[/);
  assert.match(source, /"双漏斗主图"/);
  assert.match(source, /"商业化明细表"/);
  assert.doesNotMatch(source, /data-monetization-checklist=\{monetizationChecklist\}/);
  assert.match(source, /<section id="monetization-signal" className=\{styles\.moduleSection\}>/);
  assert.match(source, /<section id="monetization-main-chart" className=\{styles\.moduleSection\}>/);

  assert.match(source, /const adsSections = \[/);
  assert.match(source, /"广告位流转主图"/);
  assert.match(source, /"广告明细表"/);
  assert.doesNotMatch(source, /data-ads-checklist=\{adsChecklist\}/);
  assert.match(source, /<section id="ads-signal" className=\{styles\.moduleSection\}>/);
  assert.match(source, /<section id="ads-main-chart" className=\{styles\.moduleSection\}>/);
});

test("generic analytics charts only receive compare series when a compare version is selected", () => {
  const pagePath = path.resolve(process.cwd(), "src/app/analytics/[category]/page.tsx");
  const source = readFileSync(pagePath, "utf8");

  assert.match(source, /compareValues=\{config\.compareVersionLabel \? config\.compareMain : undefined\}/);
  assert.match(source, /compareValues=\{config\.compareVersionLabel \? config\.compareTrend : undefined\}/);
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

test("getOperationsOverviewData picks the worst monetization loss stage across store and payment funnels", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const projectId = "project-monetization-loss-overview";

  seedImportSummary("import-monetization-loss-overview", projectId, "6.2.0", 62, {
    monetizationStoreFunnel: [
      { label: "商店曝光", count: 200, rate: 100 },
      { label: "礼包点击", count: 160, rate: 80 },
      { label: "下单", count: 130, rate: 65 }
    ],
    monetizationPaymentFunnel: [
      { label: "支付发起", count: 130, rate: 100 },
      { label: "支付确认", count: 120, rate: 92.3 },
      { label: "支付成功", count: 70, rate: 53.8 }
    ]
  });

  const overview = await getOperationsOverviewData(projectId, null, "import-monetization-loss-overview");
  const monetizationCard = overview.moduleCards.find((item) => item.key === "monetization");
  const monetizationShortcut = overview.anomalyShortcuts.find((item) => item.label.startsWith("最大转化损耗点:"));

  assert.ok(monetizationCard);
  assert.match(monetizationCard.anomaly, /支付链路/);
  assert.match(monetizationCard.anomaly, /支付确认 -> 支付成功 流失 50/);
  assert.ok(monetizationShortcut);
  assert.match(monetizationShortcut.label, /支付链路/);
  assert.match(monetizationShortcut.label, /支付确认 -> 支付成功 流失 50/);
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

test("getAnalyticsCategoryData compare summary text uses the selected current import version instead of the latest import", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const projectId = "project-compare-summary-current-import";
  seedImport("import-v1", projectId, "1.0.0", 1);
  seedImport("import-v2", projectId, "2.0.0", 2);
  seedImport("import-v3", projectId, "3.0.0", 3);

  seedMetricSnapshot(projectId, "1.0.0", "system_valid_rate", 81, "system", 1);
  seedMetricSnapshot(projectId, "1.0.0", "import_success_rate", 81, "system", 1);
  seedMetricSnapshot(projectId, "1.0.0", "system_error_rate", 4, "system", 1);
  seedMetricSnapshot(projectId, "1.0.0", "active_users", 100, "system", 1);
  seedMetricSnapshot(projectId, "1.0.0", "system_event_count", 1000, "system", 1);
  seedMetricSnapshot(projectId, "2.0.0", "system_valid_rate", 84, "system", 2);
  seedMetricSnapshot(projectId, "2.0.0", "import_success_rate", 84, "system", 2);
  seedMetricSnapshot(projectId, "2.0.0", "system_error_rate", 3, "system", 2);
  seedMetricSnapshot(projectId, "2.0.0", "active_users", 120, "system", 2);
  seedMetricSnapshot(projectId, "2.0.0", "system_event_count", 1200, "system", 2);
  seedMetricSnapshot(projectId, "3.0.0", "system_valid_rate", 90, "system", 3);
  seedMetricSnapshot(projectId, "3.0.0", "import_success_rate", 90, "system", 3);
  seedMetricSnapshot(projectId, "3.0.0", "system_error_rate", 2, "system", 3);
  seedMetricSnapshot(projectId, "3.0.0", "active_users", 150, "system", 3);
  seedMetricSnapshot(projectId, "3.0.0", "system_event_count", 1500, "system", 3);

  const system = (await getAnalyticsCategoryData("system", projectId, "1.0.0", "import-v2")) as {
    versionLabel: string;
    compareVersionLabel?: string | null;
    compareInsight?: string | null;
  };

  assert.equal(system.versionLabel, "2.0.0");
  assert.equal(system.compareVersionLabel, "1.0.0");
  assert.match(system.compareInsight ?? "", /当前版本 2\.0\.0 正在对比 1\.0\.0/);
  assert.doesNotMatch(system.compareInsight ?? "", /当前版本 3\.0\.0/);
});

test("getAnalyticsCategoryData keeps monetization click rate empty when the stage-specific click rate is unavailable", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const projectId = "project-monetization-click-rate";
  seedImportSummary("import-monetization-click-rate", projectId, "5.4.0", 54, {
    categories: {
      monetization: {
        metrics: {
          conversionRate: 8.7
        },
        main: [100, 80, 65],
        aux: [60, 40],
        auxLabels: ["礼包 A", "礼包 B"],
        ranking: [],
        insight: "商业化链路正常。"
      }
    },
    monetizationStoreFunnel: [
      { label: "商店曝光", count: 100 },
      { label: "礼包点击", count: 42 },
      { label: "下单", count: 10, rate: 10 }
    ],
    monetizationPaymentFunnel: [
      { label: "支付发起", count: 10, rate: 100 },
      { label: "支付成功", count: 8, rate: 80 }
    ]
  });
  seedMetricSnapshot(projectId, "5.4.0", "monetization_conversion_rate", 8.7, "monetization", 54);
  seedMetricSnapshot(projectId, "5.4.0", "monetization_event_count", 100, "monetization", 54);

  const monetization = await getAnalyticsCategoryData("monetization", projectId, null, "import-monetization-click-rate");

  assert.equal(monetization.metrics[1]?.label, "点击率");
  assert.equal(monetization.metrics[1]?.value, "—");
});

test("getAnalyticsCategoryData explicitly calls out request and play ambiguity when ad counts are inferred", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const projectId = "project-ads-ambiguity";
  const summary = buildImportSummary(
    [
      { event_name: "session_start", user_id: "u1" },
      { event_name: "af_ad_view", user_id: "u1", placement: "Rewarded-End" },
      { event_name: "af_ad_click", user_id: "u1", placement: "Rewarded-End" },
      { event_name: "af_ad_reward", user_id: "u1", placement: "Rewarded-End" }
    ],
    mappings
  );

  if (summary.adPlacementBreakdown?.[0]) {
    summary.adPlacementBreakdown[0].inferred = true;
  }

  seedImportSummary("import-ads-ambiguity", projectId, "3.1.0", 31, summary as unknown as Record<string, unknown>);
  seedMetricSnapshot(projectId, "3.1.0", "ad_completion_rate", 100, "ads", 31);

  const ads = (await getAnalyticsCategoryData("ads", projectId, null, "import-ads-ambiguity")) as {
    adsNote?: string | null;
  };

  assert.match(ads.adsNote ?? "", /无法严格区分/);
  assert.match(ads.adsNote ?? "", /请求/);
  assert.match(ads.adsNote ?? "", /播放/);
});

test("getCategoryRiskContext combines global issues with current module issues", () => {
  const risk = getCategoryRiskContext("onboarding", {
    diagnostics: {
      overallStatus: "HIGH_RISK",
      technicalSuccessRate: 88,
      technicalErrorCount: 2,
      businessFailureCount: 1,
      moduleCoverage: 64,
      moduleChecks: {
        global: {
          status: "HIGH_RISK",
          canAnalyze: false,
          matchedRows: 12,
          expectedEvents: ["event_time", "user_id"],
          missingEvents: [],
          missingFields: ["event_time"]
        },
        onboarding: {
          status: "HIGH_RISK",
          canAnalyze: true,
          matchedRows: 8,
          expectedEvents: ["tutorial_begin", "tutorial_step", "tutorial_complete"],
          missingEvents: ["tutorial_complete"],
          missingFields: ["step_name"]
        },
        level: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        ads: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        monetization: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        liveops: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        economy: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        social: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] }
      },
      issues: [
        {
          severity: "error",
          code: "missing_field",
          module: "global",
          target: "event_time",
          message: "公共属性缺少 event_time",
          suggestion: "补齐事件时间映射"
        },
        {
          severity: "warning",
          code: "missing_event",
          module: "onboarding",
          target: "tutorial_complete",
          message: "缺少 tutorial_complete",
          suggestion: "补齐引导完成事件"
        },
        {
          severity: "info",
          code: "missing_event",
          module: "ads",
          target: "ad_request",
          message: "广告请求未命中",
          suggestion: "补齐广告请求事件"
        }
      ]
    }
  } as never);

  assert.ok(risk);
  assert.equal(risk.status, "HIGH_RISK");
  assert.equal(risk.issueCount, 2);
  assert.equal(risk.globalIssueCount, 1);
  assert.deepEqual(risk.missingEvents, ["tutorial_complete"]);
  assert.deepEqual(risk.missingFields, ["step_name"]);
  assert.equal(risk.topIssues[0]?.target, "event_time");
  assert.equal(risk.topIssues[1]?.target, "tutorial_complete");
});

test("getCategoryRiskContext does not leave a passing module looking safe when global issues exist", () => {
  const risk = getCategoryRiskContext("level", {
    diagnostics: {
      overallStatus: "HIGH_RISK",
      technicalSuccessRate: 91,
      technicalErrorCount: 1,
      businessFailureCount: 0,
      moduleCoverage: 83,
      moduleChecks: {
        global: {
          status: "HIGH_RISK",
          canAnalyze: false,
          matchedRows: 24,
          expectedEvents: ["event_time"],
          missingEvents: [],
          missingFields: ["event_time"]
        },
        onboarding: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        level: {
          status: "PASS",
          canAnalyze: true,
          matchedRows: 18,
          expectedEvents: ["level_start", "level_complete"],
          missingEvents: [],
          missingFields: []
        },
        ads: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        monetization: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        liveops: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        economy: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        social: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] }
      },
      issues: [
        {
          severity: "error",
          code: "missing_field",
          module: "global",
          target: "event_time",
          message: "公共属性缺少 event_time",
          suggestion: "补齐事件时间映射"
        }
      ]
    }
  } as never);

  assert.ok(risk);
  assert.notEqual(risk.status, "PASS");
  assert.equal(risk.globalIssueCount, 1);
  assert.match(risk.note, /公共属性问题/);
  assert.doesNotMatch(risk.note, /可以直接解读图表/);
});

test("getCategoryRiskContext marks missing diagnostics as pending instead of risky", () => {
  const risk = getCategoryRiskContext("ads", {} as never);

  assert.ok(risk);
  assert.equal(risk.status, "PENDING");
  assert.equal(risk.issueCount, 0);
  assert.match(risk.note, /还没有严格诊断结果/);
});

test("getAnalyticsCategoryData threads diagnostics-backed module risk through all operations modules", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const projectId = "project-module-risk";
  seedImportSummary("import-module-risk", projectId, "8.8.0", 88, {
    categories: {
      onboarding: {
        metrics: { completionRate: 61.2, avgDuration: 14.8 },
        main: [100, 82, 61],
        aux: [5.4, 9.1, 14.8],
        auxLabels: ["步骤 1", "步骤 2", "步骤 3"],
        ranking: [],
        insight: "引导结论。"
      },
      level: {
        metrics: { completionRate: 48.2, failRate: 38.4 },
        main: [64, 58, 43],
        aux: [42, 28, 20],
        auxLabels: ["超时", "误触", "退出"],
        ranking: [],
        insight: "关卡结论。"
      },
      monetization: {
        metrics: { conversionRate: 7.2, value: 188.6 },
        main: [100, 44, 19],
        aux: [61, 39],
        auxLabels: ["礼包 A", "礼包 B"],
        ranking: [],
        insight: "商业化结论。"
      },
      ads: {
        metrics: { completionRate: 74.4, rewardRate: 68.1 },
        main: [100, 76, 31],
        aux: [52, 48],
        auxLabels: ["Rewarded", "Interstitial"],
        ranking: [],
        insight: "广告结论。"
      }
    },
    diagnostics: {
      overallStatus: "HIGH_RISK",
      technicalSuccessRate: 91.5,
      technicalErrorCount: 2,
      businessFailureCount: 1,
      moduleCoverage: 67,
      moduleChecks: {
        global: {
          status: "HIGH_RISK",
          canAnalyze: false,
          matchedRows: 20,
          expectedEvents: ["event_time"],
          missingEvents: [],
          missingFields: ["event_time"]
        },
        onboarding: {
          status: "HIGH_RISK",
          canAnalyze: true,
          matchedRows: 16,
          expectedEvents: ["tutorial_begin", "tutorial_complete"],
          missingEvents: ["tutorial_complete"],
          missingFields: ["step_name"]
        },
        level: {
          status: "PASS",
          canAnalyze: true,
          matchedRows: 18,
          expectedEvents: ["level_start", "level_complete"],
          missingEvents: [],
          missingFields: []
        },
        ads: {
          status: "HIGH_RISK",
          canAnalyze: true,
          matchedRows: 12,
          expectedEvents: ["ad_request", "ad_reward"],
          missingEvents: ["ad_request"],
          missingFields: []
        },
        monetization: {
          status: "SEVERE_GAP",
          canAnalyze: false,
          matchedRows: 5,
          expectedEvents: ["store_exposure", "payment_success"],
          missingEvents: ["payment_success"],
          missingFields: ["price"]
        },
        liveops: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        economy: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        social: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] }
      },
      issues: [
        {
          severity: "error",
          code: "missing_field",
          module: "global",
          target: "event_time",
          message: "公共属性缺少 event_time",
          suggestion: "补齐事件时间映射"
        },
        {
          severity: "warning",
          code: "missing_event",
          module: "onboarding",
          target: "tutorial_complete",
          message: "缺少 tutorial_complete",
          suggestion: "补齐引导完成事件"
        },
        {
          severity: "error",
          code: "missing_event",
          module: "monetization",
          target: "payment_success",
          message: "缺少 payment_success",
          suggestion: "补齐支付成功事件"
        },
        {
          severity: "warning",
          code: "missing_event",
          module: "ads",
          target: "ad_request",
          message: "缺少 ad_request",
          suggestion: "补齐广告请求事件"
        }
      ]
    }
  });
  seedMetricSnapshot(projectId, "8.8.0", "import_success_rate", 91.5, "system", 88);

  const onboarding = (await getAnalyticsCategoryData("onboarding", projectId, null, "import-module-risk")) as {
    moduleRisk?: {
      status: string;
      issueCount: number;
      globalIssueCount: number;
      missingEvents: string[];
    } | null;
  };
  const level = (await getAnalyticsCategoryData("level", projectId, null, "import-module-risk")) as {
    moduleRisk?: {
      status: string;
      canAnalyze: boolean;
      note: string;
    } | null;
  };
  const monetization = (await getAnalyticsCategoryData("monetization", projectId, null, "import-module-risk")) as {
    moduleRisk?: {
      status: string;
      canAnalyze: boolean;
      missingFields: string[];
    } | null;
  };
  const ads = (await getAnalyticsCategoryData("ads", projectId, null, "import-module-risk")) as {
    moduleRisk?: {
      status: string;
      issueCount: number;
      globalIssueCount: number;
      note: string;
    } | null;
  };

  assert.equal(onboarding.moduleRisk?.status, "HIGH_RISK");
  assert.equal(onboarding.moduleRisk?.issueCount, 2);
  assert.deepEqual(onboarding.moduleRisk?.missingEvents, ["tutorial_complete"]);

  assert.equal(level.moduleRisk?.status, "HIGH_RISK");
  assert.equal(level.moduleRisk?.canAnalyze, true);
  assert.match(level.moduleRisk?.note ?? "", /公共属性问题/);
  assert.doesNotMatch(level.moduleRisk?.note ?? "", /可以直接解读图表/);

  assert.equal(monetization.moduleRisk?.status, "SEVERE_GAP");
  assert.equal(monetization.moduleRisk?.canAnalyze, false);
  assert.deepEqual(monetization.moduleRisk?.missingFields, ["price"]);

  assert.equal(ads.moduleRisk?.status, "HIGH_RISK");
  assert.equal(ads.moduleRisk?.issueCount, 2);
  assert.equal(ads.moduleRisk?.globalIssueCount, 1);
  assert.match(ads.moduleRisk?.note ?? "", /公共属性问题/);
});

test("getAnalyticsCategoryData keeps pending module risk when diagnostics are missing but module data exists", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const projectId = "project-module-risk-pending";
  seedImportSummary("import-module-risk-pending", projectId, "2.7.0", 27, {
    categories: {
      ads: {
        metrics: { completionRate: 66.4, rewardRate: 58.1 },
        main: [100, 68, 41],
        aux: [55, 45],
        auxLabels: ["Rewarded", "Interstitial"],
        ranking: [],
        insight: "广告结论。"
      }
    }
  });
  seedMetricSnapshot(projectId, "2.7.0", "ad_completion_rate", 66.4, "ads", 27);

  const ads = (await getAnalyticsCategoryData("ads", projectId, null, "import-module-risk-pending")) as {
    moduleRisk?: {
      status: string;
      issueCount: number;
      note: string;
    } | null;
  };

  assert.ok(ads.moduleRisk);
  assert.equal(ads.moduleRisk?.status, "PENDING");
  assert.equal(ads.moduleRisk?.issueCount, 0);
  assert.match(ads.moduleRisk?.note ?? "", /还没有严格诊断结果/);
});

test("getAnalyticsCategoryData preserves diagnostics-backed module risk on degraded data paths", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const projectId = "project-module-risk-degraded";
  seedImportSummary("import-module-risk-degraded", projectId, "4.4.0", 44, {
    diagnostics: {
      overallStatus: "HIGH_RISK",
      technicalSuccessRate: 89,
      technicalErrorCount: 3,
      businessFailureCount: 1,
      moduleCoverage: 52,
      moduleChecks: {
        global: {
          status: "HIGH_RISK",
          canAnalyze: false,
          matchedRows: 14,
          expectedEvents: ["event_time"],
          missingEvents: [],
          missingFields: ["event_time"]
        },
        onboarding: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        level: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        ads: {
          status: "HIGH_RISK",
          canAnalyze: true,
          matchedRows: 11,
          expectedEvents: ["ad_request"],
          missingEvents: ["ad_request"],
          missingFields: []
        },
        monetization: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        liveops: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        economy: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] },
        social: { status: "MISSING", canAnalyze: false, matchedRows: 0, expectedEvents: [], missingEvents: [], missingFields: [] }
      },
      issues: [
        {
          severity: "warning",
          code: "missing_event",
          module: "ads",
          target: "ad_request",
          message: "缺少 ad_request",
          suggestion: "补齐广告请求事件"
        }
      ]
    }
  });

  const ads = (await getAnalyticsCategoryData("ads", projectId, null, "import-module-risk-degraded")) as {
    source: string;
    moduleRisk?: {
      status: string;
      missingEvents: string[];
    } | null;
  };

  assert.equal(ads.source, "REAL");
  assert.ok(ads.moduleRisk);
  assert.equal(ads.moduleRisk?.status, "HIGH_RISK");
  assert.deepEqual(ads.moduleRisk?.missingEvents, ["ad_request"]);
});

test("getCategoryRiskContext degrades safely when persisted diagnostics payloads are partial", () => {
  const risk = getCategoryRiskContext("monetization", {
    diagnostics: {
      overallStatus: "HIGH_RISK",
      technicalSuccessRate: 84,
      technicalErrorCount: 4,
      businessFailureCount: 2,
      moduleCoverage: 41,
      moduleChecks: {
        global: {
          status: "HIGH_RISK",
          canAnalyze: false,
          matchedRows: 8,
          expectedEvents: ["event_time"],
          missingEvents: [],
          missingFields: ["event_time"]
        }
      },
      issues: [
        {
          severity: "error",
          code: "missing_field",
          module: "global",
          target: "event_time",
          message: "公共属性缺少 event_time",
          suggestion: "补齐事件时间映射"
        }
      ]
    }
  } as never);

  assert.ok(risk);
  assert.equal(risk.status, "PENDING");
  assert.equal(risk.canAnalyze, false);
  assert.equal(risk.globalIssueCount, 0);
  assert.match(risk.note, /严格诊断结果/);
});

test("analytics module pages render a dedicated risk banner for operations categories", () => {
  const pagePath = path.resolve(process.cwd(), "src/app/analytics/[category]/page.tsx");
  const source = readFileSync(pagePath, "utf8");

  assert.match(source, /function ModuleRiskBanner/);
  assert.match(source, /moduleRisk\?: \{/);
  assert.match(source, /<ModuleRiskBanner moduleRisk=\{config\.moduleRisk\} importPreviewHref=\{importPreviewHref\} \/>/);
  assert.match(source, /<section id="onboarding-signal" className=\{styles\.moduleSection\}>[\s\S]*?<ModuleRiskBanner moduleRisk=\{config\.moduleRisk\} importPreviewHref=\{importPreviewHref\} \/>/);
  assert.doesNotMatch(source, /data-monetization-checklist=\{monetizationChecklist\}/);
  assert.doesNotMatch(source, /data-ads-checklist=\{adsChecklist\}/);
  assert.match(source, /moduleRisk\.status === "PENDING"/);
  assert.match(source, /"等待诊断"/);
});
