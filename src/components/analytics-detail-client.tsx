"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./analytics-page.module.css";
import { InsightCard } from "./ui";

type DetailRow = {
  label: string;
  current: string;
  compare?: string | null;
  delta?: string | null;
  note: string;
};

export function AnalyticsDetailClient({
  ranking,
  detailRows,
  versionLabel,
  compareVersionLabel,
  insight,
  compareInsight,
  color,
  initialFilter = "all"
}: {
  ranking: Array<[string, string]>;
  detailRows: DetailRow[];
  versionLabel: string;
  compareVersionLabel?: string | null;
  insight: string;
  compareInsight?: string | null;
  color: string;
  initialFilter?: "all" | "abnormal" | "delta";
}) {
  const [selectedDetailLabel, setSelectedDetailLabel] = useState<string | null>(null);
  const [detailFilter, setDetailFilter] = useState<"all" | "abnormal" | "delta">(initialFilter);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setDetailFilter(initialFilter);
  }, [initialFilter]);

  const rankingLinks = useMemo(
    () =>
      ranking.map((item, index) => ({
        name: item[0],
        meta: item[1],
        detailLabel: `重点项 ${index + 1}`
      })),
    [ranking]
  );

  useEffect(() => {
    if (!selectedDetailLabel) {
      return;
    }
    const target = rowRefs.current[selectedDetailLabel];
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedDetailLabel]);

  const filteredDetailRows = useMemo(() => {
    if (detailFilter === "abnormal") {
      return detailRows.filter((row) =>
        /异常|失败|流失|告警|超时|error|drop/i.test(`${row.label} ${row.note} ${row.current} ${row.compare ?? ""}`)
      );
    }

    if (detailFilter === "delta") {
      return detailRows.filter((row) => row.delta && row.delta !== "—" && row.delta !== "+0.0%" && row.delta !== "0.0%");
    }

    return detailRows;
  }, [detailFilter, detailRows]);

  return (
    <>
      <div className={styles.detailGrid}>
        <section className={`panel ${styles.tableCard}`}>
          <div className={styles.sectionTop}>
            <div>
              <h2 className="section-title" style={{ fontSize: 18 }}>
                重点事件排行
              </h2>
              <p className={styles.sectionCopy}>点击某一项会联动定位到下方的结构化明细，方便快速核对对应结论。</p>
            </div>
            <span className="pill">Top {ranking.length}</span>
          </div>
          <div className={styles.rankList}>
            {rankingLinks.map((item, index) => (
              <button
                type="button"
                key={`${item.name}-${index}`}
                className={`${styles.rankItem} ${styles.rankItemButton} ${selectedDetailLabel === item.detailLabel ? styles.rankItemActive : ""}`}
                onClick={() => setSelectedDetailLabel(item.detailLabel)}
              >
                <div className={styles.rankIndex}>{index + 1}</div>
                <div>
                  <strong>{item.name}</strong>
                  <div className={styles.rankMeta}>{item.meta}</div>
                </div>
                <span className={styles.rankHint}>{selectedDetailLabel === item.detailLabel ? "已定位" : index === 0 ? "优先关注" : "定位明细"}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.insightCard}>
          <InsightCard title="AI 分类洞察" copy={insight} tone={color} />
          {compareInsight ? (
            <div style={{ marginTop: 12 }}>
              <InsightCard title="版本差异摘要" copy={compareInsight} tone="var(--blue)" />
            </div>
          ) : null}
        </section>
      </div>

      <section className={`panel ${styles.detailTableCard}`}>
        <div className={styles.detailTableHeader}>
          <div>
            <h2 className="section-title" style={{ fontSize: 18 }}>
              结构化明细
            </h2>
            <p className={styles.sectionCopy}>用筛选快速只看异常项或变化最大的指标，再结合排行做差异复核。</p>
          </div>
          <div className={styles.detailToolbar}>
            <span className="pill">
              {compareVersionLabel ? `当前版本 vs ${compareVersionLabel}` : "当前版本"}
            </span>
            <div className={styles.detailFilterRow}>
              <button
                type="button"
                className={`${styles.detailFilterButton} ${detailFilter === "all" ? styles.detailFilterButtonActive : ""}`}
                onClick={() => setDetailFilter("all")}
              >
                全部明细
              </button>
              <button
                type="button"
                className={`${styles.detailFilterButton} ${detailFilter === "abnormal" ? styles.detailFilterButtonActive : ""}`}
                onClick={() => setDetailFilter("abnormal")}
              >
                只看异常项
              </button>
              <button
                type="button"
                className={`${styles.detailFilterButton} ${detailFilter === "delta" ? styles.detailFilterButtonActive : ""}`}
                onClick={() => setDetailFilter("delta")}
              >
                变化最大
              </button>
            </div>
          </div>
        </div>
        <div className={styles.detailTable}>
          <div className={styles.detailTableRow}>
            <div className={styles.detailTableCellMuted}>指标 / 项</div>
            <div className={styles.detailTableCellMuted}>{versionLabel}</div>
            <div className={styles.detailTableCellMuted}>{compareVersionLabel ?? "未选择对比"}</div>
            <div className={styles.detailTableCellMuted}>变化</div>
            <div className={styles.detailTableCellMuted}>说明</div>
          </div>
          {filteredDetailRows.map((row) => (
            <div
              key={`${row.label}-${row.current}`}
              ref={(node) => {
                rowRefs.current[row.label] = node;
              }}
              className={`${styles.detailTableRow} ${selectedDetailLabel === row.label ? styles.detailTableRowActive : ""}`}
            >
              <div className={styles.detailTableCellStrong}>{row.label}</div>
              <div>{row.current}</div>
              <div>{row.compare ?? "—"}</div>
              <div className={row.delta?.startsWith("-") ? styles.detailDeltaNegative : styles.detailDelta}>
                {row.delta ?? "—"}
              </div>
              <div className={styles.detailTableNote}>{row.note}</div>
            </div>
          ))}
        </div>
        {!filteredDetailRows.length ? (
          <div className={styles.emptyDetailState}>当前筛选下没有符合条件的明细项，建议切回“全部明细”查看完整结构。</div>
        ) : null}
      </section>
    </>
  );
}
