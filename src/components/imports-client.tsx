"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import * as XLSX from "xlsx";

import { buildImportSummary, type ImportSummary } from "@/lib/import-summary";

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

type ImportCell = string | number | boolean | null;

type ParsedUpload = {
  rows: Array<Record<string, ImportCell>>;
  headers: string[];
  notice?: string;
};

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

const rawTelemetrySupplementalKeys = [
  "step_name",
  "level_type",
  "activity_id",
  "activity_type",
  "reward_id",
  "item_name",
  "gain_source",
  "gain_amount",
  "resource_type",
  "current_slots",
  "screw_color",
  "trigger_scene",
  "country_code",
  "platform",
  "app_version",
  "event_time"
] as const;

function looksLikeRawTelemetryCsv(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.includes('"event_name"') && firstLine.includes('"event_value"') && firstLine.split(";").length > 40;
}

function parseDelimitedText(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function parseJsonObject(raw: string) {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === "string" && parsed.trim().startsWith("{")) {
      return JSON.parse(parsed) as Record<string, unknown>;
    }
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function pickFirstString(...values: Array<unknown>) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    const stringValue = String(value).trim();
    if (stringValue) {
      return stringValue;
    }
  }
  return "";
}

function pickFirstNumber(...values: Array<unknown>) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
}

function deriveResult(eventName: string, payload: Record<string, unknown>) {
  const explicit = pickFirstString(payload.result, payload.status, payload.outcome);
  if (explicit) {
    return explicit.toLowerCase();
  }
  if (/fail|error/i.test(eventName)) {
    return "fail";
  }
  if (/complete|success|purchase|reward_claim|achieved/i.test(eventName)) {
    return "success";
  }
  if (/click/i.test(eventName)) {
    return "click";
  }
  if (/view|impression/i.test(eventName)) {
    return "view";
  }
  return "";
}

function parseRawTelemetryCsv(text: string): ParsedUpload {
  const matrix = parseDelimitedText(text, ";");
  const [headerRow, ...dataRows] = matrix;
  const headers = headerRow.map((cell) => cell.trim());

  const rows = dataRows
    .map((cells) => {
      const rawRow = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])) as Record<string, string>;
      const eventPayload = parseJsonObject(rawRow.event_value ?? "");
      const customPayload = parseJsonObject(rawRow.custom_data ?? "");
      const payload = {
        ...(customPayload ?? {}),
        ...(eventPayload ?? {})
      } as Record<string, unknown>;

      const eventName = pickFirstString(rawRow.event_name);
      const normalized: Record<string, ImportCell> = {
        event_name: eventName,
        event_time: pickFirstString(rawRow.event_time, rawRow.LogTime),
        user_id: pickFirstString(rawRow.customer_user_id, rawRow.appsflyer_id, rawRow.android_id),
        platform: pickFirstString(rawRow.platform, rawRow.device_type),
        app_version: pickFirstString(rawRow.app_version),
        country_code: pickFirstString(rawRow.country_code),
        level_id: pickFirstString(payload.level_id, payload.tutoriallevel_id, payload.af_level_achieved),
        level_type: pickFirstString(payload.level_type),
        step_id: pickFirstString(payload.step_id),
        step_name: pickFirstString(payload.step_name, payload.tutorial_name),
        result: deriveResult(eventName, payload),
        fail_reason: pickFirstString(payload.fail_reason, payload.reason),
        duration_sec: pickFirstNumber(payload.duration_seconds, payload.time_spent, payload.rotate_time),
        placement: pickFirstString(payload.ad_placement),
        price: pickFirstNumber(rawRow.event_revenue, payload.af_revenue, payload.price, payload.amount),
        reward_type: pickFirstString(payload.reward_id, payload.item_name, payload.resource_type),
        activity_id: pickFirstString(payload.activity_id),
        activity_type: pickFirstString(payload.activity_type),
        reward_id: pickFirstString(payload.reward_id),
        item_name: pickFirstString(payload.item_name),
        gain_source: pickFirstString(payload.gain_source),
        gain_amount: pickFirstNumber(payload.gain_amount),
        resource_type: pickFirstString(payload.resource_type),
        current_slots: pickFirstNumber(payload.current_slots),
        screw_color: pickFirstString(payload.screw_color),
        trigger_scene: pickFirstString(payload.trigger_scene)
      };

      return normalized;
    })
    .filter((row) => String(row.event_name ?? "").trim());

  const cleanedHeaders = [
    "event_name",
    "event_time",
    "user_id",
    "platform",
    "app_version",
    "country_code",
    "level_id",
    "level_type",
    "step_id",
    "step_name",
    "result",
    "fail_reason",
    "duration_sec",
    "placement",
    "price",
    "reward_type",
    ...rawTelemetrySupplementalKeys.filter((header) => header in (rows[0] ?? {}))
  ];

  return {
    rows,
    headers: cleanedHeaders.filter((header, index, collection) => collection.indexOf(header) === index),
    notice: `已识别为分号分隔的原始日志导出，并自动展开 event_value/custom_data。当前映射的是清洗后的业务字段。`
  };
}

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

