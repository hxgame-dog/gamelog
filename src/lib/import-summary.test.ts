import assert from "node:assert/strict";
import test from "node:test";

import { buildImportSummary } from "./import-summary";
import { detectAndParseRawTelemetryCsv } from "./raw-telemetry";

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
  { source: "reward_type", target: "reward_type" },
  { source: "activity_id", target: "activity_id" },
  { source: "activity_type", target: "activity_type" },
  { source: "gain_source", target: "gain_source" },
  { source: "gain_amount", target: "gain_amount" },
  { source: "resource_type", target: "resource_type" },
  { source: "trigger_scene", target: "property_hint" },
  { source: "content_id", target: "property_hint" }
] as const;

test("buildImportSummary attaches cleaning metadata and keeps technical success separate from business failures", () => {
  const context = {
    sourceKind: "raw_csv",
    encoding: "utf-8",
    delimiter: ";",
    expandedFields: ["event_value", "custom_data"]
  };

  const summary = buildImportSummary(
    [
      { event_name: "session_start", user_id: "u1" },
      { event_name: "level_start", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_fail", user_id: "u1", level_id: "1", level_type: "normal", result: "fail", fail_reason: "timeout" },
      { user_id: "u2" }
    ],
    [...mappings],
    context
  ) as any;

  assert.deepEqual(summary.cleaning, context);
  assert.equal(summary.technicalErrorCount, 1);
  assert.equal(summary.technicalSuccessRate, 0.75);
  assert.equal(summary.businessFailureCount, 1);
});

test("buildImportSummary reports strict diagnostics for analyzable but incomplete modules", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "tutorial_step", event_time: "2026-04-22 10:00:01", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "level_start", event_time: "2026-04-22 10:00:02", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "ad_impression", event_time: "2026-04-22 10:00:03", user_id: "u1", placement: "FreeBox1" },
      { event_name: "iap_order_create", event_time: "2026-04-22 10:00:04", user_id: "u1", price: 4.99, reward_type: "starter_pack", trigger_scene: "shop" }
    ],
    [...mappings]
  );

  assert.equal(summary.diagnostics?.overallStatus, "HIGH_RISK");
  assert.equal(summary.diagnostics?.moduleChecks.onboarding.status, "HIGH_RISK");
  assert.equal(summary.diagnostics?.moduleChecks.onboarding.canAnalyze, true);
  assert.ok(summary.diagnostics?.moduleChecks.level);
  assert.ok(summary.diagnostics?.moduleChecks.ads);
  assert.ok(summary.diagnostics?.moduleChecks.monetization);
  assert.equal(summary.diagnostics?.moduleChecks.liveops.status, "MISSING");
  assert.equal(summary.diagnostics?.moduleChecks.liveops.canAnalyze, false);
  assert.ok(
    summary.diagnostics?.issues.some(
      (issue) =>
        issue.severity === "warning" &&
        issue.code === "missing_event" &&
        issue.module === "onboarding" &&
        issue.target === "tutorial_complete"
    )
  );
  assert.ok(
    summary.diagnostics?.issues.some(
      (issue) =>
        issue.severity === "warning" &&
        issue.code === "incomplete_chain" &&
        issue.module === "ads" &&
        issue.target === "ad_request"
    )
  );
  assert.ok(
    summary.diagnostics?.issues.every(
      (issue) =>
        typeof issue.severity === "string" &&
        typeof issue.code === "string" &&
        typeof issue.module === "string" &&
        typeof issue.target === "string" &&
        typeof issue.message === "string" &&
        typeof issue.suggestion === "string"
    )
  );
});

