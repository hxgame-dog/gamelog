import Link from "next/link";
import { CSSProperties, ReactNode } from "react";

import { deriveOnboardingTrendCompareSeries } from "@/lib/analytics-ui";

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

type OnboardingStepRow = {
  stepId: string;
  stepName: string;
  arrivals: number;
  completions: number;
  completionRate: number;
  dropoffCount?: number;
  avgDuration: number;
};

export function OnboardingFunnelCard({
  title,
  copy,
  steps,
  color,
  compareSteps
}: {
  title: string;
  copy: string;
  steps: OnboardingStepRow[];
  color: string;
  compareSteps?: OnboardingStepRow[];
}) {
  const baseline = Math.max(steps[0]?.arrivals ?? 1, 1);
  const compareMap = new Map((compareSteps ?? []).map((step) => [step.stepId || step.stepName, step]));
  const maxDropoff = Math.max(...steps.map((step) => step.dropoffCount ?? Math.max(step.arrivals - step.completions, 0)), 0);
  const currentAvg = steps.length ? steps.reduce((sum, step) => sum + step.completionRate, 0) / steps.length : 0;
  const compareAvg = compareSteps?.length
    ? compareSteps.reduce((sum, step) => sum + step.completionRate, 0) / compareSteps.length
    : null;

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
          <span className={chartStyles.chartSummaryLabel}>当前平均完成率</span>
          <strong>{currentAvg.toFixed(1)}%</strong>
        </div>
        {compareAvg !== null ? (
          <>
            <div className={chartStyles.chartSummaryCard}>
              <span className={chartStyles.chartSummaryLabel}>对比平均完成率</span>
              <strong>{compareAvg.toFixed(1)}%</strong>
            </div>
            <div className={chartStyles.chartSummaryCard}>
              <span className={chartStyles.chartSummaryLabel}>差值</span>
              <strong style={{ color: currentAvg - compareAvg < 0 ? "var(--red)" : "var(--teal)" }}>
                {(currentAvg - compareAvg) > 0 ? "+" : ""}
                {(currentAvg - compareAvg).toFixed(1)}%
              </strong>
            </div>
          </>
        ) : null}
      </div>
      {steps.length ? (
        <div className={chartStyles.funnelWrap}>
          {steps.map((step) => {
            const key = step.stepId || step.stepName;
            const compare = compareMap.get(key);
            const arrivalPct = Math.max(4, (step.arrivals / baseline) * 100);
            const completionPct = Math.max(2, arrivalPct * (step.completionRate / 100));
            const dropoff = step.dropoffCount ?? Math.max(step.arrivals - step.completions, 0);
            return (
              <div key={key} className={chartStyles.funnelRow}>
                <div className={chartStyles.funnelLabel}>
                  <strong>{step.stepName || step.stepId}</strong>
                  <span className={chartStyles.funnelMeta}>步骤 {step.stepId || "未命名"}</span>
                </div>
                <div className={`${chartStyles.funnelTrack} ${dropoff === maxDropoff && maxDropoff > 0 ? chartStyles.funnelHighlight : ""}`}>
                  {compare ? (
                    <div className={chartStyles.funnelBarBase}>
                      <div
                        className={`${chartStyles.funnelBarFill} ${chartStyles.funnelBarSecondary}`}
                        style={{ width: `${Math.max(2, (((compare.arrivals || 0) / Math.max(compareSteps?.[0]?.arrivals || 1, 1)) * 100))}%`, background: "rgba(15, 23, 32, 0.16)" }}
                      />
                    </div>
                  ) : null}
                  <div className={chartStyles.funnelBarBase}>
                    <div className={chartStyles.funnelBarFill} style={{ width: `${arrivalPct}%`, background: `${color}33` }} />
                    <div className={chartStyles.funnelBarFill} style={{ width: `${completionPct}%`, background: color }} />
                  </div>
                  <div className={chartStyles.funnelStats}>
                    <span>{step.arrivals} 到达</span>
                    <span>{step.completions} 完成</span>
                    <span>流失 {dropoff}</span>
                    <span>{step.avgDuration.toFixed(1)} 秒</span>
                  </div>
                </div>
                <div className={chartStyles.funnelDelta}>
                  <div>{step.completionRate.toFixed(1)}%</div>
                  {compare ? <div className={chartStyles.funnelMeta}>对比 {(step.completionRate - compare.completionRate > 0 ? "+" : "")}{(step.completionRate - compare.completionRate).toFixed(1)}%</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px dashed var(--border)", color: "var(--muted)", fontSize: 13 }}>
          当前批次还没有可用的 onboarding 步骤数据，页面会在导入 step 日志后继续按专属漏斗结构渲染。
        </div>
      )}
      {compareSteps?.length ? (
        <div className={chartStyles.compareLegend}>
          <span className={chartStyles.compareLegendItem}>
            <span className={chartStyles.legendSwatch} style={{ background: color }} />
            当前完成率
          </span>
          <span className={chartStyles.compareLegendItem}>
            <span className={chartStyles.legendSwatch} style={{ background: "rgba(15, 23, 32, 0.16)" }} />
            对比到达基线
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function OnboardingTrendCard({
  title,
  copy,
  steps,
  color,
  compareSteps
}: {
  title: string;
  copy: string;
  steps: OnboardingStepRow[];
  color: string;
  compareSteps?: OnboardingStepRow[];
}) {
  const values = steps.map((step) => step.completionRate);
  const { compareValues, compareLatest, comparePoints } = deriveOnboardingTrendCompareSeries(steps, compareSteps);
  const points = linePath(values);
  const latest = values.at(-1) ?? 0;

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
          <span className={chartStyles.chartSummaryLabel}>当前末步完成率</span>
          <strong>{latest.toFixed(1)}%</strong>
        </div>
        {compareLatest !== null ? (
          <>
            <div className={chartStyles.chartSummaryCard}>
              <span className={chartStyles.chartSummaryLabel}>对比末步完成率</span>
              <strong>{compareLatest.toFixed(1)}%</strong>
            </div>
            <div className={chartStyles.chartSummaryCard}>
              <span className={chartStyles.chartSummaryLabel}>差值</span>
              <strong style={{ color: latest - compareLatest < 0 ? "var(--red)" : "var(--teal)" }}>
                {(latest - compareLatest) > 0 ? "+" : ""}
                {(latest - compareLatest).toFixed(1)}%
              </strong>
            </div>
          </>
        ) : null}
      </div>
      {steps.length ? (
        <>
          <div className={chartStyles.lineWrap}>
            <div className={chartStyles.grid} />
            <svg className={chartStyles.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
              {comparePoints ? (
                <path d={comparePoints} fill="none" stroke="var(--border-strong)" strokeWidth="2.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
              ) : null}
              <path d={points} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
              {compareSteps?.length
                ? compareValues.map((value, index) => {
                    if (value === null) {
                      return null;
                    }
                    const x = (index / (compareValues.length - 1 || 1)) * 100;
                    const y = 100 - value;
                    return (
                      <circle key={`compare-step-${index}`} cx={x} cy={y} r="2.2" fill="var(--border-strong)">
                        <title>{`对比完成率 ${value.toFixed(1)}%`}</title>
                      </circle>
                    );
                  })
                : null}
              {values.map((value, index) => {
                const x = (index / (values.length - 1 || 1)) * 100;
                const y = 100 - value;
                const compareValue = compareValues[index];
                return (
                  <circle key={`step-${index}`} cx={x} cy={y} r="2.5" fill={color}>
                    <title>{`${steps[index]?.stepName || steps[index]?.stepId}\n当前完成率 ${value.toFixed(1)}%${compareValue !== null ? `\n对比完成率 ${compareValue.toFixed(1)}%` : ""}`}</title>
                  </circle>
                );
              })}
            </svg>
          </div>
          <div className={chartStyles.trendFooter}>
            {steps.map((step, index) => (
              <div key={`${step.stepId}-${index}`} className={chartStyles.trendStep}>
                <span className={chartStyles.trendStepLabel}>{step.stepName || step.stepId}</span>
                <strong className={chartStyles.trendStepValue}>{step.completionRate.toFixed(1)}%</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px dashed var(--border)", color: "var(--muted)", fontSize: 13 }}>
          当前批次还没有足够的步骤完成率样本，趋势曲线会在导入 onboarding 步骤日志后自动出现。
        </div>
      )}
    </div>
  );
}

export function OnboardingDurationRankingCard({
  title,
  copy,
  steps
}: {
  title: string;
  copy: string;
  steps: OnboardingStepRow[];
}) {
  const ranking = steps.slice().sort((a, b) => b.avgDuration - a.avgDuration).slice(0, 6);
  const maxDuration = Math.max(...ranking.map((step) => step.avgDuration), 0);
  return (
    <div className={`panel ${chartStyles.chartCard}`}>
      <div className={chartStyles.chartTitleRow}>
        <div>
          <h3 className={chartStyles.chartTitle}>{title}</h3>
          <p className={chartStyles.chartCopy}>{copy}</p>
        </div>
        <span className="pill">耗时</span>
      </div>
      {ranking.length ? (
        <div className={chartStyles.rankingList}>
          {ranking.map((step) => (
            <div key={`${step.stepId}-${step.stepName}`} className={chartStyles.rankingItem}>
              <div>
                <strong>{step.stepName || step.stepId}</strong>
                <div className={chartStyles.rankingMeta}>
                  流失 {step.dropoffCount ?? Math.max(step.arrivals - step.completions, 0)} / 完成率 {step.completionRate.toFixed(1)}%
                </div>
              </div>
              <div className={chartStyles.rankingValue}>
                {step.avgDuration.toFixed(1)}s
                <div className={chartStyles.rankingMeta}>{maxDuration > 0 ? `${((step.avgDuration / maxDuration) * 100).toFixed(0)}% 相对耗时` : "—"}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px dashed var(--border)", color: "var(--muted)", fontSize: 13 }}>
          当前批次还没有可排序的步骤耗时数据，耗时排行会在步骤样本就绪后自动补齐。
        </div>
      )}
    </div>
  );
}

type LevelRow = {
  levelId: string;
  levelType: string;
  starts: number;
  completes: number;
  fails: number;
  retries: number;
  completionRate: number;
  failRate: number;
  topFailReason: string;
};

export function LevelProgressCard({
  title,
  copy,
  rows,
  compareRows
}: {
  title: string;
  copy: string;
  rows: LevelRow[];
  compareRows?: LevelRow[];
}) {
  const maxStarts = Math.max(...rows.map((row) => row.starts), 1);
  const compareMap = new Map((compareRows ?? []).map((row) => [row.levelId, row]));
  const currentAvg = rows.length ? rows.reduce((sum, row) => sum + row.completionRate, 0) / rows.length : 0;
  const compareAvg = compareRows?.length ? compareRows.reduce((sum, row) => sum + row.completionRate, 0) / compareRows.length : null;

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
          <span className={chartStyles.chartSummaryLabel}>当前平均通关率</span>
          <strong>{currentAvg.toFixed(1)}%</strong>
        </div>
        {compareAvg !== null ? (
          <>
            <div className={chartStyles.chartSummaryCard}>
              <span className={chartStyles.chartSummaryLabel}>对比平均通关率</span>
              <strong>{compareAvg.toFixed(1)}%</strong>
            </div>
            <div className={chartStyles.chartSummaryCard}>
              <span className={chartStyles.chartSummaryLabel}>差值</span>
              <strong style={{ color: currentAvg - compareAvg < 0 ? "var(--red)" : "var(--teal)" }}>
                {(currentAvg - compareAvg) > 0 ? "+" : ""}
                {(currentAvg - compareAvg).toFixed(1)}%
              </strong>
            </div>
          </>
        ) : null}
      </div>
      <div className={chartStyles.levelCompareWrap}>
        {rows.map((row) => {
          const compare = compareMap.get(row.levelId);
          const startPct = Math.max(4, (row.starts / maxStarts) * 100);
          const completePct = Math.max(2, (row.completes / maxStarts) * 100);
          const failPct = Math.max(0, (row.fails / maxStarts) * 100);
          return (
            <div key={`${row.levelId}-${row.levelType}`} className={chartStyles.levelCompareRow}>
              <div className={chartStyles.levelCompareLabel}>
                <strong>{row.levelType ? `${row.levelId} (${row.levelType})` : row.levelId}</strong>
                <span className={chartStyles.funnelMeta}>{row.topFailReason || "无明显失败原因"}</span>
              </div>
              <div className={chartStyles.levelCompareTrack}>
                <div className={chartStyles.levelBarStack}>
                  <div className={`${chartStyles.levelBarSegment} ${chartStyles.levelBarStart}`} style={{ width: `${startPct}%` }} />
                  <div className={`${chartStyles.levelBarSegment} ${chartStyles.levelBarComplete}`} style={{ width: `${completePct}%` }} />
                  {failPct > 0 ? (
                    <div
                      className={`${chartStyles.levelBarSegment} ${chartStyles.levelBarFail}`}
                      style={{ left: `${completePct}%`, width: `${failPct}%` }}
                    />
                  ) : null}
                </div>
                <div className={chartStyles.levelCompareStats}>
                  <span>{row.starts} 开始</span>
                  <span>{row.completes} 完成</span>
                  <span>{row.fails} 失败</span>
                  <span>重试 {row.retries}</span>
                </div>
              </div>
              <div className={chartStyles.levelCompareDelta}>
                <div>{row.completionRate.toFixed(1)}%</div>
                {compare ? <div className={chartStyles.funnelMeta}>对比 {(row.completionRate - compare.completionRate > 0 ? "+" : "")}{(row.completionRate - compare.completionRate).toFixed(1)}%</div> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className={chartStyles.compareLegend}>
        <span className={chartStyles.compareLegendItem}>
          <span className={chartStyles.legendSwatch} style={{ background: "rgba(91, 140, 255, 0.22)" }} />
          开始
        </span>
        <span className={chartStyles.compareLegendItem}>
          <span className={chartStyles.legendSwatch} style={{ background: "rgba(31, 154, 133, 0.9)" }} />
          完成
        </span>
        <span className={chartStyles.compareLegendItem}>
          <span className={chartStyles.legendSwatch} style={{ background: "rgba(209, 74, 66, 0.88)" }} />
          失败
        </span>
      </div>
    </div>
  );
}

type FunnelStage = { label: string; count: number; rate?: number; inferred?: boolean };

export function MonetizationDualFunnelCard({
  title,
  copy,
  storeFunnel,
  paymentFunnel
}: {
  title: string;
  copy: string;
  storeFunnel: FunnelStage[];
  paymentFunnel: FunnelStage[];
}) {
  const currentStoreSuccess = storeFunnel.at(-1)?.rate ?? 0;
  const currentPaymentSuccess = paymentFunnel.at(-1)?.rate ?? 0;

  function renderFunnel(name: string, stages: FunnelStage[], tone: string) {
    const max = Math.max(...stages.map((stage) => stage.count), 1);
    return (
      <div className={chartStyles.miniFunnelCard}>
        <div className={chartStyles.miniFunnelTitle}>{name}</div>
        <div className={chartStyles.miniFunnelList}>
          {stages.map((stage) => (
            <div key={`${name}-${stage.label}`} className={chartStyles.miniFunnelRow}>
              <div className={chartStyles.miniFunnelTrack}>
                <strong>{stage.label}</strong>
                <div className={chartStyles.miniFunnelBar}>
                  <div className={chartStyles.miniFunnelFill} style={{ width: `${Math.max(4, (stage.count / max) * 100)}%`, background: tone }} />
                </div>
                <div className={chartStyles.miniFunnelMeta}>
                  <span>{stage.count} 次</span>
                  <span>{(stage.rate ?? 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className={chartStyles.miniFunnelValue}>{(stage.rate ?? 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>
    );
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
          <span className={chartStyles.chartSummaryLabel}>商店链路成功率</span>
          <strong>{currentStoreSuccess.toFixed(1)}%</strong>
        </div>
        <div className={chartStyles.chartSummaryCard}>
          <span className={chartStyles.chartSummaryLabel}>支付链路成功率</span>
          <strong>{currentPaymentSuccess.toFixed(1)}%</strong>
        </div>
      </div>
      <div className={chartStyles.dualFunnelGrid}>
        {renderFunnel("商店 / 礼包曝光链路", storeFunnel, "linear-gradient(180deg, rgba(198, 146, 35, 0.95), rgba(198, 146, 35, 0.68))")}
        {renderFunnel("支付请求链路", paymentFunnel, "linear-gradient(180deg, rgba(31, 154, 133, 0.9), rgba(31, 154, 133, 0.68))")}
      </div>
    </div>
  );
}

type AdPlacementRow = {
  placement: string;
  requests: number;
  plays: number;
  clicks: number;
  rewards: number;
  clickRate: number;
  rewardRate: number;
  inferred?: boolean;
};

export function AdPlacementFlowCard({
  title,
  copy,
  placements
}: {
  title: string;
  copy: string;
  placements: AdPlacementRow[];
}) {
  const maxRequests = Math.max(...placements.map((row) => row.requests), 1);
  const totalRewardRate = placements.length
    ? placements.reduce((sum, row) => sum + row.rewardRate, 0) / placements.length
    : 0;

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
          <span className={chartStyles.chartSummaryLabel}>广告位数量</span>
          <strong>{placements.length}</strong>
        </div>
        <div className={chartStyles.chartSummaryCard}>
          <span className={chartStyles.chartSummaryLabel}>平均发奖率</span>
          <strong>{totalRewardRate.toFixed(1)}%</strong>
        </div>
      </div>
      <div className={chartStyles.placementFlowWrap}>
        {placements.map((row) => {
          const requestPct = Math.max(4, (row.requests / maxRequests) * 100);
          const playPct = Math.max(2, (row.plays / maxRequests) * 100);
          const clickPct = Math.max(0, (row.clicks / maxRequests) * 100);
          return (
            <div key={row.placement} className={chartStyles.placementFlowRow}>
              <div className={chartStyles.levelCompareLabel}>
                <strong>{row.placement}</strong>
                <span className={chartStyles.funnelMeta}>{row.inferred ? "部分推断" : "直接统计"}</span>
              </div>
              <div className={chartStyles.placementFlowTrack}>
                <div className={chartStyles.placementStack}>
                  <div className={`${chartStyles.placementSegment} ${chartStyles.placementRequest}`} style={{ width: `${requestPct}%` }} />
                  <div className={`${chartStyles.placementSegment} ${chartStyles.placementPlay}`} style={{ width: `${playPct}%` }} />
                  {clickPct > 0 ? (
                    <div className={`${chartStyles.placementSegment} ${chartStyles.placementClick}`} style={{ left: `${playPct}%`, width: `${clickPct}%` }} />
                  ) : null}
                </div>
                <div className={chartStyles.placementStats}>
                  <span>{row.requests} 请求</span>
                  <span>{row.plays} 播放</span>
                  <span>{row.clicks} 点击</span>
                  <span>{row.rewards} 发奖</span>
                </div>
              </div>
              <div className={chartStyles.levelCompareDelta}>
                <div>{row.clickRate.toFixed(1)}%</div>
                <div className={chartStyles.funnelMeta}>发奖 {row.rewardRate.toFixed(1)}%</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={chartStyles.compareLegend}>
        <span className={chartStyles.compareLegendItem}>
          <span className={chartStyles.legendSwatch} style={{ background: "rgba(91, 140, 255, 0.22)" }} />
          请求
        </span>
        <span className={chartStyles.compareLegendItem}>
          <span className={chartStyles.legendSwatch} style={{ background: "rgba(31, 154, 133, 0.9)" }} />
          播放
        </span>
        <span className={chartStyles.compareLegendItem}>
          <span className={chartStyles.legendSwatch} style={{ background: "rgba(198, 146, 35, 0.95)" }} />
          点击
        </span>
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
