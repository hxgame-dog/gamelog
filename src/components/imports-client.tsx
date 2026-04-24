"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import * as XLSX from "xlsx";

import { buildImportSummary, type ImportSummary } from "@/lib/import-summary";
import { deriveImportStatusKey, getVisibleImportIssues, resolveImportWorkspaceState } from "@/lib/imports-workspace";
import { detectAndParseRawTelemetryCsv, type RawTelemetryCell, type RawTelemetryUpload } from "@/lib/raw-telemetry";

import styles from "./import-page.module.css";

type Project = {
  id: string;
  name: string;
  currentVersion?: string | null;
};

type Plan = {
  id: string;
  name: string;
  version: string;
};

type Mapping = {
  source: string;
  target: string;
};

type ImportPreview = {
  id: string;
  fileName: string;
  version: string;
  source?: "REAL" | "SYNTHETIC";
  uploadedAt?: string | Date;
  summaryJson?: ImportSummary | null;
};

const targetOptions = [
  { key: "ignore", label: "忽略该列" },
  { key: "event_name", label: "事件名" },
  { key: "event_time", label: "事件时间" },
  { key: "user_id", label: "用户 ID" },
  { key: "platform", label: "平台" },
  { key: "app_version", label: "应用版本" },
  { key: "country_code", label: "国家地区" },
  { key: "result", label: "结果状态" },
  { key: "fail_reason", label: "失败原因" },
  { key: "level_id", label: "关卡 ID" },
  { key: "level_type", label: "关卡类型" },
  { key: "duration_sec", label: "时长（秒）" },
  { key: "step_id", label: "步骤 ID" },
  { key: "step_name", label: "步骤名称" },
  { key: "placement", label: "广告位" },
  { key: "price", label: "金额" },
  { key: "reward_type", label: "奖励类型" },
  { key: "activity_id", label: "活动 ID" },
  { key: "activity_type", label: "活动类型" },
  { key: "gain_source", label: "产出来源" },
  { key: "gain_amount", label: "产出数量" },
  { key: "resource_type", label: "资源类型" },
  { key: "property_hint", label: "附加字段" }
] as const;

type ImportCell = RawTelemetryCell;

const importPayloadTargets = new Set([
  "event_name",
  "event_time",
  "user_id",
  "platform",
  "app_version",
  "country_code",
  "result",
  "fail_reason",
  "level_id",
  "level_type",
  "duration_sec",
  "step_id",
  "step_name",
  "placement",
  "price",
  "reward_type",
  "activity_id",
  "activity_type",
  "gain_source",
  "gain_amount",
  "resource_type"
]);

function suggestTarget(header: string) {
  const normalized = header.toLowerCase();
  if (
    [
      "reward_id",
      "item_name",
      "current_slots",
      "screw_color",
      "trigger_scene"
    ].includes(normalized)
  ) {
    return "property_hint";
  }
  if (normalized === "event_name") {
    return "event_name";
  }
  if (normalized === "event_time") {
    return "event_time";
  }
  if (normalized === "user_id") {
    return "user_id";
  }
  if (normalized === "platform") {
    return "platform";
  }
  if (normalized === "app_version") {
    return "app_version";
  }
  if (normalized === "country_code") {
    return "country_code";
  }
  if (normalized === "level_id") {
    return "level_id";
  }
  if (normalized === "level_type") {
    return "level_type";
  }
  if (normalized === "step_id") {
    return "step_id";
  }
  if (normalized === "step_name") {
    return "step_name";
  }
  if (normalized === "duration_sec") {
    return "duration_sec";
  }
  if (normalized === "activity_id") {
    return "activity_id";
  }
  if (normalized === "activity_type") {
    return "activity_type";
  }
  if (normalized === "gain_source") {
    return "gain_source";
  }
  if (normalized === "gain_amount") {
    return "gain_amount";
  }
  if (normalized === "resource_type") {
    return "resource_type";
  }
  if (normalized === "reward_type") {
    return "reward_type";
  }
  if (normalized.includes("event")) {
    return "event_name";
  }
  if (normalized.includes("user")) {
    return "user_id";
  }
  if (normalized.includes("result") || normalized.includes("status")) {
    return "result";
  }
  if (normalized.includes("reason") || normalized.includes("error")) {
    return "fail_reason";
  }
  if (normalized.includes("level")) {
    return "level_id";
  }
  if (normalized.includes("duration") || normalized.includes("time_spent") || normalized.includes("rotate_time")) {
    return "duration_sec";
  }
  if (normalized.includes("step")) {
    return "step_id";
  }
  if (normalized.includes("place") || normalized.includes("ad")) {
    return "placement";
  }
  if (normalized.includes("price") || normalized.includes("amount")) {
    return "price";
  }
  if (normalized.includes("reward")) {
    return "reward_type";
  }
  return "property_hint";
}

