# Homepage Import Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage "上传日志" CTA navigate to the existing `/imports` page.

**Architecture:** Reuse the existing App Router navigation pattern already present in the homepage by replacing the inert button with a `Link`. Keep styling and copy unchanged so the change is low-risk and limited to a single server component.

**Tech Stack:** Next.js App Router, React, TypeScript

---

### Task 1: Connect the homepage CTA to the imports page

**Files:**
- Modify: `src/app/page.tsx`
- Verify: `npm run lint`

- [ ] **Step 1: Replace the inert button with a navigation link**

```tsx
<div className="header-actions">
  <Link href="/imports" className="button-primary">
    上传日志
  </Link>
</div>
```

- [ ] **Step 2: Keep the rest of the header unchanged**

Ensure the surrounding `PageHeader` structure remains:

```tsx
<PageHeader
  title="项目总览"
  copy="围绕事件分类查看当前版本的数据健康度、导入状态和 AI 洞察，帮助策划、数据和研发在同一视图里对齐问题。"
  actions={
    <div className="header-actions">
      <Link href="/imports" className="button-primary">
        上传日志
      </Link>
    </div>
  }
/>
```

- [ ] **Step 3: Run lint verification**

Run: `npm run lint`
Expected: `eslint .` completes without errors

- [ ] **Step 4: Confirm the user-visible behavior**

Inspect `src/app/page.tsx` and confirm the homepage CTA now routes to `/imports` while preserving the `button-primary` styling.
