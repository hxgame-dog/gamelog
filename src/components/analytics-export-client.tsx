"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type ExportPayload = {
  title: string;
  category: string;
  versionLabel: string;
  compareVersionLabel?: string | null;
  metrics: Array<{ label: string; value: string; compareValue?: string | null }>;
  main: number[];
  compareMain?: number[];
  trend: number[];
  compareTrend?: number[];
  aux: number[];
  auxLabels: string[];
  ranking: Array<[string, string]>;
  detailRows: Array<{ label: string; current: string; compare?: string | null; delta?: string | null; note: string }>;
};

export function AnalyticsExportButton({ payload }: { payload: ExportPayload }) {
  const [message, setMessage] = useState<string | null>(null);

  function downloadWorkbook() {
    const workbook = XLSX.utils.book_new();

    const metricsSheet = XLSX.utils.json_to_sheet(
      payload.metrics.map((item) => ({
        指标: item.label,
        当前版本: item.value,
        对比版本: item.compareValue ?? "—"
      }))
    );

    const chartSheet = XLSX.utils.json_to_sheet(
      payload.main.map((value, index) => ({
        序号: index + 1,
        主图当前版本: value,
        主图对比版本: payload.compareMain?.[index] ?? "",
        趋势当前版本: payload.trend[index] ?? "",
        趋势对比版本: payload.compareTrend?.[index] ?? "",
        构成标签: payload.auxLabels[index] ?? "",
        构成值: payload.aux[index] ?? ""
      }))
    );

    const rankingSheet = XLSX.utils.aoa_to_sheet([
      ["排名", "名称", "说明"],
      ...payload.ranking.map((item, index) => [index + 1, item[0], item[1]])
    ]);

    const detailSheet = XLSX.utils.json_to_sheet(
      payload.detailRows.map((row) => ({
        指标或项: row.label,
        当前版本: row.current,
        对比版本: row.compare ?? "—",
        变化: row.delta ?? "—",
        说明: row.note
      }))
    );

    XLSX.utils.book_append_sheet(workbook, metricsSheet, "Metrics");
    XLSX.utils.book_append_sheet(workbook, chartSheet, "Series");
    XLSX.utils.book_append_sheet(workbook, rankingSheet, "Ranking");
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Details");

    const safeTitle = payload.category.replace(/\s+/g, "-");
    const filename = `${safeTitle}-${payload.versionLabel}${payload.compareVersionLabel ? `-vs-${payload.compareVersionLabel}` : ""}.xlsx`;
    XLSX.writeFile(workbook, filename);
    setMessage("已导出 Excel 快照。");
    window.setTimeout(() => setMessage(null), 2400);
  }

  return (
    <>
      <button className="button-secondary" type="button" onClick={downloadWorkbook}>
        导出图表
      </button>
      {message ? <span className="pill">{message}</span> : null}
    </>
  );
}