test("buildImportSummary normalizes raw alias events before strict diagnostics", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "tutorial_step", event_time: "2026-04-22 10:00:01", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "level_start", event_time: "2026-04-22 10:00:02", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "af_ad_view", event_time: "2026-04-22 10:00:03", user_id: "u1", placement: "FreeBox1" },
      { event_name: "af_purchase", event_time: "2026-04-22 10:00:04", user_id: "u1", price: 4.99, reward_type: "starter_pack", trigger_scene: "shop" }
    ],
    [...mappings]
  );

  assert.equal(summary.diagnostics?.moduleChecks.ads.canAnalyze, true);
  assert.equal(summary.diagnostics?.moduleChecks.monetization.canAnalyze, true);
  assert.ok(
    summary.diagnostics?.issues.some(
      (issue) =>
        issue.severity === "info" &&
        issue.code === "alias_only" &&
        issue.module === "ads" &&
        issue.target === "af_ad_view"
    )
  );
  assert.ok(
    summary.diagnostics?.issues.every(
      (issue) =>
        !(issue.module === "ads" && issue.code === "missing_event" && issue.target === "ad_impression") &&
        !(issue.module === "monetization" && issue.code === "missing_event" && issue.target === "iap_success")
    )
  );
});

test("buildImportSummary applies source mappings before diagnostics field checks", () => {
  const summary = buildImportSummary(
    [
      {
        event_code: "tutorial_step",
        happened_at: "2026-04-22 10:00:01",
        player_id: "u1",
        tutorial_step_code: "step_1",
        tutorial_step_label: "intro"
      }
    ],
    [
      { source: "event_code", target: "event_name" },
      { source: "happened_at", target: "event_time" },
      { source: "player_id", target: "user_id" },
      { source: "tutorial_step_code", target: "step_id" },
      { source: "tutorial_step_label", target: "step_name" }
    ]
  );

  assert.equal(summary.diagnostics?.moduleChecks.onboarding.canAnalyze, true);
  assert.ok(
    !summary.diagnostics?.issues.some(
      (issue) =>
        issue.module === "onboarding" &&
        issue.code === "missing_field" &&
        issue.target === "step_name"
    )
  );
  assert.ok(
    !summary.diagnostics?.issues.some(
      (issue) =>
        issue.module === "global" &&
        issue.code === "missing_field" &&
        issue.target === "event_time"
    )
  );
});

test("buildImportSummary emits invalid_value for illegal monetization values", () => {
  const summary = buildImportSummary(
    [
      {
        event_name: "iap_success",
        event_time: "2026-04-22 10:00:01",
        user_id: "u1",
        price: 0,
        reward_type: "starter_pack",
        trigger_scene: "shop"
      }
    ],
    [...mappings]
  );

  assert.ok(
    summary.diagnostics?.issues.some(
      (issue) =>
        issue.severity === "error" &&
        issue.code === "invalid_value" &&
        issue.module === "monetization" &&
        issue.target === "price"
    )
  );
});

test("buildImportSummary marks missing strict anchor events as SEVERE_GAP", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "tutorial_complete", event_time: "2026-04-22 10:00:01", user_id: "u1", step_id: "step_9", step_name: "finish" }
    ],
    [...mappings]
  );

  assert.equal(summary.diagnostics?.overallStatus, "SEVERE_GAP");
  assert.equal(summary.diagnostics?.moduleChecks.onboarding.status, "SEVERE_GAP");
  assert.ok(
    summary.diagnostics?.issues.some(
      (issue) =>
        issue.severity === "error" &&
        issue.code === "missing_event" &&
        issue.module === "onboarding" &&
        issue.target === "tutorial_step"
    )
  );
});