const strictModuleKeys = ["global", "onboarding", "level", "ads", "monetization"] as const;
const softModuleKeys = ["liveops", "economy", "social"] as const;

const moduleLabels: Record<(typeof strictModuleKeys)[number] | (typeof softModuleKeys)[number], string> = {
  global: "公共属性",
  onboarding: "新手引导",
  level: "关卡与局内行为",
  ads: "广告分析",
  monetization: "商业化",
  liveops: "运营活动",
  economy: "资源产销",
  social: "社交裂变"
};

const diagnosticStatusMeta = {
  PENDING: {
    label: "待诊断",
    className: styles.statusPending,
    copy: "当前批次只有基础摘要，严格诊断还没有生成，建议先完成一次新导入。"
  },
  PASS: {
    label: "通过",
    className: styles.statusPass,
    copy: "当前批次已经满足主要分析口径，可以直接进入运营分析。"
  },
  HIGH_RISK: {
    label: "高风险",
    className: styles.statusRisk,
    copy: "这批日志可以继续分析，但有关键缺口，结论需要带着风险理解。"
  },
  SEVERE_GAP: {
    label: "严重缺口",
    className: styles.statusSevere,
    copy: "至少有一个核心模块缺少关键事件或字段，建议先看诊断再看图。"
  },
  MISSING: {
    label: "缺失",
    className: styles.statusMissing,
    copy: "当前模块在这批日志中还没有形成可分析结构。"
  }
} as const;

const issueSeverityMeta = {
  error: { label: "错误", className: styles.issueError },
  warning: { label: "警告", className: styles.issueWarning },
  info: { label: "提示", className: styles.issueInfo }
} as const;

function describeModuleCheck(check: NonNullable<ImportSummary["diagnostics"]>["moduleChecks"][keyof NonNullable<ImportSummary["diagnostics"]>["moduleChecks"]]) {
  const segments = [`命中 ${check.matchedRows} 行`];
  if (check.missingEvents.length) {
    segments.push(`缺事件 ${check.missingEvents.length}`);
  }
  if (check.missingFields.length) {
    segments.push(`缺字段 ${check.missingFields.length}`);
  }
  segments.push(check.canAnalyze ? "可进入分析" : "建议先补日志");
  return segments.join(" / ");
}

function describeIssue(issue: NonNullable<ImportSummary["diagnostics"]>["issues"][number]) {
  return `${moduleLabels[issue.module]} · ${issue.target}`;
}

