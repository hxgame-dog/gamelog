"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";

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

type ImportSummary = {
  recordCount: number;
  successRate: number;
  errorCount: number;
  unmatchedEvents: number;
  topEvents: Array<{ name: string; count: number }>;
  topPlacements: Array<{ name: string; count: number }>;
};

const targetOptions = [
  { key: "ignore", label: "忽略该列" },
  { key: "event_name", label: "事件名" },
  { key: "user_id", label: "用户 ID" },
  { key: "result", label: "结果状态" },
  { key: "fail_reason", label: "失败原因" },
  { key: "level_id", label: "关卡 ID" },
  { key: "step_id", label: "步骤 ID" },
  { key: "placement", label: "广告位" },
  { key: "price", label: "金额" },
  { key: "property_hint", label: "附加字段" }
] as const;

function suggestTarget(header: string) {
  const normalized = header.toLowerCase();
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
  if (normalized.includes("step")) {
    return "step_id";
  }
  if (normalized.includes("place") || normalized.includes("ad")) {
    return "placement";
  }
  if (normalized.includes("price") || normalized.includes("amount")) {
    return "price";
  }
  return "property_hint";
}

export function ImportsClient({
  projects,
  initialProjectId,
  plansByProject
}: {
  projects: Project[];
  initialProjectId: string | null;
  plansByProject: Record<string, Plan[]>;
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
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  const activePlans = plansByProject[selectedProjectId] ?? [];
  const selectedPlan = activePlans.find((plan) => plan.id === selectedPlanId) ?? null;

  async function handleFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    let parsedRows: Array<Record<string, string | number | boolean | null>> = [];

    if (extension === "json") {
      const text = await file.text();
      parsedRows = JSON.parse(text) as Array<Record<string, string | number | boolean | null>>;
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    }

    const nextHeaders = Object.keys(parsedRows[0] ?? {});
    setFileName(file.name);
    setRows(parsedRows);
    setHeaders(nextHeaders);
    setMappings(nextHeaders.map((header) => ({ source: header, target: suggestTarget(header) })));
    setSummary(null);
    setMessage(`已读取 ${parsedRows.length} 行日志，下一步请确认字段映射。`);
    setError(null);
  }

  function mappedRows() {
    const activeMappings = mappings.filter((item) => item.target !== "ignore");
    return rows.map((row) => {
      const nextRow: Record<string, string | number | boolean | null> = {};
      activeMappings.forEach((mapping) => {
        nextRow[mapping.target] = row[mapping.source] ?? null;
      });
      return nextRow;
    });
  }

  async function runRealImport() {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: selectedProjectId,
        trackingPlanId: selectedPlanId,
        version,
        fileName,
        rows: mappedRows(),
        mappings
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "日志导入失败。");
      return;
    }
    setSummary(data.item.summary);
    setMessage("日志已导入，摘要与聚合指标已更新。");
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
          {summary ? (
            <>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>导入通过率</div>
                  <div className={styles.summaryValue}>{summary.successRate.toFixed(1)}%</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>错误记录</div>
                  <div className={styles.summaryValue}>{summary.errorCount}</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>未匹配事件</div>
                  <div className={styles.summaryValue}>{summary.unmatchedEvents}</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>日志总数</div>
                  <div className={styles.summaryValue}>{summary.recordCount}</div>
                </div>
              </div>
              <div className={styles.rankBlock}>
                <h3 className={styles.stepTitle}>Top 事件</h3>
                {summary.topEvents.map((item) => (
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

        {mode === "real" ? (
          <section className={`panel ${styles.card}`}>
            <h2 className="section-title" style={{ fontSize: 18 }}>
              文件预览
            </h2>
            {rows.length ? (
              <div className={styles.previewWrap}>
                <div className={styles.previewHeader}>
                  {headers.map((header) => (
                    <div key={header}>{header}</div>
                  ))}
                </div>
                {rows.slice(0, 5).map((row, index) => (
                  <div key={`${fileName}-${index}`} className={styles.previewRow}>
                    {headers.map((header) => (
                      <div key={header}>{String(row[header] ?? "")}</div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>上传文件后，这里会显示前 5 行预览。</div>
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