test("buildImportSummary treats incomplete ad chain as HIGH_RISK when core anchors are present", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "tutorial_step", event_time: "2026-04-22 10:00:01", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "tutorial_begin", event_time: "2026-04-22 10:00:02", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "tutorial_complete", event_time: "2026-04-22 10:00:03", user_id: "u1", step_id: "step_9", step_name: "finish" },
      { event_name: "level_start", event_time: "2026-04-22 10:00:04", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_complete", event_time: "2026-04-22 10:00:05", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_fail", event_time: "2026-04-22 10:00:06", user_id: "u1", level_id: "1", level_type: "normal", fail_reason: "timeout", result: "fail" },
      { event_name: "iap_order_create", event_time: "2026-04-22 10:00:07", user_id: "u1", price: 4.99, reward_type: "starter_pack", trigger_scene: "shop" },
      { event_name: "iap_success", event_time: "2026-04-22 10:00:08", user_id: "u1", price: 4.99, reward_type: "starter_pack", trigger_scene: "shop" },
      { event_name: "ad_impression", event_time: "2026-04-22 10:00:09", user_id: "u1", placement: "FreeBox1" }
    ],
    [...mappings]
  );

  assert.equal(summary.diagnostics?.overallStatus, "HIGH_RISK");
  assert.equal(summary.diagnostics?.moduleChecks.ads.status, "HIGH_RISK");
  assert.ok(
    summary.diagnostics?.issues.some(
      (issue) =>
        issue.severity === "warning" &&
        issue.code === "incomplete_chain" &&
        issue.module === "ads" &&
        issue.target === "ad_request"
    )
  );
});

test("buildImportSummary keeps ads HIGH_RISK when request is missing but chain otherwise completes", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "tutorial_begin", event_time: "2026-04-22 10:00:01", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "tutorial_step", event_time: "2026-04-22 10:00:02", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "tutorial_complete", event_time: "2026-04-22 10:00:03", user_id: "u1", step_id: "step_9", step_name: "finish" },
      { event_name: "level_start", event_time: "2026-04-22 10:00:04", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_complete", event_time: "2026-04-22 10:00:05", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_fail", event_time: "2026-04-22 10:00:06", user_id: "u1", level_id: "1", level_type: "normal", fail_reason: "timeout", result: "fail" },
      { event_name: "iap_order_create", event_time: "2026-04-22 10:00:07", user_id: "u1", price: 4.99, reward_type: "starter_pack", trigger_scene: "shop" },
      { event_name: "iap_success", event_time: "2026-04-22 10:00:08", user_id: "u1", price: 4.99, reward_type: "starter_pack", trigger_scene: "shop" },
      { event_name: "ad_impression", event_time: "2026-04-22 10:00:09", user_id: "u1", placement: "FreeBox1" },
      { event_name: "ad_click", event_time: "2026-04-22 10:00:10", user_id: "u1", placement: "FreeBox1" },
      { event_name: "ad_reward_claim", event_time: "2026-04-22 10:00:11", user_id: "u1", placement: "FreeBox1", reward_type: "coin" }
    ],
    [...mappings]
  );

  assert.equal(summary.diagnostics?.moduleChecks.ads.status, "HIGH_RISK");
  assert.equal(summary.diagnostics?.overallStatus, "HIGH_RISK");
});

test("buildImportSummary does not treat tutorial_level_start as level-field evidence", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "tutorial_level_start", event_time: "2026-04-22 10:00:01", user_id: "u1", step_id: "step_1", step_name: "intro" }
    ],
    [...mappings]
  );

  assert.ok(
    !summary.diagnostics?.issues.some(
      (issue) =>
        issue.module === "level" &&
        issue.code === "missing_field" &&
        issue.target === "level_id"
    )
  );
});

test("buildImportSummary derives moduleCoverage from analyzable modules instead of heuristics", () => {
  const summary = buildImportSummary(
    [
      {
        event_name: "custom_revenue_marker",
        event_time: "2026-04-22 10:00:01",
        user_id: "u1",
        price: 9.99
      }
    ],
    [...mappings]
  );

  assert.equal(summary.diagnostics?.moduleChecks.monetization.canAnalyze, false);
  assert.equal(summary.moduleCoverage, 0);
  assert.equal(summary.diagnostics?.moduleCoverage, 0);
});

