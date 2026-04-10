# Operations Analytics Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `/analytics` experience with a true operations analysis workspace: a new overview page plus four module-specific analytics pages driven by import batches and technical-vs-business quality signals.

**Architecture:** Keep the existing `/analytics` route family and import/version context plumbing, but stop rendering pages from the old generic chart-first template. Introduce a dedicated operations analytics overview at `/analytics`, then rebuild `onboarding`, `level`, `monetization`, and `ads` pages around module-specific page sections, using existing analytics aggregation as input and tightening the page contracts where needed.

**Tech Stack:** Next.js App Router, React Server Components + small client helpers, TypeScript, CSS modules, Prisma-backed import summaries, existing analytics batch/version context.

---

## File Map

### New files
- Create: `src/app/analytics/page.tsx`
- Create: `src/components/operations-overview-client.tsx`

### Modify
- Modify: `src/components/app-shell.tsx`
- Modify: `src/app/analytics/[category]/page.tsx`
- Modify: `src/components/analytics-page.module.css`
- Modify: `src/components/ui.tsx`
- Modify: `src/lib/server/analytics.ts`
- Modify: `src/components/imports-client.tsx`
- Modify: `src/app/page.tsx`

### Tests
- Modify: `src/lib/import-summary.test.ts`

---

### Task 1: Add the operations analytics overview page

**Files:**
- Create: `src/app/analytics/page.tsx`
- Create: `src/components/operations-overview-client.tsx`
- Modify: `src/lib/server/analytics.ts`
- Modify: `src/components/app-shell.tsx`

- [ ] **Step 1: Add the failing data contract test for overview payload**

Add a new server-side assertion block to `src/lib/import-summary.test.ts` that checks the import summary already exposes enough information to power an overview card model:

```ts
import assert from "node:assert/strict";

assert.equal(typeof summary.technicalSuccessRate, "number");
assert.equal(typeof summary.businessFailureCount, "number");
assert.equal(typeof summary.moduleCoverage, "number");
assert.ok(Array.isArray(summary.topEvents));
```

- [ ] **Step 2: Run the test file to confirm current coverage**

Run:

```bash
npx tsx --test src/lib/import-summary.test.ts
```

Expected:
- PASS, confirming import summary already has the baseline fields needed.

- [ ] **Step 3: Add a new analytics server helper for overview page data**

In `src/lib/server/analytics.ts`, add a new exported function:

```ts
export async function getOperationsOverviewData(
  projectId?: string | null,
  compareVersion?: string | null,
  currentImportId?: string | null
) {
  // resolve current import
  // resolve compare import
  // build module cards for onboarding / level / monetization / ads
  // build anomaly shortcuts
  // return overview payload
}
```

The returned shape must include:

```ts
{
  projectId: string | null;
  sourceLabel: string;
  versionLabel: string;
  compareVersionLabel: string | null;
  currentImportId: string | null;
  technicalSuccessRate: number;
  technicalErrorCount: number;
  businessFailureCount: number;
  moduleCoverage: number;
  hasInference: boolean;
  moduleCards: Array<{
    key: "onboarding" | "level" | "monetization" | "ads";
    label: string;
    summary: string;
    primaryMetric: string;
    anomaly: string;
    href: string;
  }>;
  anomalyShortcuts: Array<{
    label: string;
    href: string;
  }>;
  importOptions: Array<{ id: string; label: string; source?: string | null }>;
  versionOptions: string[];
}
```

- [ ] **Step 4: Add the new overview page**

Create `src/app/analytics/page.tsx` as a real top-level overview page:

```tsx
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { getProjectsForUser } from "@/lib/server/projects";
import { getOperationsOverviewData } from "@/lib/server/analytics";
import { OperationsOverviewClient } from "@/components/operations-overview-client";

export default async function AnalyticsOverviewPage({
  searchParams
}: {
  searchParams: Promise<{ projectId?: string; compareVersion?: string; importId?: string }>;
}) {
  const user = await requireUser();
  const projects = await getProjectsForUser(user.id);
  const { projectId, compareVersion, importId } = await searchParams;
  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const overview = await getOperationsOverviewData(activeProjectId, compareVersion, importId);

  return (
    <AppShell currentPath="/analytics">
      <PageHeader
        title="运营分析"
        copy="从当前导入批次的数据质量出发，快速定位最值得优先查看的业务模块与异常问题。"
      />
      <OperationsOverviewClient overview={overview} />
    </AppShell>
  );
}
```

- [ ] **Step 5: Build the overview client**

Create `src/components/operations-overview-client.tsx` to render:
- quality summary cards
- trust/inference banner
- four module entry cards
- anomaly shortcut links