export function ImportsClient({
  projects,
  initialProjectId,
  initialImportId,
  plansByProject,
  latestImportsByProject,
  importsHistoryByProject
}: {
  projects: Project[];
  initialProjectId: string | null;
  initialImportId: string | null;
  plansByProject: Record<string, Plan[]>;
  latestImportsByProject: Record<string, ImportPreview | null>;
  importsHistoryByProject: Record<string, ImportPreview[]>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"real" | "synthetic">("real");
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId ?? projects[0]?.id ?? "");
  const [selectedPlanId, setSelectedPlanId] = useState(plansByProject[initialProjectId ?? projects[0]?.id ?? ""]?.[0]?.id ?? "");
  const [version, setVersion] = useState(
    projects.find((project) => project.id === (initialProjectId ?? projects[0]?.id))?.currentVersion ?? "1.0.8"
  );
  const [syntheticUserCount, setSyntheticUserCount] = useState("240");
  const [syntheticDays, setSyntheticDays] = useState("7");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Array<Record<string, string | number | boolean | null>>>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleaningNote, setCleaningNote] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [hasPendingLocalUpload, setHasPendingLocalUpload] = useState(false);
  const [latestImportId, setLatestImportId] = useState(
    latestImportsByProject[initialProjectId ?? projects[0]?.id ?? ""]?.id ?? null
  );
  const [localLatestImportsByProject, setLocalLatestImportsByProject] = useState(latestImportsByProject);
  const [localImportsHistoryByProject, setLocalImportsHistoryByProject] = useState(importsHistoryByProject);
  const [selectedHistoryImportId, setSelectedHistoryImportId] = useState(
    initialImportId ?? latestImportsByProject[initialProjectId ?? projects[0]?.id ?? ""]?.id ?? null
  );
  const [previewFilter, setPreviewFilter] = useState("");
  const [deletingImportId, setDeletingImportId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activePlans = plansByProject[selectedProjectId] ?? [];
  const selectedPlan = activePlans.find((plan) => plan.id === selectedPlanId) ?? null;
  const latestImport = localLatestImportsByProject[selectedProjectId] ?? null;
  const importHistory = localImportsHistoryByProject[selectedProjectId] ?? [];
  const selectedPersistedImport =
    importHistory.find((item) => item.id === selectedHistoryImportId) ?? latestImport ?? null;
  const { activeImport: selectedHistoryImport, displaySummary } = resolveImportWorkspaceState({
    summary,
    hasPendingLocalUpload,
    selectedHistoryImport: selectedPersistedImport,
    latestImport
  });
  const cleaning = displaySummary ? displaySummary.cleaning : null;
  const diagnostics = displaySummary ? displaySummary.diagnostics : null;
  const compareHistoryImport =
    importHistory.find((item) => item.id !== (selectedHistoryImport?.id ?? "")) ?? null;
  const compareSummary = compareHistoryImport?.summaryJson ?? null;
  const rowsToShow = displaySummary?.previewRows ?? [];
  const keyword = previewFilter.trim().toLowerCase();
  const previewRows = !keyword
    ? rowsToShow
    : rowsToShow.filter((row) =>
        Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(keyword))
      );
  const statusMeta = diagnosticStatusMeta[deriveImportStatusKey(displaySummary)];
  const strictModuleCards = diagnostics
    ? strictModuleKeys.map((key) => ({
        key,
        label: moduleLabels[key],
        check: diagnostics.moduleChecks[key],
        statusMeta: diagnosticStatusMeta[diagnostics.moduleChecks[key].status]
      }))
    : [];
  const missingSoftModules = diagnostics
    ? softModuleKeys.filter((key) => diagnostics.moduleChecks[key].status === "MISSING")
    : [];
  const visibleIssues = [...getVisibleImportIssues(displaySummary)].sort((left, right) => {
        const weight = { error: 0, warning: 1, info: 2 } as const;
        return weight[left.severity] - weight[right.severity];
      });

  function summaryDelta(current: number | undefined, compare: number | undefined, suffix = "") {
    if (current === undefined || compare === undefined) {
      return null;
    }
    const delta = current - compare;
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}${suffix}`;
  }

  function buildOperationsHref(targetCategory: "onboarding" | "level" | "ads" | "monetization") {
    const params = new URLSearchParams();

    if (selectedProjectId) {
      params.set("projectId", selectedProjectId);
    }
    if (selectedHistoryImport?.id) {
      params.set("importId", selectedHistoryImport.id);
    }

    const compareVersion = searchParams.get("compareVersion");
    if (compareVersion) {
      params.set("compareVersion", compareVersion);
    }

    const detailFilter = searchParams.get("detailFilter");
    if (detailFilter) {
      params.set("detailFilter", detailFilter);
    }

    const qs = params.toString();
    return `/analytics/${targetCategory}${qs ? `?${qs}` : ""}`;
  }

  async function handleFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    let parsed: RawTelemetryUpload = { rows: [], headers: [], notice: "" };

    if (extension === "json") {
      const text = await file.text();
      const parsedRows = JSON.parse(text) as Array<Record<string, ImportCell>>;
      parsed = {
        rows: parsedRows,
        headers: Object.keys(parsedRows[0] ?? {}),
        notice: ""
      };
    } else if (extension === "csv") {
      const text = await file.text();
      const rawTelemetry = detectAndParseRawTelemetryCsv(text);
      if (rawTelemetry) {
        parsed = rawTelemetry;
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as Array<Record<string, ImportCell>>;
        parsed = {
          rows: parsedRows,
          headers: Object.keys(parsedRows[0] ?? {}),
          notice: ""
        };
      }
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as Array<Record<string, ImportCell>>;
      parsed = {
        rows: parsedRows,
        headers: Object.keys(parsedRows[0] ?? {}),
        notice: ""
      };
    }

    setFileName(file.name);
    setRows(parsed.rows);
    setHeaders(parsed.headers);
    setMappings(parsed.headers.map((header) => ({ source: header, target: suggestTarget(header) })));
    setCleaningNote(parsed.notice ?? null);
    setSummary(null);
    setHasPendingLocalUpload(true);
    setSelectedHistoryImportId(latestImportId);
    setMessage(
      parsed.notice
        ? `已识别并清洗 ${parsed.rows.length} 行原始日志，下一步请确认清洗后字段映射。`
        : `已读取 ${parsed.rows.length} 行日志，下一步请确认字段映射。`
    );
    setError(null);
  }

  function mappedRows() {
    const activeMappings = mappings.filter((item) => item.target !== "ignore");
    return rows.map((row) => {
      const nextRow: Record<string, string | number | boolean | null> = {};
      activeMappings.forEach((mapping) => {
        if (mapping.target === "property_hint") {
          if (importPayloadTargets.has(mapping.source)) {
            const value = row[mapping.source] ?? null;
            if (value !== null && value !== "") {
              nextRow[mapping.source] = value;
            }
          }
          return;
        }
        if (!importPayloadTargets.has(mapping.target)) {
          return;
        }
        const value = row[mapping.source] ?? null;
        if (value !== null && value !== "") {
          nextRow[mapping.target] = value;
        }
      });
      return nextRow;
    }).filter((row) => Object.keys(row).length > 0);
  }

  async function readApiError(response: Response) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { error?: string };
      return data.error ?? "日志导入失败。";
    }

    const text = await response.text();
    if (response.status === 413) {
      return "导入请求体过大，系统已自动压缩本次上传字段。请刷新后重试；如果仍失败，请减少附加字段映射。";
    }
    return text.slice(0, 200) || "日志导入失败。";
  }

  async function runRealImport() {
    try {
      setError(null);
      setMessage(null);
      const compactRows = mappedRows();
      const activeMappings = mappings.filter(
        (mapping) =>
          mapping.target !== "ignore" &&
          (importPayloadTargets.has(mapping.target) || (mapping.target === "property_hint" && importPayloadTargets.has(mapping.source)))
      );

      const summary = buildImportSummary(compactRows, activeMappings);

      const response = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          trackingPlanId: selectedPlanId,
          version,
          fileName,
          rawHeaders: headers,
          summary,
          mappings: activeMappings
        })
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const data = (await response.json()) as { item: { id: string; summary: ImportSummary } };
      setSummary(data.item.summary);
      setHasPendingLocalUpload(false);
      setLatestImportId(data.item.id);
      setSelectedHistoryImportId(data.item.id);
      const persistedImport: ImportPreview = {
        id: data.item.id,
        fileName,
        version,
        source: "REAL",
        uploadedAt: new Date().toISOString(),
        summaryJson: data.item.summary
      };
      setLocalLatestImportsByProject((current) => ({
        ...current,
        [selectedProjectId]: persistedImport
      }));
      setLocalImportsHistoryByProject((current) => ({
        ...current,
        [selectedProjectId]: [
          persistedImport,
          ...(current[selectedProjectId] ?? []).filter((item) => item.id !== persistedImport.id)
        ]
      }));
      setMessage(`日志已导入，已基于 ${compactRows.length} 行清洗结果生成导入摘要并更新聚合指标。`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "日志导入失败。");
    }
  }

  async function runSyntheticImport() {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/plans/${selectedPlanId}/synthetic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        userCount: Number(syntheticUserCount),
        days: Number(syntheticDays)
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "模拟数据生成失败。");
      return;
    }
    setSummary(data.summary);
    setHasPendingLocalUpload(false);
    setLatestImportId(data.id ?? null);
    setSelectedHistoryImportId(data.id ?? null);
    if (data.id && data.summary) {
      const persistedImport: ImportPreview = {
        id: data.id,
        fileName: `模拟数据-${new Date().toLocaleDateString("zh-CN")}`,
        version,
        source: "SYNTHETIC",
        uploadedAt: new Date().toISOString(),
        summaryJson: data.summary
      };
      setLocalLatestImportsByProject((current) => ({
        ...current,
        [selectedProjectId]: persistedImport
      }));
      setLocalImportsHistoryByProject((current) => ({
        ...current,
        [selectedProjectId]: [
          persistedImport,
          ...(current[selectedProjectId] ?? []).filter((item) => item.id !== persistedImport.id)
        ]
      }));
    }
    setMessage(`已生成并导入模拟数据：${data.generatedUsers} 名玩家，覆盖 ${data.days} 天。`);
  }

  async function deleteImportBatch(importId: string, fileLabel: string) {
    if (!window.confirm(`确认删除导入批次「${fileLabel}」吗？删除后会同步清理该批次预览和对应版本聚合快照。`)) {
      return;
    }

    try {
      setDeletingImportId(importId);
      setError(null);
      setMessage(null);

      const response = await fetch(`/api/imports/${importId}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { item?: { nextImportId?: string | null }; error?: string };
      if (!response.ok) {
        setError(data.error ?? "删除导入批次失败。");
        return;
      }

      const currentHistory = localImportsHistoryByProject[selectedProjectId] ?? [];
      const nextHistory = currentHistory.filter((item) => item.id !== importId);
      const nextImport =
        nextHistory.find((item) => item.id === data.item?.nextImportId) ?? nextHistory[0] ?? null;

      setLocalImportsHistoryByProject((current) => ({
        ...current,
        [selectedProjectId]: nextHistory
      }));
      setLocalLatestImportsByProject((current) => ({
        ...current,
        [selectedProjectId]: nextImport
      }));

      if (importId === selectedHistoryImport?.id || importId === selectedHistoryImportId || importId === latestImportId) {
        setSelectedHistoryImportId(nextImport?.id ?? null);
        setLatestImportId(nextImport?.id ?? null);
        setSummary(null);
        setHasPendingLocalUpload(false);
        setPreviewFilter("");
      }

      setMessage(nextImport ? `已删除导入批次，当前切换到：${nextImport.fileName}` : "已删除导入批次，当前项目暂无导入数据。");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除导入批次失败。");
    } finally {
      setDeletingImportId(null);
    }
  }

  return (
    <div className={styles.layout}>
      <div style={{ display: "grid", gap: 16 }}>
        <section className={`panel ${styles.card}`}>
          <div className={styles.importControls}>
            <div className={styles.field}>
              <label className={styles.label}>项目</label>
              <select
                className={styles.input}
                value={selectedProjectId}
                onChange={(event) => {
                  const nextProjectId = event.target.value;
                  setSelectedProjectId(nextProjectId);
                  setSelectedPlanId(plansByProject[nextProjectId]?.[0]?.id ?? "");
                  setLatestImportId(localLatestImportsByProject[nextProjectId]?.id ?? null);
                  setSelectedHistoryImportId(localLatestImportsByProject[nextProjectId]?.id ?? null);
                  setSummary(null);
                  setHasPendingLocalUpload(false);
                  setPreviewFilter("");
                }}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>方案版本</label>
              <select
                className={styles.input}
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
              >
                {activePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} / {plan.version}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>日志版本</label>
              <input className={styles.input} value={version} onChange={(event) => setVersion(event.target.value)} />
            </div>
          </div>

          <div className={styles.modeSwitch}>
            <button
              className={mode === "real" ? "button-primary" : "button-secondary"}
              onClick={() => setMode("real")}
              type="button"
            >
              导入真实数据
            </button>
            <button
              className={mode === "synthetic" ? "button-primary" : "button-secondary"}
              onClick={() => setMode("synthetic")}
              type="button"
            >
              生成模拟数据
            </button>
          </div>

          {mode === "real" ? (
            <>
              <label className={styles.dropzone}>
                <input
                  className={styles.hiddenInput}
                  type="file"
                  accept=".csv,.xlsx,.json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleFile(file);
                    }
                  }}
                />
                <div>
                  拖拽 JSON / CSV / XLSX 到这里，或点击选择文件。
                  <br />
                  文件读取后会先进入字段映射，不会直接导入。
                </div>
              </label>
            </>
          ) : (
            <div className={styles.syntheticPanel}>
              <div className={styles.syntheticCopy}>
                基于当前选择的方案版本直接生成模拟日志，并自动写入导入批次与聚合指标，方便你立刻验证看板和 AI 报告。
              </div>
              <div className={styles.syntheticGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>方案版本</label>
                  <div className={styles.syntheticValue}>
                    {selectedPlan ? `${selectedPlan.name} / ${selectedPlan.version}` : "请先选择方案"}
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>模拟用户数</label>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    value={syntheticUserCount}
                    onChange={(event) => setSyntheticUserCount(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>覆盖天数</label>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    value={syntheticDays}
                    onChange={(event) => setSyntheticDays(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {message ? <div className={styles.message}>{message}</div> : null}
          {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
          {cleaningNote ? <div className={styles.message}>{cleaningNote}</div> : null}
        </section>

        {mode === "real" ? (
          <section className={`panel ${styles.card}`}>
            <h2 className="section-title" style={{ fontSize: 18 }}>
              字段映射与校验
            </h2>
            {headers.length ? (
              <div className={styles.mappingTable}>
                {mappings.map((mapping, index) => (
                  <div key={mapping.source} className={styles.mappingItem}>
                    <div className={styles.mappingSource}>{mapping.source}</div>
                    <select
                      className={styles.input}
                      value={mapping.target}
                      onChange={(event) =>
                        setMappings((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, target: event.target.value } : item
                          )
                        )
                      }
                    >
                      {targetOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>上传日志后，这里会显示字段映射表。</div>
            )}
          </section>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <section className={`panel ${styles.card}`}>
          <div className={styles.sectionHeading}>
            <div>
              <h2 className="section-title" style={{ fontSize: 18 }}>
                导入总状态
              </h2>
              <div className={styles.sectionCopy}>
                先确认这批日志的技术通过率、业务失败事件和可分析模块覆盖率，再决定是否继续进入运营分析。
              </div>
            </div>
            {displaySummary ? (
              <span className={`${styles.statusBadge} ${statusMeta.className}`}>{statusMeta.label}</span>
            ) : null}
          </div>

          {displaySummary ? (
            <>
              <div className={styles.statusHero}>
                <div>
                  <div className={styles.statusTitle}>当前批次{statusMeta.label}</div>
                  <div className={styles.statusCopy}>{statusMeta.copy}</div>
                </div>
                {selectedHistoryImport ? (
                  <div className={styles.selectedImportMeta}>
                    当前查看批次：{selectedHistoryImport.fileName} / v{selectedHistoryImport.version}
                    {selectedHistoryImport.source
                      ? ` / ${selectedHistoryImport.source === "SYNTHETIC" ? "模拟数据" : "真实数据"}`
                      : ""}
                  </div>
                ) : null}
              </div>

              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>技术通过率</div>
                  <div className={styles.summaryValue}>
                    {(displaySummary.technicalSuccessRate ?? displaySummary.successRate).toFixed(1)}%
                  </div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>技术异常</div>
                  <div className={styles.summaryValue}>
                    {displaySummary.technicalErrorCount ?? displaySummary.errorCount}
                  </div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>业务失败事件</div>
                  <div className={styles.summaryValue}>{displaySummary.businessFailureCount ?? 0}</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>模块覆盖率</div>
                  <div className={styles.summaryValue}>{(displaySummary.moduleCoverage ?? 0).toFixed(1)}%</div>
                </div>
              </div>

              {cleaning ? (
                <div className={styles.cleaningGrid}>
                  <div className={styles.cleaningItem}>
                    <div className={styles.summaryLabel}>来源类型</div>
                    <strong>{cleaning.sourceKind ?? "标准日志"}</strong>
                  </div>
                  <div className={styles.cleaningItem}>
                    <div className={styles.summaryLabel}>编码</div>
                    <strong>{cleaning.encoding ?? "自动识别"}</strong>
                  </div>
                  <div className={styles.cleaningItem}>
                    <div className={styles.summaryLabel}>分隔符</div>
                    <strong>{cleaning.delimiter ?? "自动识别"}</strong>
                  </div>
                  <div className={styles.cleaningItem}>
                    <div className={styles.summaryLabel}>已展开字段</div>
                    <strong>{cleaning.expandedFields?.length ? cleaning.expandedFields.join(" / ") : "无"}</strong>
                  </div>
                </div>
              ) : null}

              {compareSummary ? (
                <div className={styles.compareStrip}>
                  <span>对比批次：{compareHistoryImport?.fileName} / v{compareHistoryImport?.version}</span>
                  <span>
                    技术通过率{" "}
                    {summaryDelta(
                      displaySummary.technicalSuccessRate ?? displaySummary.successRate,
                      compareSummary.technicalSuccessRate ?? compareSummary.successRate,
                      "%"
                    )}
                  </span>
                  <span>
                    技术异常{" "}
                    {summaryDelta(
                      displaySummary.technicalErrorCount ?? displaySummary.errorCount,
                      compareSummary.technicalErrorCount ?? compareSummary.errorCount
                    )}
                  </span>
                  <span>
                    业务失败{" "}
                    {summaryDelta(
                      displaySummary.businessFailureCount ?? 0,
                      compareSummary.businessFailureCount ?? 0
                    )}
                  </span>
                  <span>记录数 {summaryDelta(displaySummary.recordCount, compareSummary.recordCount)}</span>
                </div>
              ) : null}
            </>
          ) : (
            <div className={styles.emptyState}>
              先上传日志并完成字段映射。导入完成后，这里会显示总状态、清洗元信息和可分析模块覆盖率。
            </div>
          )}

          <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {mode === "real" ? (
              <button
                className="button-primary"
                disabled={isPending || !rows.length || !selectedProjectId || !selectedPlanId}
                onClick={() =>
                  startTransition(async () => {
                    await runRealImport();
                  })
                }
              >
                {isPending ? "正在导入..." : "确认映射并导入"}
              </button>
            ) : (
              <button
                className="button-primary"
                disabled={isPending || !selectedProjectId || !selectedPlanId}
                onClick={() =>
                  startTransition(async () => {
                    await runSyntheticImport();
                  })
                }
              >
                {isPending ? "正在生成..." : "生成并导入模拟数据"}
              </button>
            )}
          </div>
        </section>

        <section className={`panel ${styles.card}`}>
          <div className={styles.previewTop}>
            <div>
              <h2 className="section-title" style={{ fontSize: 18 }}>
                清洗结果预览
              </h2>
              <div className={styles.sectionCopy}>
                这里展示的是导入后保存下来的标准化字段，方便直接核对原始日志是否被清洗成预期结构。
              </div>
            </div>
            {mode === "real" ? (
              <input
                className={styles.previewFilter}
                placeholder="按事件名 / 步骤 / 关卡筛选"
                value={previewFilter}
                onChange={(event) => setPreviewFilter(event.target.value)}
              />
            ) : null}
          </div>
          {mode === "real" ? (
            previewRows.length ? (
              <div className={styles.previewWrap}>
                <div className={styles.previewHeader}>
                  {Object.keys(previewRows[0] ?? {}).map((header) => (
                    <div key={header}>{header}</div>
                  ))}
                </div>
                {previewRows.map((row, index) => (
                  <div key={`${fileName || latestImport?.fileName || "import"}-${index}`} className={styles.previewRow}>
                    {Object.keys(previewRows[0] ?? {}).map((header) => (
                      <div key={header}>{String(row[header] ?? "")}</div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                {rows.length
                  ? "当前文件已上传，但还没有完成导入。导入完成后，这里会显示保存下来的清洗后标准字段预览。"
                  : "导入完成后，这里会保存并展示当前批次的清洗后数据预览。"}
              </div>
            )
          ) : (
            <div className={styles.emptyState}>
              当前入口会基于已确认的方案结构生成事件日志，并沿用与真实日志相同的摘要与诊断规则。
            </div>
          )}
        </section>

        <section id="import-diagnostics" className={`panel ${styles.card}`}>
          <div className={styles.sectionHeading}>
            <div>
              <h2 className="section-title" style={{ fontSize: 18 }}>
                严格诊断结果
              </h2>
              <div className={styles.sectionCopy}>
                公共属性、新手引导、关卡与局内行为、广告分析、商业化会严格校验；其余模块只做缺失提示。
              </div>
            </div>
          </div>

          {diagnostics ? (
            <>
              <div className={styles.moduleGrid}>
                {strictModuleCards.map((item) => (
                  <div key={item.key} className={styles.moduleCard}>
                    <div className={styles.moduleHeader}>
                      <strong>{item.label}</strong>
                      <span className={`${styles.statusBadge} ${item.statusMeta.className}`}>
                        {item.statusMeta.label}
                      </span>
                    </div>
                    <div className={styles.moduleMeta}>{describeModuleCheck(item.check)}</div>
                  </div>
                ))}
              </div>

              {missingSoftModules.length ? (
                <div className={styles.softNotice}>
                  其他模块暂未命中：{missingSoftModules.map((key) => moduleLabels[key]).join(" / ")}。这不会阻断导入，但会提示后续补日志。
                </div>
              ) : null}

              <div className={styles.issueList}>
                {visibleIssues.length ? (
                  visibleIssues.map((issue, index) => {
                    const severityMeta = issueSeverityMeta[issue.severity];
                    return (
                      <div key={`${issue.code}-${issue.target}-${index}`} className={styles.issueItem}>
                        <div className={`${styles.issueSeverity} ${severityMeta.className}`}>
                          {severityMeta.label}
                        </div>
                        <div className={styles.issueBody}>
                          <div className={styles.issueTarget}>{describeIssue(issue)}</div>
                          <div>{issue.message}</div>
                          <div className={styles.issueSuggestion}>{issue.suggestion}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>当前批次没有新的严格诊断问题，可以继续进入运营分析。</div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              导入完成后，这里会按模块显示严格诊断结果，并告诉你哪些缺口会影响后续可视化分析。
            </div>
          )}
        </section>

        <section className={`panel ${styles.card}`}>
          <div className={styles.sectionHeading}>
            <div>
              <h2 className="section-title" style={{ fontSize: 18 }}>
                后续动作
              </h2>
              <div className={styles.sectionCopy}>
                导入完成后可以先看完整预览和诊断，再按模块进入运营分析，不会因为单个风险直接卡死流程。
              </div>
            </div>
          </div>

          <div className={styles.actionGrid}>
            {selectedHistoryImport?.id ? (
              <Link className={styles.actionCard} href={`/api/imports/${selectedHistoryImport.id}/preview`} target="_blank">
                <strong>查看导入预览</strong>
                <span>打开当前批次的预览接口，直接查看保存下来的清洗结果。</span>
              </Link>
            ) : null}
            <a className={styles.actionCard} href="#import-diagnostics">
              <strong>查看完整诊断</strong>
              <span>回到严格诊断区，优先处理缺事件、缺字段和值异常的问题。</span>
            </a>
            <Link className={styles.actionCard} href={buildOperationsHref("onboarding")}>
              <strong>进入新手引导分析</strong>
              <span>查看步骤漏斗、最大流失步骤和步骤耗时排行。</span>
            </Link>
            <Link className={styles.actionCard} href={buildOperationsHref("level")}>
              <strong>进入关卡与局内行为分析</strong>
              <span>查看关卡漏斗、失败原因、重试热点和局内行为占比。</span>
            </Link>
            <Link className={styles.actionCard} href={buildOperationsHref("ads")}>
              <strong>进入广告分析</strong>
              <span>查看广告位曝光、点击、发奖链路和广告位构成。</span>
            </Link>
            <Link className={styles.actionCard} href={buildOperationsHref("monetization")}>
              <strong>进入商业化分析</strong>
              <span>查看付费链路、礼包分布和关键转化损耗点。</span>
            </Link>
          </div>
        </section>

        <section className={`panel ${styles.card}`}>
          <div className={styles.previewTop}>
            <h2 className="section-title" style={{ fontSize: 18 }}>
              导入批次历史
            </h2>
            <span className="pill">共 {importHistory.length} 批</span>
          </div>
          {importHistory.length ? (
            <div className={styles.historyList}>
              {importHistory.slice(0, 8).map((item) => {
                const itemSummary = item.summaryJson;
                const active = item.id === (selectedHistoryImport?.id ?? latestImportId);
                return (
                  <article
                    key={item.id}
                    className={`${styles.historyItem} ${active ? styles.historyItemActive : ""}`}
                  >
                    <div className={styles.historyHeader}>
                      <button
                        type="button"
                        className={styles.historySelectButton}
                        onClick={() => {
                          setSelectedHistoryImportId(item.id);
                          setSummary(null);
                          setHasPendingLocalUpload(false);
                          setPreviewFilter("");
                          setMessage(`已切换到导入批次：${item.fileName}`);
                          setError(null);
                        }}
                      >
                        <strong>{item.fileName}</strong>
                        <span className="pill">
                          {item.source === "SYNTHETIC" ? "模拟" : "真实"} / v{item.version}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.historyDeleteButton}
                        disabled={deletingImportId === item.id}
                        onClick={() => deleteImportBatch(item.id, item.fileName)}
                      >
                        {deletingImportId === item.id ? "删除中" : "删除"}
                      </button>
                    </div>
                    <div className={styles.historyMeta}>
                      <span>记录 {itemSummary?.recordCount ?? 0}</span>
                      <span>
                        技术通过率 {(itemSummary?.technicalSuccessRate ?? itemSummary?.successRate ?? 0).toFixed(1)}%
                      </span>
                      <span>{item.uploadedAt ? new Date(item.uploadedAt).toLocaleString("zh-CN") : "刚刚"}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>导入完成后，这里会保留最近批次，方便切换预览和重新进入分析。</div>
          )}
        </section>
      </div>
    </div>
  );
}
