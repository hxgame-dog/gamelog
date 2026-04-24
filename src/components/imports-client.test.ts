import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("imports client is organized around status, cleaned preview, strict diagnostics, and follow-up actions", () => {
  const source = readFileSync(path.resolve(process.cwd(), "src/components/imports-client.tsx"), "utf8");

  assert.match(source, /导入总状态/);
  assert.match(source, /清洗结果预览/);
  assert.match(source, /严格诊断结果/);
  assert.match(source, /后续动作/);
  assert.match(source, /displaySummary\.cleaning/);
  assert.match(source, /displaySummary\.diagnostics/);
  assert.match(source, /moduleChecks/);
  assert.match(source, /issues/);
  assert.match(source, /buildOperationsHref\("ads"\)/);
  assert.match(source, /buildOperationsHref\("monetization"\)/);
  assert.match(source, /deleteImportBatch/);
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /删除导入批次/);
});