Use a focused layout instead of reusing the existing analytics detail page structure.

- [ ] **Step 6: Keep the left nav pointing to `/analytics`**

In `src/components/app-shell.tsx`, ensure the `运营分析` item still points to `/analytics`, not a category sub-route.

- [ ] **Step 7: Run lint and typecheck**

Run:

```bash
npm run lint
npx tsc --noEmit
```

Expected:
- PASS with no new lint or type errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/analytics/page.tsx src/components/operations-overview-client.tsx src/lib/server/analytics.ts src/components/app-shell.tsx src/lib/import-summary.test.ts
git commit -m "feat: add operations analytics overview"
```

---

### Task 2: Rebuild the onboarding page as a dedicated funnel analysis page

**Files:**
- Modify: `src/app/analytics/[category]/page.tsx`
- Modify: `src/components/analytics-page.module.css`
- Modify: `src/lib/server/analytics.ts`
- Modify: `src/components/ui.tsx`

- [ ] **Step 1: Write a narrow rendering assertion for onboarding payload usage**

Document the expected onboarding page sections in a snapshot-style comment test block or local assertion in development notes:

```ts
const onboardingSections = [
  "数据质量卡",
  "关键结论卡",
  "最大流失步骤信号",
  "步骤漏斗图",
  "步骤完成率曲线",
  "步骤耗时排行",
  "步骤明细表"
];
```

Use this as the checklist for implementation.

- [ ] **Step 2: Add onboarding-specific section composition**

In `src/app/analytics/[category]/page.tsx`, replace the current onboarding body with a dedicated sequence:

```tsx
{category === "onboarding" ? (
  <>
    <section>{/* 数据质量卡 */}</section>
    <section>{/* 关键结论卡 */}</section>
    <section>{/* 最大流失步骤信号 */}</section>
    <section>{/* 漏斗主图 */}</section>
    <section>{/* 趋势 + 耗时排行 */}</section>
    <section>{/* 步骤明细表 */}</section>
  </>
) : null}
```

Do not share the generic chart ordering with other modules.

- [ ] **Step 3: Keep the onboarding main visual fully custom**

Continue using `OnboardingFunnelCard` and `OnboardingTrendCard`, but ensure the main/fallback path is always:

```ts
const onboardingRows = deriveOnboardingFunnel(summary.onboardingFunnel ?? summary.onboardingStepTrend ?? summary.onboardingSteps ?? []);
```

This prevents the page from dropping back to an empty generic chart.

- [ ] **Step 4: Add onboarding-only CSS sections**

In `src/components/analytics-page.module.css`, add dedicated classes such as:

```css
.moduleSection {}
.moduleHeader {}
.moduleGrid {}
.signalGrid {}
.signalCard {}
.detailTable {}
```

Only reuse generic classes where they still read well for onboarding.

- [ ] **Step 5: Run lint and typecheck**

Run:

```bash
npm run lint
npx tsc --noEmit
```

Expected:
- PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/analytics/[category]/page.tsx src/components/analytics-page.module.css src/lib/server/analytics.ts src/components/ui.tsx
git commit -m "feat: rebuild onboarding operations analysis page"
```

---

### Task 3: Rebuild the level page as level + microflow analysis

**Files:**
- Modify: `src/app/analytics/[category]/page.tsx`
- Modify: `src/components/analytics-page.module.css`
- Modify: `src/lib/server/analytics.ts`

- [ ] **Step 1: Define the level-page checklist**

Use this implementation checklist in code comments or task notes:

```ts
const levelSections = [
  "数据质量卡",
  "关键结论卡",
  "失败最集中关卡",
  "重试最高关卡",
  "行为占比异常关卡",
  "关卡漏斗主图",
  "失败原因分布",
  "重试排行",
  "局内微观心流",
  "关卡明细表",
  "心流明细表"
];
```

- [ ] **Step 2: Replace the current level body with a dedicated level-first layout**

The level page should render in this order:

```tsx
{category === "level" ? (
  <>
    <section>{/* 数据质量卡 */}</section>
    <section>{/* 指标卡 */}</section>
    <section>{/* 失败/重试/行为异常信号 */}</section>
    <section>{/* 关卡主图 */}</section>
    <section>{/* 失败原因 + 重试排行 */}</section>
    <section>{/* 局内微观心流 */}</section>
    <section>{/* 明细表 */}</section>
  </>
) : null}
```

- [ ] **Step 3: Ensure microflow stays on the same page, not as a side widget**

Keep `microflowByLevel` as a dedicated lower section with its own heading and explanation instead of treating it as a small side panel.

- [ ] **Step 4: Tighten module diagnostics**