test("buildImportSummary can report PASS for a healthy fully-covered batch", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "tutorial_begin", event_time: "2026-04-22 10:00:01", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "tutorial_step", event_time: "2026-04-22 10:00:02", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "tutorial_complete", event_time: "2026-04-22 10:00:03", user_id: "u1", step_id: "step_9", step_name: "finish" },
      { event_name: "level_start", event_time: "2026-04-22 10:00:04", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_complete", event_time: "2026-04-22 10:00:05", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_fail", event_time: "2026-04-22 10:00:06", user_id: "u1", level_id: "1", level_type: "normal", fail_reason: "timeout", result: "fail" },
      { event_name: "iap_order_create", event_time: "2026-04-22 10:00:07", user_id: "u1", price: 4.99, reward_type: "starter_pack", trigger_scene: "shop" },
      { event_name: "iap_success", event_time: "2026-04-22 10:00:08", user_id: "u1", price: 4.99, reward_type: "starter_pack", trigger_scene: "shop" },
      { event_name: "ad_request", event_time: "2026-04-22 10:00:09", user_id: "u1", placement: "FreeBox1" },
      { event_name: "ad_impression", event_time: "2026-04-22 10:00:10", user_id: "u1", placement: "FreeBox1" },
      { event_name: "ad_click", event_time: "2026-04-22 10:00:11", user_id: "u1", placement: "FreeBox1" },
      { event_name: "ad_reward_claim", event_time: "2026-04-22 10:00:12", user_id: "u1", placement: "FreeBox1", reward_type: "coin" }
    ],
    [...mappings]
  );

  assert.equal(summary.diagnostics?.moduleChecks.global.status, "PASS");
  assert.equal(summary.diagnostics?.overallStatus, "PASS");
  assert.equal(summary.diagnostics?.moduleChecks.economy.status, "MISSING");
  assert.ok(
    !summary.diagnostics?.issues.some(
      (issue) =>
        issue.module === "economy" &&
        issue.code === "missing_event"
    )
  );
});

test("buildImportSummary does not require price on non-transaction monetization rows", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "tutorial_begin", event_time: "2026-04-22 10:00:01", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "tutorial_step", event_time: "2026-04-22 10:00:02", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "tutorial_complete", event_time: "2026-04-22 10:00:03", user_id: "u1", step_id: "step_9", step_name: "finish" },
      { event_name: "level_start", event_time: "2026-04-22 10:00:04", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_complete", event_time: "2026-04-22 10:00:05", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_fail", event_time: "2026-04-22 10:00:06", user_id: "u1", level_id: "1", level_type: "normal", fail_reason: "timeout", result: "fail" },
      { event_name: "store_view", event_time: "2026-04-22 10:00:07", user_id: "u1", trigger_scene: "shop" },
      { event_name: "iap_success", event_time: "2026-04-22 10:00:08", user_id: "u1", price: 4.99, reward_type: "starter_pack", trigger_scene: "shop" },
      { event_name: "ad_impression", event_time: "2026-04-22 10:00:09", user_id: "u1", placement: "FreeBox1" },
      { event_name: "ad_click", event_time: "2026-04-22 10:00:10", user_id: "u1", placement: "FreeBox1" },
      { event_name: "ad_reward_claim", event_time: "2026-04-22 10:00:11", user_id: "u1", placement: "FreeBox1", reward_type: "coin" }
    ],
    [...mappings]
  );

  assert.notEqual(summary.diagnostics?.moduleChecks.monetization.status, "SEVERE_GAP");
  assert.ok(
    !summary.diagnostics?.issues.some(
      (issue) =>
        issue.module === "monetization" &&
        issue.code === "missing_field" &&
        issue.target === "price"
    )
  );
});

