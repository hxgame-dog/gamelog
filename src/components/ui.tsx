import Link from "next/link";
import { CSSProperties, ReactNode } from "react";

import chartStyles from "./charts.module.css";

export function HeaderActions({ children }: { children: ReactNode }) {
  return <div className="header-actions">{children}</div>;
}

export function PageHeader({
  title,
  copy,
  actions
}: {
  title: string;
  copy: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1 className="section-title" style={{ fontSize: 24 }}>
          {title}
        </h1>
        <p className="section-copy">{copy}</p>
      </div>
      {actions}
    </header>
  );
}

export function MetricCard({
  title,
  value,
  unit,
  delta,
  tone,
  trend
}: {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: string;
  trend: number[];
}) {
  return (
    <div
      className="surface"
      style={{
        padding: 16,
        background: "var(--panel-alt)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>{title}</p>
        <span className="pill">{delta}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 12 }}>
        <div
          style={{
            fontFamily: "var(--font-number)",
            fontWeight: 700,
            fontSize: 26,
            lineHeight: 1
          }}
        >
          {value}
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>{unit}</div>
      </div>
      <div style={{ display: "flex", gap: 4, minHeight: 40, alignItems: "flex-end", marginTop: 10 }}>
        {trend.map((point, index) => (
          <div
            key={`${title}-${index}`}
            style={{
              flex: 1,
              height: `${point}%`,
              borderRadius: 999,
              opacity: index === trend.length - 1 ? 1 : 0.55,
              background: tone
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function CategoryPill({
  label,
  color
}: {
  label: string;
  color: string;
}) {
  return (
    <span className="pill" style={{ color: "var(--text)" }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          display: "inline-block"
        }}
      />
      {label}
    </span>
  );
}

export function InsightCard({
  title,
  copy,
  tone
}: {
  title: string;
  copy: string;
  tone: string;
}) {
  return (
    <div
      className="surface"
      style={{
        padding: 14,
        background: "var(--panel-alt)"
      }}
    >
      <div
        className="pill"
        style={{
          color: tone,
          marginBottom: 10,
          background: `${tone}10`,
          borderColor: `${tone}22`
        }}
      >
        AI Insight
      </div>
      <h3 style={{ margin: 0, fontSize: 14 }}>{title}</h3>
      <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>{copy}</p>
    </div>
  );
}

export function ProgressPanel({
  title,
  stages
}: {
  title: string;
  stages: Array<{ title: string; status: string }>;
}) {
  return (
    <div className="panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h2 className="section-title" style={{ fontSize: 16 }}>
          {title}
        </h2>
        <span className="pill">分阶段进度</span>
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {stages.map((stage, index) => (
          <div key={stage.title} className="surface" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <strong>{`0${index + 1}`}</strong>
              <span className="pill">{stage.status}</span>
            </div>
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12 }}>{stage.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VersionCompareSwitch({
  currentVersion,
  compareVersion,
  versionOptions,
  buildHref
}: {
  currentVersion: string;
  compareVersion?: string | null;
  versionOptions?: string[];
  buildHref?: (version: string) => string;
}) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <span className="pill">当前版本 {currentVersion}</span>
      <span className="pill">{compareVersion ? `对比版本 ${compareVersion}` : "未选择对比版本"}</span>
      {versionOptions?.length && buildHref ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {versionOptions
            .filter((version) => version !== currentVersion)
            .slice(0, 4)
            .map((version) => (
              <Link key={version} href={buildHref(version)} className="button-secondary">
                对比 {version}
              </Link>
            ))}
        </div>
      ) : null}
    </div>
  );
}

export function TimelinePanel() {
  return (
    <div className="panel" style={{ padding: 18, minHeight: 200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h2 className="section-title" style={{ fontSize: 16 }}>
          Timeline Panel
        </h2>
        <span className="pill">模块三预留</span>
      </div>
      <p className="section-copy">
        用于未来的关卡心流分析，将单局高频事件重建为时间轴并映射到失败归因和心理标签。
      </p>
      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
          gap: 6
        }}
      >
        {[42, 65, 58, 76, 39, 82, 61, 44].map((item, index) => (
          <div
            key={index}
            style={{
              height: item,
              borderRadius: 8,
              background: index === 5 ? "var(--red)" : "rgba(31, 154, 133, 0.5)",
              alignSelf: "end"
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function StructuredTableEditor({ rows }: { rows: Array<Record<string, string>> }) {
  const headers = Object.keys(rows[0] ?? {});

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))`,
          gap: 8,
          padding: "0 12px 8px",
          color: "var(--muted)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.04em"
        }}
      >
        {headers.map((header) => (
          <div key={header}>{header}</div>
        ))}
      </div>
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((row, index) => (
            <div
              key={index}
              className="surface"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))`,
                gap: 8,
                padding: 12,
                fontSize: 12
              }}
            >
            {headers.map((header) => (
              <div key={header}>{row[header]}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChartCard({
  title,
  copy,
  values,
  color,
  compareValues,
  compareColor = "rgba(15, 23, 32, 0.18)"
}: {
  title: string;
  copy: string;
  values: number[];
  color: string;
  compareValues?: number[];
  compareColor?: string;
}) {
  const currentAvg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const compareAvg = compareValues?.length ? compareValues.reduce((sum, value) => sum + value, 0) / compareValues.length : null;
  const avgDelta = compareAvg === null ? null : currentAvg - compareAvg;

  function buildBarTooltip(value: number, compareValue?: number) {
    if (compareValue === undefined) {
      return `当前版本 ${value.toFixed(1)}%`;
    }

    const delta = value - compareValue;
    return `当前版本 ${value.toFixed(1)}%\n对比版本 ${compareValue.toFixed(1)}%\n差值 ${(delta > 0 ? "+" : "")}${delta.toFixed(1)}%`;
  }

  return (
    <div className={`panel ${chartStyles.chartCard}`}>
      <div className={chartStyles.chartTitleRow}>
        <div>
          <h3 className={chartStyles.chartTitle}>{title}</h3>
          <p className={chartStyles.chartCopy}>{copy}</p>
        </div>
        <span className="pill">主图</span>
      </div>
      <div className={chartStyles.chartSummaryRow}>
        <div className={chartStyles.chartSummaryCard}>
          <span className={chartStyles.chartSummaryLabel}>当前版本均值</span>
          <strong>{currentAvg.toFixed(1)}%</strong>
        </div>
        {compareAvg !== null ? (
          <>
            <div className={chartStyles.chartSummaryCard}>
              <span className={chartStyles.chartSummaryLabel}>对比版本均值</span>
              <strong>{compareAvg.toFixed(1)}%</strong>
            </div>
            <div className={chartStyles.chartSummaryCard}>
              <span className={chartStyles.chartSummaryLabel}>差值</span>
              <strong style={{ color: avgDelta && avgDelta < 0 ? "var(--red)" : "var(--teal)" }}>
                {(avgDelta ?? 0) > 0 ? "+" : ""}
                {(avgDelta ?? 0).toFixed(1)}%
              </strong>
            </div>
          </>
        ) : null}
      </div>
      <div className={chartStyles.bars}>
        {values.map((value, index) => {
          const compareValue = compareValues?.[index];
          return (
            <div key={`${title}-${index}`} className={chartStyles.barGroup}>
              {compareValue !== undefined ? (
                <div
                  className={`${chartStyles.bar} ${chartStyles.compareBar}`}
                  style={{
                    height: `${compareValue}%`,
                    background: compareColor
                  }}
                  title={`对比版本 ${compareValue.toFixed(1)}%`}
                >
                  <span className={chartStyles.barValue}>{compareValue}%</span>
                </div>
              ) : null}
              <div
                className={chartStyles.bar}
                style={{
                  height: `${value}%`,
                  background: `linear-gradient(180deg, ${color}, rgba(255,255,255,0.08))`
                }}
                title={buildBarTooltip(value, compareValue)}
              >
                <span className={chartStyles.barValue}>{value}%</span>
              </div>
            </div>
          );
        })}
      </div>
      {compareValues?.length ? (
        <div className={chartStyles.compareLegend}>
          <span className={chartStyles.compareLegendItem}>
            <span className={chartStyles.legendSwatch} style={{ background: color }} />
            当前版本
          </span>
          <span className={chartStyles.compareLegendItem}>
            <span className={chartStyles.legendSwatch} style={{ background: compareColor }} />
            对比版本
          </span>
        </div>
      ) : null}
    </div>
  );
}

function linePath(values: number[]) {
  if (!values.length) {
    return "";
  }

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * 100;
      const y = 100 - value;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function LineChartCard({
  title,
  copy,
  values,
  color,
  compareValues,
  compareColor = "var(--border-strong)"
}: {
  title: string;
  copy: string;
  values: number[];
  color: string;
  compareValues?: number[];
  compareColor?: string;
}) {
  const points = linePath(values);
  const comparePoints = compareValues?.length ? linePath(compareValues) : "";
  const currentLatest = values.at(-1) ?? 0;
  const compareLatest = compareValues?.length ? compareValues.at(-1) ?? 0 : null;
  const latestDelta = compareLatest === null ? null : currentLatest - compareLatest;

  function buildPointTooltip(value: number, compareValue?: number) {
    if (compareValue === undefined) {
      return `当前版本 ${value.toFixed(1)}%`;
    }

    const delta = value - compareValue;
    return `当前版本 ${value.toFixed(1)}%\n对比版本 ${compareValue.toFixed(1)}%\n差值 ${(delta > 0 ? "+" : "")}${delta.toFixed(1)}%`;
  }

  return (
    <div className={`panel ${chartStyles.chartCard}`}>
      <div className={chartStyles.chartTitleRow}>
        <div>
          <h3 className={chartStyles.chartTitle}>{title}</h3>
          <p className={chartStyles.chartCopy}>{copy}</p>
        </div>
        <span className="pill">趋势</span>
      </div>
      <div className={chartStyles.chartSummaryRow}>
        <div className={chartStyles.chartSummaryCard}>
          <span className={chartStyles.chartSummaryLabel}>当前末点</span>
          <strong>{currentLatest.toFixed(1)}%</strong>
        </div>
        {compareLatest !== null ? (
          <>
            <div className={chartStyles.chartSummaryCard}>
              <span className={chartStyles.chartSummaryLabel}>对比末点</span>
              <strong>{compareLatest.toFixed(1)}%</strong>
            </div>
            <div className={chartStyles.chartSummaryCard}>
              <span className={chartStyles.chartSummaryLabel}>差值</span>
              <strong style={{ color: latestDelta && latestDelta < 0 ? "var(--red)" : "var(--teal)" }}>
                {(latestDelta ?? 0) > 0 ? "+" : ""}
                {(latestDelta ?? 0).toFixed(1)}%
              </strong>
            </div>
          </>
        ) : null}
      </div>
      <div className={chartStyles.lineWrap}>
        <div className={chartStyles.grid} />
        <svg className={chartStyles.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
          {comparePoints ? (
            <path
              d={comparePoints}
              fill="none"
              stroke={compareColor}
              strokeWidth="2.5"
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <path d={points} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
          {compareValues?.map((value, index) => {
            const x = (index / (compareValues.length - 1 || 1)) * 100;
            const y = 100 - value;
            return (
              <circle
                key={`compare-${index}`}
                cx={x}
                cy={y}
                r="2.2"
                fill={compareColor}
              >
                <title>{`对比版本 ${value.toFixed(1)}%`}</title>
              </circle>
            );
          })}
          {values.map((value, index) => {
            const x = (index / (values.length - 1 || 1)) * 100;
            const y = 100 - value;
            return (
              <circle key={index} cx={x} cy={y} r="2.5" fill={color}>
                <title>{buildPointTooltip(value, compareValues?.[index])}</title>
              </circle>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function DonutChartCard({
  title,
  copy,
  values,
  colors,
  labels
}: {
  title: string;
  copy: string;
  values: number[];
  colors: readonly string[];
  labels: readonly string[];
}) {
  const total = values.reduce((sum, value) => sum + value, 0);
  const peakIndex = values.reduce((bestIndex, value, index, all) => (value > (all[bestIndex] ?? -1) ? index : bestIndex), 0);
  const segments = values.reduce<string[]>((result, value, index) => {
    const consumed = values.slice(0, index).reduce((sum, current) => sum + current, 0);
    const start = (consumed / total) * 360;
    const end = ((consumed + value) / total) * 360;
    result.push(`${colors[index]} ${start}deg ${end}deg`);
    return result;
  }, []);

  return (
    <div className={`panel ${chartStyles.chartCard}`}>
      <div className={chartStyles.chartTitleRow}>
        <div>
          <h3 className={chartStyles.chartTitle}>{title}</h3>
          <p className={chartStyles.chartCopy}>{copy}</p>
        </div>
        <span className="pill">构成</span>
      </div>
      <div className={chartStyles.chartSummaryRow}>
        <div className={chartStyles.chartSummaryCard}>
          <span className={chartStyles.chartSummaryLabel}>最大构成项</span>
          <strong>{labels[peakIndex] ?? "—"}</strong>
        </div>
        <div className={chartStyles.chartSummaryCard}>
          <span className={chartStyles.chartSummaryLabel}>占比</span>
          <strong>{values[peakIndex] ?? 0}%</strong>
        </div>
        <div className={chartStyles.chartSummaryCard}>
          <span className={chartStyles.chartSummaryLabel}>覆盖总量</span>
          <strong>{total.toFixed(0)}%</strong>
        </div>
      </div>
      <div className={chartStyles.pieWrap}>
        <div
          className={chartStyles.donut}
          style={{ background: `conic-gradient(${segments.join(", ")})` } as CSSProperties}
        />
        <div className={chartStyles.legend}>
          {labels.map((label, index) => (
            <div key={label} className={chartStyles.legendItem}>
              <div className={chartStyles.legendLeft}>
                <span className={chartStyles.dot} style={{ background: colors[index] }} />
                {label}
              </div>
              <strong title={`${label} 占比 ${values[index]}%`}>{values[index]}%</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HeaderLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="button-secondary">
      {label}
    </Link>
  );
}