In `src/lib/server/analytics.ts`, make sure level diagnostics are computed from:

```ts
const levelWorst = levelFunnel.sort((a, b) => b.failRate - a.failRate)[0];
const levelRetryHot = levelRetryRanking.sort((a, b) => b.retryRate - a.retryRate)[0];
const microflowHot = microflowByLevel.flatMap(...).sort((a, b) => b.ratio - a.ratio)[0];
```

These are already partially present; ensure the page uses them as first-class signals.

- [ ] **Step 5: Run lint and typecheck**

Run:

```bash
npm run lint
npx tsc --noEmit
```

Expected:
- PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/analytics/[category]/page.tsx src/components/analytics-page.module.css src/lib/server/analytics.ts
git commit -m "feat: rebuild level operations analysis page"
```

---

### Task 4: Rebuild monetization and ads as dedicated business dashboards

**Files:**
- Modify: `src/app/analytics/[category]/page.tsx`
- Modify: `src/components/analytics-page.module.css`
- Modify: `src/lib/server/analytics.ts`
- Modify: `src/components/ui.tsx`

- [ ] **Step 1: Define the monetization and ads page checklists**

```ts
const monetizationSections = [
  "数据质量卡",
  "关键结论卡",
  "最大转化损耗点",
  "最佳礼包/计费点",
  "统计口径提示",
  "双漏斗主图",
  "计费点/礼包分布",
  "商业化明细表"
];

const adsSections = [
  "数据质量卡",
  "关键结论卡",
  "最弱广告位",
  "流量最大广告位",
  "统计口径提示",
  "广告位流转主图",
  "广告位排行",
  "广告位构成",
  "广告明细表"
];
```

- [ ] **Step 2: Rebuild monetization page composition**

Use `MonetizationDualFunnelCard` as the main visual, but surround it with monetization-specific sections rather than the generic chart block order.

- [ ] **Step 3: Rebuild ads page composition**

Use `AdPlacementFlowCard` as the main visual, and explicitly surface inference messaging for request/play ambiguity.

- [ ] **Step 4: Keep module-specific signal cards at the top of each business page**

Ensure monetization and ads pages lead with the signal cards before the big charts. Users should see:
- the biggest loss stage before reading the funnels
- the weakest placement before scanning the ad table

- [ ] **Step 5: Run lint and typecheck**

Run:

```bash
npm run lint
npx tsc --noEmit
```

Expected:
- PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/analytics/[category]/page.tsx src/components/analytics-page.module.css src/lib/server/analytics.ts src/components/ui.tsx
git commit -m "feat: rebuild monetization and ads operations pages"
```

---

### Task 5: Finalize the import-to-analytics loop and polish navigation

**Files:**
- Modify: `src/components/imports-client.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/analytics/[category]/page.tsx`
- Modify: `src/app/analytics/page.tsx`

- [ ] **Step 1: Ensure import page CTAs land in the new operations structure**

Update import-page CTA text and navigation so they reflect the new product language:

```tsx
<Link href={`/analytics/onboarding?...`}>进入新手引导运营分析</Link>
<Link href={`/analytics/level?...`}>进入关卡与局内行为分析</Link>
```

- [ ] **Step 2: Ensure homepage anomaly shortcuts land in the new module pages**

Update `src/app/page.tsx` so the anomaly-first shortcuts point to the rebuilt module pages and preserve:
- `projectId`
- `compareVersion`
- `importId`
- `detailFilter`

- [ ] **Step 3: Verify quality-card roundtrip**

The following user loop must work:
1. Open `/analytics/level?projectId=...&importId=...`
2. Click a quality card
3. Land on `/imports` with the same batch selected
4. Use import CTA to return to analytics

- [ ] **Step 4: Run the full verification set**

Run:

```bash
npm run lint
npx tsc --noEmit
npx tsx --test src/lib/import-summary.test.ts
```

Expected:
- all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/imports-client.tsx src/app/page.tsx src/app/analytics/[category]/page.tsx src/app/analytics/page.tsx
git commit -m "feat: complete operations analytics navigation loop"
```

---

## Self-Review

### Spec coverage
- New `/analytics` overview page: covered by Task 1
- Onboarding dedicated redesign: covered by Task 2
- Level + microflow redesign: covered by Task 3
- Monetization + ads redesign: covered by Task 4
- Import-to-analytics loop and navigation polish: covered by Task 5

### Placeholder scan
- No `TBD` / `TODO`
- Each task includes files, commands, and concrete intent

### Type consistency
- Uses existing `projectId`, `compareVersion`, `importId`, `detailFilter` query context consistently
- Uses the same module names as the approved spec

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-10-operations-analytics-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
