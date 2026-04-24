import assert from "node:assert/strict";
import test from "node:test";

import { buildImportSummary, type ImportRow } from "../import-summary";
import { createLogImport, deleteLogImportForUser, getImportPreviewById } from "./imports";
import { getMemoryStore } from "./store";

const mappings = [
  { source: "event_name", target: "event_name" },
  { source: "event_time", target: "event_time" },
  { source: "user_id", target: "user_id" },
  { source: "platform", target: "platform" },
  { source: "app_version", target: "app_version" },
  { source: "country_code", target: "country_code" },
  { source: "step_id", target: "step_id" },
  { source: "step_name", target: "step_name" },
  { source: "level_id", target: "level_id" },
  { source: "level_type", target: "level_type" },
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

test("getImportPreviewById exposes cleaning metadata and strict diagnostics alongside preview rows", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const rows: ImportRow[] = [
    {
      event_name: "tutorial_begin",
      event_time: "2026-04-22T10:00:00.000Z",
      user_id: "u-1",
      platform: "ios",
      app_version: "1.0.0",
      country_code: "CN"
    },
    {
      event_name: "tutorial_step",
      event_time: "2026-04-22T10:00:03.000Z",
      user_id: "u-1",
      platform: "ios",
      app_version: "1.0.0",
      country_code: "CN",
      step_id: "step_01",
      step_name: "show_tip"
    },
    {
      event_name: "tutorial_complete",
      event_time: "2026-04-22T10:00:15.000Z",
      user_id: "u-1",
      platform: "ios",
      app_version: "1.0.0",
      country_code: "CN"
    },
    {
      event_name: "level_start",
      event_time: "2026-04-22T10:01:00.000Z",
      user_id: "u-1",
      platform: "ios",
      app_version: "1.0.0",
      country_code: "CN",
      level_id: "1",
      level_type: "normal"
    },
    {
      event_name: "level_complete",
      event_time: "2026-04-22T10:02:00.000Z",
      user_id: "u-1",
      platform: "ios",
      app_version: "1.0.0",
      country_code: "CN",
      level_id: "1",
      level_type: "normal"
    },
    {
      event_name: "af_ad_view",
      event_time: "2026-04-22T10:03:00.000Z",
      user_id: "u-1",
      platform: "ios",
      app_version: "1.0.0",
      country_code: "CN",
      placement: "FreeBox"
    },
    {
      event_name: "af_initiated_checkout",
      event_time: "2026-04-22T10:04:00.000Z",
      user_id: "u-1",
      platform: "ios",
      app_version: "1.0.0",
      country_code: "CN",
      price: 6.66,
      reward_type: "starter_pack"
    }
  ];

  const summary = buildImportSummary(rows, mappings, {
    sourceKind: "raw_csv",
    encoding: "gb18030",
    delimiter: ";",
    expandedFields: ["event_value", "custom_data"]
  });

  const created = await createLogImport({
    projectId: "project-import-preview",
    trackingPlanId: "plan-import-preview",
    version: "1.0.0",
    fileName: "raw (3).csv",
    rawHeaders: Object.keys(rows[0] ?? {}),
    summary,
    mappings
  });

  const preview = await getImportPreviewById(created.id);

  assert.ok(preview);
  assert.deepEqual(preview.previewRows, summary.previewRows);
  assert.deepEqual(preview.cleaning, summary.cleaning);
  assert.equal(preview.diagnostics?.overallStatus, summary.diagnostics?.overallStatus);
  assert.deepEqual(preview.summary.cleaning, summary.cleaning);
  assert.equal(
    preview.summary.diagnostics?.moduleChecks.global.canAnalyze,
    summary.diagnostics?.moduleChecks.global.canAnalyze
  );
  assert.equal(
    preview.summary.diagnostics?.moduleChecks.onboarding.canAnalyze,
    summary.diagnostics?.moduleChecks.onboarding.canAnalyze
  );
});

test("deleteLogImportForUser removes import previews and refreshes version metric snapshots", async () => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();

  const store = getMemoryStore();
  store.memberships.push({
    id: "member-delete-import",
    projectId: "project-delete-import",
    userId: "user-delete-import",
    role: "OWNER",
    createdAt: Date.now()
  });

  const rows: ImportRow[] = [
    {
      event_name: "level_start",
      event_time: "2026-04-22T10:01:00.000Z",
      user_id: "u-1",
      platform: "ios",
      app_version: "1.0.0",
      country_code: "CN",
      level_id: "1"
    },
    {
      event_name: "level_complete",
      event_time: "2026-04-22T10:02:00.000Z",
      user_id: "u-1",
      platform: "ios",
      app_version: "1.0.0",
      country_code: "CN",
      level_id: "1"
    }
  ];
  const firstSummary = buildImportSummary(rows, mappings);
  const secondSummary = buildImportSummary([...rows, rows[0]], mappings);

  const first = await createLogImport({
    projectId: "project-delete-import",
    trackingPlanId: "plan-delete-import",
    version: "1.0.0",
    fileName: "raw-old.csv",
    rawHeaders: Object.keys(rows[0] ?? {}),
    summary: firstSummary,
    mappings
  });
  const second = await createLogImport({
    projectId: "project-delete-import",
    trackingPlanId: "plan-delete-import",
    version: "1.0.0",
    fileName: "raw-new.csv",
    rawHeaders: Object.keys(rows[0] ?? {}),
    summary: secondSummary,
    mappings
  });

  const result = await deleteLogImportForUser("user-delete-import", second.id);

  assert.equal(result.deletedId, second.id);
  assert.equal(result.nextImportId, first.id);
  assert.equal(await getImportPreviewById(second.id), null);
  assert.ok(await getImportPreviewById(first.id));
  assert.equal(store.logUploads.length, 1);
  assert.equal(
    store.metricSnapshots.filter((item) => item.projectId === "project-delete-import" && item.version === "1.0.0").length,
    firstSummary.metrics.length
  );
});