export function ImportsClient({
  projects,
  initialProjectId,
  plansByProject,
  latestImportsByProject,
  importsHistoryByProject
}: {
  projects: Project[];
  initialProjectId: string | null;
  plansByProject: Record<string, Plan[]>;
  latestImportsByProject: Record<string, ImportPreview | null>;
  importsHistoryByProject: Record<string, ImportPreview[]>;
}) {
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
  const [latestImportId, setLatestImportId] = useState(
    latestImportsByProject[initialProjectId ?? projects[0]?.id ?? ""]?.id ?? null
  );
  const [selectedHistoryImportId, setSelectedHistoryImportId] = useState(
    latestImportsByProject[initialProjectId ?? projects[0]?.id ?? ""]?.id ?? null
  );
  const [previewFilter, setPreviewFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  const activePlans = plansByProject[selectedProjectId] ?? [];
  const selectedPlan = activePlans.find((plan) => plan.id === selectedPlanId) ?? null;
  const latestImport = latestImportsByProject[selectedProjectId] ?? null;
  const importHistory = importsHistoryByProject[selectedProjectId] ?? [];
  const selectedHistoryImport =
    importHistory.find((item) => item.id === selectedHistoryImportId) ?? latestImport ?? null;
  const displaySummary = summary ?? (selectedHistoryImport?.summaryJson ?? null);
  const compareHistoryImport =
    importHistory.find((item) => item.id !== (selectedHistoryImport?.id ?? "")) ?? null;
  const rowsToShow = displaySummary?.previewRows ?? [];
  const keyword = previewFilter.trim().toLowerCase();
  const previewRows = !keyword
    ? rowsToShow
    : rowsToShow.filter((row) =>
        Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(keyword))
      );

  function summaryDelta(current: number | undefined, compare: number | undefined, suffix = "") {
    if (current === undefined || compare === undefined) {
      return null;
    }
    const delta = current - compare;
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}${suffix}`;
  }

  async function handleFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    let parsed: ParsedUpload = { rows: [], headers: [] };

    if (extension === "json") {
      const text = await file.text();
      const parsedRows = JSON.parse(text) as Array<Record<string, ImportCell>>;
      parsed = {
        rows: parsedRows,
        headers: Object.keys(parsedRows[0] ?? {})
      };
    } else if (extension === "csv") {
      const text = await file.text();
      if (looksLikeRawTelemetryCsv(text)) {
        parsed = parseRawTelemetryCsv(text);
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as Array<Record<string, ImportCell>>;
        parsed = {
          rows: parsedRows,
          headers: Object.keys(parsedRows[0] ?? {})
        };
      }
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as Array<Record<string, ImportCell>>;
      parsed = {
        rows: parsedRows,
        headers: Object.keys(parsedRows[0] ?? {})
      };
    }

    setFileName(file.name);
    setRows(parsed.rows);
    setHeaders(parsed.headers);
    setMappings(parsed.headers.map((header) => ({ source: header, target: suggestTarget(header) })));
      setCleaningNote(parsed.notice ?? null);
      setSummary(null);
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
      setLatestImportId(data.item.id);
      setSelectedHistoryImportId(data.item.id);
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
    setLatestImportId(data.id ?? null);
    setSelectedHistoryImportId(data.id ?? null);
    setMessage(`已生成并导入模拟数据：${data.generatedUsers} 名玩家，覆盖 ${data.days} 天。`);
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
                  setLatestImportId(latestImportsByProject[nextProjectId]?.id ?? null);
                  setSelectedHistoryImportId(latestImportsByProject[nextProjectId]?.id ?? null);
                  setSummary(null);
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
          <h2 className="section-title" style={{ fontSize: 18 }}>
            导入结果摘要
          </h2>
          {displaySummary ? (
            <>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>导入通过率</div>
                  <div className={styles.summaryValue}>{displaySummary.successRate.toFixed(1)}%</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>错误记录</div>
                  <div className={styles.summaryValue}>{displaySummary.errorCount}</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>未匹配事件</div>
                  <div className={styles.summaryValue}>{displaySummary.unmatchedEvents}</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>日志总数</div>
                  <div className={styles.summaryValue}>{displaySummary.recordCount}</div>
                </div>
              </div>
              <div className={styles.ctaRow}>
                {selectedHistoryImport?.id ? (
                  <Link className="button-secondary" href={`/api/imports/${selectedHistoryImport.id}/preview`} target="_blank">
                    查看导入预览
                  </Link>
                ) : null}
                <Link className="button-secondary" href={`/analytics/onboarding${selectedProjectId ? `?projectId=${selectedProjectId}` : ""}`}>
                  前往新手引导分析
                </Link>
                <Link className="button-secondary" href={`/analytics/level${selectedProjectId ? `?projectId=${selectedProjectId}` : ""}`}>
                  前往关卡分析
                </Link>
              </div>
              {selectedHistoryImport ? (
                <div className={styles.selectedImportMeta}>
                  当前查看批次：{selectedHistoryImport.fileName} / v{selectedHistoryImport.version}
                  {selectedHistoryImport.source ? ` / ${selectedHistoryImport.source === "SYNTHETIC" ? "模拟数据" : "真实数据"}` : ""}
                </div>
              ) : null}
              {compareHistoryImport?.summaryJson ? (
                <div className={styles.compareStrip}>
                  <span>对比批次：{compareHistoryImport.fileName} / v{compareHistoryImport.version}</span>
                  <span>通过率 {summaryDelta(displaySummary.successRate, compareHistoryImport.summaryJson.successRate, "%")}</span>
                  <span>异常数 {summaryDelta(displaySummary.errorCount, compareHistoryImport.summaryJson.errorCount)}</span>
                  <span>记录数 {summaryDelta(displaySummary.recordCount, compareHistoryImport.summaryJson.recordCount)}</span>
                </div>
              ) : null}
              <div className={styles.rankBlock}>
                <h3 className={styles.stepTitle}>Top 事件</h3>
                {displaySummary.topEvents.map((item) => (
                  <div key={item.name} className={styles.rankItem}>
                    <span>{item.name}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>导入完成后，这里会显示真实摘要。</div>
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
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.historyItem} ${active ? styles.historyItemActive : ""}`}
                    onClick={() => {
                      setSelectedHistoryImportId(item.id);
                      setSummary(null);
                      setPreviewFilter("");
                      setMessage(`已切换到导入批次：${item.fileName}`);
                      setError(null);
                    }}
                  >
                    <div className={styles.historyHeader}>
                      <strong>{item.fileName}</strong>
                      <span className="pill">
                        {item.source === "SYNTHETIC" ? "模拟" : "真实"} / v{item.version}
                      </span>
                    </div>
                    <div className={styles.historyMeta}>
                      <span>记录 {itemSummary?.recordCount ?? 0}</span>
                      <span>通过率 {itemSummary?.successRate?.toFixed(1) ?? "0.0"}%</span>
                      <span>{item.uploadedAt ? new Date(item.uploadedAt).toLocaleString("zh-CN") : "刚刚"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>导入完成后，这里会保留最近批次，方便切换预览和重新进入分析。</div>
          )}
        </section>

        {mode === "real" ? (
          <section className={`panel ${styles.card}`}>
            <div className={styles.previewTop}>
              <h2 className="section-title" style={{ fontSize: 18 }}>
                导入后预览
              </h2>
              <input
                className={styles.previewFilter}
                placeholder="按事件名 / 步骤 / 关卡筛选"
                value={previewFilter}
                onChange={(event) => setPreviewFilter(event.target.value)}
              />
            </div>
            {previewRows.length ? (
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
            )}
          </section>
        ) : (
          <section className={`panel ${styles.card}`}>
            <h2 className="section-title" style={{ fontSize: 18 }}>
              模拟数据说明
            </h2>
            <div className={styles.emptyState}>
              当前入口会基于已确认的方案结构生成事件日志，并自动触发与真实导入一致的摘要聚合，所以生成完成后你可以直接去分类分析和 AI 报告页查看结果。
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