test("buildImportSummary uses property_hint mapped fields for monetization grouping", () => {
  const summary = buildImportSummary(
    [
      { event_code: "iap_order_create", happened_at: "2026-04-22 10:00:07", player_id: "u1", amount: 4.99, scene_hint: "shop", sku_hint: "starter_pack" },
      { event_code: "iap_success", happened_at: "2026-04-22 10:00:08", player_id: "u1", amount: 4.99, scene_hint: "shop", sku_hint: "starter_pack" }
    ],
    [
      { source: "event_code", target: "event_name" },
      { source: "happened_at", target: "event_time" },
      { source: "player_id", target: "user_id" },
      { source: "amount", target: "price" },
      { source: "scene_hint", target: "property_hint" },
      { source: "sku_hint", target: "property_hint" }
    ]
  );

  assert.ok(summary.giftPackDistribution.some((item) => item.name === "starter_pack"));
});

test("buildImportSummary keeps property_hint grouping stable when mapping order changes", () => {
  const summary = buildImportSummary(
    [
      { event_code: "iap_order_create", happened_at: "2026-04-22 10:00:07", player_id: "u1", amount: 4.99, scene_hint: "shop", sku_hint: "starter_pack" },
      { event_code: "iap_success", happened_at: "2026-04-22 10:00:08", player_id: "u1", amount: 4.99, scene_hint: "shop", sku_hint: "starter_pack" }
    ],
    [
      { source: "event_code", target: "event_name" },
      { source: "happened_at", target: "event_time" },
      { source: "player_id", target: "user_id" },
      { source: "amount", target: "price" },
      { source: "sku_hint", target: "property_hint" },
      { source: "scene_hint", target: "property_hint" }
    ]
  );

  assert.ok(summary.giftPackDistribution.some((item) => item.name === "starter_pack"));
});

test("buildImportSummary keeps narrow-scope batches at HIGH_RISK instead of SEVERE_GAP", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "tutorial_step", event_time: "2026-04-22 10:00:01", user_id: "u1", step_id: "step_1", step_name: "intro" }
    ],
    [...mappings]
  );

  assert.equal(summary.moduleCoverage, 25);
  assert.equal(summary.diagnostics?.overallStatus, "HIGH_RISK");
});

test("buildImportSummary treats browse-only monetization batches as HIGH_RISK", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "store_view", event_time: "2026-04-22 10:00:01", user_id: "u1", trigger_scene: "shop" }
    ],
    [...mappings]
  );

  assert.equal(summary.diagnostics?.moduleChecks.monetization.canAnalyze, true);
  assert.equal(summary.diagnostics?.moduleChecks.monetization.status, "HIGH_RISK");
  assert.notEqual(summary.diagnostics?.overallStatus, "SEVERE_GAP");
});

test("buildImportSummary ignores sentinel zero prices on browse-only monetization rows", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "store_view", event_time: "2026-04-22 10:00:01", user_id: "u1", trigger_scene: "shop", price: 0 }
    ],
    [...mappings]
  );

  assert.ok(
    !summary.diagnostics?.issues.some(
      (issue) =>
        issue.module === "monetization" &&
        issue.code === "invalid_value" &&
        issue.target === "price"
    )
  );
});

test("buildImportSummary does not keep overallStatus PASS when strict error issues exist", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "tutorial_begin", event_time: "2026-04-22 10:00:01", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "tutorial_step", event_time: "2026-04-22 10:00:02", user_id: "u1", step_id: "step_1", step_name: "intro" },
      { event_name: "tutorial_complete", event_time: "2026-04-22 10:00:03", user_id: "u1", step_id: "step_9", step_name: "finish" },
      { event_name: "level_start", event_time: "2026-04-22 10:00:04", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_complete", event_time: "2026-04-22 10:00:05", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_fail", event_time: "2026-04-22 10:00:06", user_id: "u1", level_id: "1", level_type: "normal", fail_reason: "timeout", result: "fail" },
      { event_name: "iap_order_create", event_time: "2026-04-22 10:00:07", user_id: "u1", price: 0, reward_type: "starter_pack", trigger_scene: "shop" },
      { event_name: "iap_success", event_time: "2026-04-22 10:00:08", user_id: "u1", price: 0, reward_type: "starter_pack", trigger_scene: "shop" },
      { event_name: "ad_request", event_time: "2026-04-22 10:00:09", user_id: "u1", placement: "FreeBox1" },
      { event_name: "ad_impression", event_time: "2026-04-22 10:00:10", user_id: "u1", placement: "FreeBox1" },
      { event_name: "ad_click", event_time: "2026-04-22 10:00:11", user_id: "u1", placement: "FreeBox1" },
      { event_name: "ad_reward_claim", event_time: "2026-04-22 10:00:12", user_id: "u1", placement: "FreeBox1", reward_type: "coin" }
    ],
    [...mappings]
  );

  assert.ok(
    summary.diagnostics?.issues.some(
      (issue) =>
        issue.module === "monetization" &&
        issue.code === "invalid_value" &&
        issue.severity === "error"
    )
  );
  assert.notEqual(summary.diagnostics?.overallStatus, "PASS");
});

