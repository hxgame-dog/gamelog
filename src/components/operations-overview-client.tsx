"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { OperationsOverviewData } from "@/lib/server/analytics";

export function OperationsOverviewClient({
  overview
}: {
  overview: OperationsOverviewData;
}) {
  const router = useRouter();
  const recommendedModules = overview.hasInference
    ? overview.moduleCards.filter((card) => card.key === "monetization" || card.key === "ads")
    : overview.moduleCards.slice(0, 2);
  const importVersionById = new Map(
    overview.importOptions.map((item) => {
      const match = item.label.match(/\/ v(.+)$/);
      return [item.id, match?.[1] ?? null] as const;
    })
  );

  function buildOverviewHref(overrides?: {
    compareVersion?: string | null;
    currentImportId?: string | null;
  }) {
    const params = new URLSearchParams();

    if (overview.projectId) {
      params.set("projectId", overview.projectId);
    }
    const nextCompareVersion = overrides && "compareVersion" in overrides
      ? overrides.compareVersion
      : overview.compareVersionLabel;
    if (nextCompareVersion) {
      params.set("compareVersion", nextCompareVersion);
    }
    const nextImportId = overrides && "currentImportId" in overrides
      ? overrides.currentImportId
      : overview.currentImportId;
    if (nextImportId) {
      params.set("importId", nextImportId);
    }

    const query = params.toString();
    return `/analytics${query ? `?${query}` : ""}`;
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section
        className="panel"
        style={{
          padding: 22,
          display: "grid",
          gap: 18,
          background:
            "linear-gradient(135deg, rgba(91, 140, 255, 0.08) 0%, rgba(31, 154, 133, 0.08) 100%), var(--panel)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pill">{overview.sourceLabel}</span>
              <span className="pill">当前版本 {overview.versionLabel}</span>
              {overview.currentImportId ? <span className="pill">按导入批次查看</span> : null}
              {overview.compareVersionLabel ? <span className="pill">对比 {overview.compareVersionLabel}</span> : null}
            </div>
            <div>
              <h2 className="section-title" style={{ fontSize: 20 }}>
                当前批次质量总览
              </h2>
              <p className="section-copy" style={{ marginTop: 6 }}>
                先确认技术与业务质量，再决定应该优先阅读哪个业务模块，避免一上来陷入局部图表。
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {overview.importOptions.length ? (
              <select
                className="button-secondary"
                aria-label="切换导入批次"
                value={overview.currentImportId ?? overview.importOptions[0]?.id ?? ""}
                onChange={(event) => {
                  const nextImportId = event.target.value || null;
                  const nextVersion = nextImportId ? importVersionById.get(nextImportId) ?? null : null;
                  const nextCompareVersion = !overview.compareVersionLabel
                    ? null
                    : overview.compareVersionLabel === nextVersion
                      ? null
                      : overview.versionOptions.includes(overview.compareVersionLabel)
                        ? overview.compareVersionLabel
                        : null;

                  router.push(
                    buildOverviewHref({
                      currentImportId: nextImportId,
                      compareVersion: nextCompareVersion
                    })
                  );
                }}
              >
                {overview.importOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            ) : null}

            {overview.compareVersionLabel ? (
              <Link className="button-secondary" href={buildOverviewHref({ compareVersion: null })}>
                取消版本对比
              </Link>
            ) : null}

            {overview.versionOptions
              .filter((version) => version !== overview.versionLabel)
              .slice(0, 4)
              .map((version) => (
                <Link key={version} className="button-secondary" href={buildOverviewHref({ compareVersion: version })}>
                  对比 {version}
                </Link>
              ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14
          }}
        >
          {[
            {
              label: "技术通过率",
              value: `${overview.technicalSuccessRate.toFixed(1)}%`,
              tone: "var(--green)",
              note: "用于先判断这批日志能否直接支撑分析。"
            },
            {
              label: "技术异常",
              value: `${overview.technicalErrorCount}`,
              tone: "var(--red)",
              note: "技术异常偏高时，先回看导入和底层事件口径。"
            },
            {
              label: "业务失败事件",
              value: `${overview.businessFailureCount}`,
              tone: "var(--amber)",
              note: "业务失败越集中，越适合优先进入业务模块页。"
            },
            {
              label: "模块覆盖率",
              value: `${overview.moduleCoverage.toFixed(1)}%`,
              tone: "var(--blue)",
              note: "覆盖率越高，越适合做版本差异判断。"
            }
          ].map((card) => (
            <div
              key={card.label}
              className="surface"
              style={{
                padding: 16,
                display: "grid",
                gap: 8,
                background: "rgba(252, 252, 251, 0.92)"
              }}
            >
              <span className="pill" style={{ width: "fit-content", color: card.tone }}>
                {card.label}
              </span>
              <div
                style={{
                  fontFamily: "var(--font-number)",
                  fontSize: 32,
                  lineHeight: 1,
                  fontWeight: 700,
                  color: "var(--title)"
                }}
              >
                {card.value}
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>{card.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="panel"
        style={{
          padding: 18,
          display: "grid",
          gap: 12,
          borderColor: overview.hasInference ? "rgba(201, 137, 44, 0.35)" : "rgba(31, 154, 133, 0.35)",
          background: overview.hasInference
            ? "linear-gradient(135deg, rgba(201, 137, 44, 0.08) 0%, rgba(185, 138, 31, 0.04) 100%), var(--panel)"
            : "linear-gradient(135deg, rgba(31, 154, 133, 0.08) 0%, rgba(40, 164, 107, 0.04) 100%), var(--panel)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pill">{overview.hasInference ? "含推断统计" : "显式统计优先"}</span>
              <span className="pill">
                建议先读: {recommendedModules.map((card) => card.label).join(" / ") || "模块入口"}
              </span>
            </div>
            <h2 className="section-title" style={{ fontSize: 18 }}>
              数据可信度提示
            </h2>
          </div>
        </div>
        <p className="section-copy" style={{ maxWidth: "none", marginTop: 0 }}>
          {overview.hasInference
            ? "当前批次包含部分推断统计，优先将结论当作运营信号而不是最终定论，建议结合商业化与广告模块的结构图再做判断。"
            : "当前批次以显式日志链路为主，适合直接按模块查看异常与版本差异，优先从业务失败或流失最集中的模块开始。"}
        </p>
      </section>

      <section style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {overview.moduleCards.map((card, index) => (
          <Link
            key={card.key}
            href={card.href}
            className="panel"
            style={{
              padding: 18,
              display: "grid",
              gap: 12,
              background:
                index === 0
                  ? "linear-gradient(180deg, rgba(40, 164, 107, 0.08) 0%, var(--panel) 100%)"
                  : index === 1
                    ? "linear-gradient(180deg, rgba(201, 137, 44, 0.08) 0%, var(--panel) 100%)"
                    : index === 2
                      ? "linear-gradient(180deg, rgba(185, 138, 31, 0.08) 0%, var(--panel) 100%)"
                      : "linear-gradient(180deg, rgba(122, 103, 232, 0.08) 0%, var(--panel) 100%)"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start"
              }}
            >
              <div>
                <div className="pill" style={{ width: "fit-content", marginBottom: 10 }}>
                  模块入口
                </div>
                <h2 className="section-title" style={{ fontSize: 18 }}>
                  {card.label}
                </h2>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 14 }}>查看详情</span>
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.7 }}>{card.summary}</p>
            <div
              className="surface"
              style={{
                padding: 14,
                display: "grid",
                gap: 8,
                background: "rgba(252, 252, 251, 0.96)"
              }}
            >
              <strong style={{ fontSize: 15 }}>{card.primaryMetric}</strong>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
                当前最值得优先追踪的异常: {card.anomaly}
              </p>
            </div>
          </Link>
        ))}
      </section>

      <section className="panel" style={{ padding: 18, display: "grid", gap: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <div>
            <h2 className="section-title" style={{ fontSize: 18 }}>
              异常优先入口
            </h2>
            <p className="section-copy" style={{ marginTop: 6 }}>
              不从图表海里找问题，直接从最强异常信号切入对应模块页。
            </p>
          </div>
          <span className="pill">{overview.anomalyShortcuts.length} 条快捷入口</span>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {overview.anomalyShortcuts.map((shortcut) => (
            <Link
              key={shortcut.label}
              href={shortcut.href}
              className="surface"
              style={{
                padding: "14px 16px",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center"
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1.6 }}>{shortcut.label}</span>
              <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>进入模块</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
