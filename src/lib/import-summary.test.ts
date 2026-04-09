import assert from "node:assert/strict";
import test from "node:test";

import { buildImportSummary } from "./import-summary";

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
  assert.ok((summary.monetizationStoreFunnel?.[0]?.count ?? 0) >= 1);
  assert.equal(summary.monetizationPaymentFunnel?.at(-1)?.count, 1);
  assert.equal(packRow?.name, "starter_pack");
  assert.equal(adPlacement?.placement, "FreeBox1");
  assert.equal(adPlacement?.requests, 1);
  assert.equal(adPlacement?.plays, 1);
  assert.equal(adPlacement?.clicks, 1);
});