test("buildImportSummary marks strict diagnostics as SEVERE_GAP when a key field is missing", () => {
  const summary = buildImportSummary(
    [
      { event_name: "session_start", event_time: "2026-04-22 10:00:00", user_id: "u1" },
      { event_name: "tutorial_step", event_time: "2026-04-22 10:00:01", user_id: "u1", step_name: "intro" },
      { event_name: "level_start", event_time: "2026-04-22 10:00:02", user_id: "u1", level_type: "normal" }
    ],
    [...mappings]
  );

  assert.equal(summary.diagnostics?.overallStatus, "SEVERE_GAP");
  assert.equal(summary.diagnostics?.moduleChecks.onboarding.status, "SEVERE_GAP");
  assert.ok(
    summary.diagnostics?.issues.some(
      (issue) =>
        issue.severity === "error" &&
        issue.code === "missing_field" &&
        issue.module === "onboarding" &&
        issue.target === "step_id"
    )
  );
});

test("buildImportSummary returns module payloads for onboarding, level, monetization, and ads", () => {
  const summary = buildImportSummary(
    [
      { event_name: "tutorial_step", user_id: "u1", step_id: "1", step_name: "show_tip", duration_sec: 4 },
      { event_name: "tutorial_step_complete", user_id: "u1", step_id: "1", step_name: "show_tip", result: "success", duration_sec: 4 },
      { event_name: "tutorial_step", user_id: "u1", step_id: "2", step_name: "claim_drill", duration_sec: 8 },
      { event_name: "tutorial_step", user_id: "u2", step_id: "1", step_name: "show_tip", duration_sec: 5 },
      { event_name: "tutorial_step_complete", user_id: "u2", step_id: "1", step_name: "show_tip", result: "success", duration_sec: 5 },
      { event_name: "tutorial_step", user_id: "u3", step_id: "1", step_name: "show_tip", duration_sec: 6 },
      { event_name: "level_start", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_fail", user_id: "u1", level_id: "1", level_type: "normal", result: "fail", fail_reason: "timeout" },
      { event_name: "retry", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_start", user_id: "u1", level_id: "1", level_type: "normal" },
      { event_name: "level_complete", user_id: "u1", level_id: "1", level_type: "normal", result: "success" },
      { event_name: "camera_rotate", user_id: "u1", level_id: "1", duration_sec: 1.2 },
      { event_name: "screw_interact", user_id: "u1", level_id: "1", duration_sec: 0.8 },
      { event_name: "af_initiated_checkout", user_id: "u1", trigger_scene: "shop", content_id: "scr001" },
      { event_name: "af_purchase", user_id: "u1", price: 12.99, reward_type: "starter_pack", trigger_scene: "shop", content_id: "scr001" },
      { event_name: "af_ad_view", user_id: "u1", placement: "FreeBox1" },
      { event_name: "af_ad_click", user_id: "u1", placement: "FreeBox1" },
      { event_name: "ad_reward_claim", user_id: "u1", placement: "FreeBox1", reward_type: "coin" }
    ],
    [...mappings]
  );

  assert.ok(summary.onboardingFunnel?.length);
  assert.ok(summary.levelFunnel?.length);
  assert.ok(summary.monetizationStoreFunnel?.length);
  assert.ok(summary.monetizationPaymentFunnel?.length);
  assert.ok(summary.adPlacementBreakdown?.length);
  assert.ok(summary.adPlacementFlow?.length);

  const packRow = summary.giftPackDistribution?.find((item) => item.name === "starter_pack");
  const adPlacement = summary.adPlacementBreakdown?.find((item) => item.placement === "FreeBox1");

  assert.equal(summary.onboardingFunnel?.[0]?.stepId, "1");
  assert.equal(summary.onboardingFunnel?.[0]?.dropoffCount, 4);
  assert.equal(summary.levelFunnel?.[0]?.retries, 1);
  assert.equal(summary.levelFailReasonDistribution?.[0]?.name, "timeout");
  assert.equal(typeof summary.technicalSuccessRate, "number");
  assert.equal(summary.technicalErrorCount, 0);
  assert.equal(summary.businessFailureCount, 1);
  assert.equal(typeof summary.businessFailureCount, "number");
  assert.equal(typeof summary.moduleCoverage, "number");
  assert.ok(Array.isArray(summary.topEvents));
  assert.ok((summary.monetizationStoreFunnel?.[0]?.count ?? 0) >= 1);
  assert.equal(summary.monetizationPaymentFunnel?.at(-1)?.count, 1);
  assert.equal(packRow?.name, "starter_pack");
  assert.equal(adPlacement?.placement, "FreeBox1");
  assert.equal(adPlacement?.requests, 1);
  assert.equal(adPlacement?.plays, 1);
  assert.equal(adPlacement?.clicks, 1);
});

test("detectAndParseRawTelemetryCsv expands raw AppsFlyer payloads and normalizes comma decimals", () => {
  const fillerHeaders = Array.from({ length: 38 }, (_, index) => `filler_${index + 1}`);
  const headerRow = [
    "event_name",
    "event_time",
    "customer_user_id",
    ...fillerHeaders,
    "event_value",
    "custom_data",
    "event_revenue"
  ]
    .map((value) => `"${value.replace(/"/g, '""')}"`)
    .join(";");
  const dataRow = [
    "af_purchase",
    "2026-04-22 10:00:00",
    "u1",
    ...fillerHeaders.map(() => ""),
    '{"af_revenue":"12,99"}',
    '{"reward_id":"starter_pack","item_name":"starter_pack","trigger_scene":"shop","screw_color":"blue","current_slots":"1,331771"}',
    "12,99"
  ]
    .map((value) => `"${value.replace(/"/g, '""')}"`)
    .join(";");

  const parsed = detectAndParseRawTelemetryCsv([headerRow, dataRow].join("\n"));
  if (!parsed) {
    throw new Error("expected raw AppsFlyer CSV to be detected");
  }

  assert.equal(parsed.notice, "已识别为分号分隔的原始日志导出，并自动展开 event_value/custom_data。当前映射的是清洗后的业务字段。");
  assert.deepEqual(parsed.headers.slice(0, 8), [
    "event_name",
    "event_time",
    "user_id",
    "platform",
    "app_version",
    "country_code",
    "level_id",
    "level_type"
  ]);
  assert.deepEqual(parsed.rows[0], {
    event_name: "af_purchase",
    event_time: "2026-04-22 10:00:00",
    user_id: "u1",
    platform: "",
    app_version: "",
    country_code: "",
    level_id: "",
    level_type: "",
    step_id: "",
    step_name: "",
    result: "success",
    fail_reason: "",
    duration_sec: null,
    placement: "",
    price: 12.99,
    reward_type: "starter_pack",
    activity_id: "",
    activity_type: "",
    reward_id: "starter_pack",
    item_name: "starter_pack",
    gain_source: "",
    gain_amount: null,
    resource_type: "",
    current_slots: 1.331771,
    screw_color: "blue",
    trigger_scene: "shop"
  });
});
