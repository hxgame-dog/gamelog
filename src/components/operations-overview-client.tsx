"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import styles from "@/components/operations-overview.module.css";
import type { OperationsOverviewData } from "@/lib/server/analytics";

export function OperationsOverviewClient({
  overview
}: {
  overview: OperationsOverviewData;
}) {
  const router = useRouter();
  const importVersionById = new Map(
    overview.importOptions.map((item) => {
      const match = item.label.match(/\/ v(.+)$/);
      return [item.id, match?.[1] ?? null] as const;
    })
  );

  const recommendedModules = overview.hasInference
    ? overview.moduleCards.filter((card) => card.key === "monetization" || card.key === "ads")
    : overview.moduleCards.slice(0, 4);

  function buildImportPreviewHref() {
    if (!overview.projectId || !overview.currentImportId) {
      return null;
    }

    const params = new URLSearchParams();
    params.set("projectId", overview.projectId);
    params.set("importId", overview.currentImportId);

    if (overview.compareVersionLabel) {
      params.set("compareVersion", overview.compareVersionLabel);
    }

    return `/imports?${params.toString()}`;
  }

  function buildOverviewHref(overrides?: {
    compareVersion?: string | null;
    currentImportId?: string | null;
  }) {
    const params = new URLSearchParams();

    if (overview.projectId) {
      params.set("projectId", overview.projectId);
    }

    const nextCompareVersion =
      overrides && "compareVersion" in overrides ? overrides.compareVersion : overview.compareVersionLabel;
    const nextImportId =
      overrides && "currentImportId" in overrides ? overrides.currentImportId : overview.currentImportId;

    if (nextCompareVersion) {
      params.set("compareVersion", nextCompareVersion);
    }
    if (nextImportId) {
      params.set("importId", nextImportId);
    }

    const query = params.toString();
    return `/analytics${query ? `?${query}` : ""}`;
  }

  const qualityCards = [
    {
      label: "技术通过率",
      value: `${overview.technicalSuccessRate.toFixed(1)}%`,
      note: "用于先判断这批日志能否直接支撑运营分析。"
    },
    {
      label: "技术异常",
      value: `${overview.technicalErrorCount}`,
      note: "技术异常偏高时，先回看导入映射、时间字段和事件归一化。"
    },
    {
      label: "业务失败事件",
      value: `${overview.businessFailureCount}`,
      note: "这里是业务结果信号，不代表导入失败，适合反推真正的问题模块。"
    },
    {
      label: "模块覆盖率",
      value: `${overview.moduleCoverage.toFixed(1)}%`,
      note: "覆盖率越高，越适合做版本差异判断和跨模块联动分析。"
    }
  ];
  const importPreviewHref = buildImportPreviewHref();

  return (
    <div className={styles.page}>
      <section className={`panel ${styles.hero}`}>
        <div className={styles.heroTop}>
          <div className={styles.heroCopy}>
            <div className={styles.badgeRow}>
              <span className="pill">{overview.sourceLabel}</span>
              <span className="pill">当前版本 {overview.versionLabel}</span>
              {overview.currentImportId ? <span className="pill">按导入批次查看</span> : null}
              {overview.compareVersionLabel ? <span className="pill">对比 {overview.compareVersionLabel}</span> : null}
            </div>
            <div>
              <h2 className={styles.heroTitle}>当前批次质量总览</h2>
              <p className={styles.heroText}>
                先看导入质量，再进入真正值得优先审查的运营模块。这页不再试图把所有图表都塞在一起，而是先帮你确认这批数据能不能用、该先看哪一块、每个模块最值得优先追的异常是什么。
              </p>
            </div>
          </div>

          <div className={styles.controlRow}>
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
                      : overview.compareVersionLabel;

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

            {importPreviewHref ? (
              <Link className="button-secondary" href={importPreviewHref}>
                查看导入预览
              </Link>
            ) : null}

            {overview.versionOptions
              .filter((version) => version !== overview.versionLabel)
              .slice(0, 3)
              .map((version) => (
                <Link key={version} className="button-secondary" href={buildOverviewHref({ compareVersion: version })}>
                  对比 {version}
                </Link>
              ))}
          </div>
        </div>

        <div className={styles.qualityGrid}>
          {qualityCards.map((card) => (
            <article
              key={card.label}
              className={`${styles.qualityCard} ${importPreviewHref ? styles.qualityCardInteractive : ""}`}
            >
              {importPreviewHref ? (
                <Link
                  href={importPreviewHref}
                  className={styles.cardLink}
                  aria-label={`查看${card.label}对应的导入预览`}
                />
              ) : null}
              <div className={styles.qualityLabel}>{card.label}</div>
              <div className={styles.qualityValue}>{card.value}</div>
              <div className={styles.qualityMeta}>{card.note}</div>
            </article>
          ))}
        </div>

        <section className={styles.tipCard}>
          <div className={styles.badgeRow}>
            <span className="pill">{overview.hasInference ? "含推断统计" : "显式统计优先"}</span>
            <span className="pill">
              建议先读: {recommendedModules.map((card) => card.label).join(" / ") || "模块入口"}
            </span>
          </div>
          <h3 className={styles.tipTitle}>数据可信度提示</h3>
          <p className={styles.tipText}>
            {overview.hasInference
              ? "当前批次包含部分推断统计，建议优先把它当成运营线索，再结合商业化和广告模块的结构图交叉确认。"
              : "当前批次主要基于显式日志链路统计，适合直接进入模块页确认流失、失败、转化和广告位表现。"}
          </p>
        </section>
      </section>

      <div className={styles.splitGrid}>
        <section className={`panel ${styles.panelCard}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>四个核心模块</h3>
              <p className={styles.sectionText}>新手引导、关卡与局内行为、商业化、广告，统一按“先结论、再主图、再明细”的顺序进入。</p>
            </div>
            <span className="pill">{overview.moduleCards.length} 个模块</span>
          </div>

          <div className={styles.moduleGrid}>
            {overview.moduleCards.map((card) => (
              <Link key={card.key} href={card.href} className={styles.moduleCard}>
                <div className={styles.moduleTop}>
                  <div>
                    <span className="pill">模块入口</span>
                    <h4 className={styles.moduleTitle}>{card.label}</h4>
                  </div>
                  <span className="pill">进入</span>
                </div>
                <p className={styles.moduleSummary}>{card.summary}</p>
                <div className={styles.metricStrip}>
                  <div className={styles.metricPrimary}>{card.primaryMetric}</div>
                  <div className={styles.metricSecondary}>当前最值得先追的异常: {card.anomaly}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className={`panel ${styles.panelCard}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>建议阅读顺序</h3>
              <p className={styles.sectionText}>入口页先帮你排好顺序，避免一上来在多个模块之间来回切换。</p>
            </div>
            <span className="pill">{recommendedModules.length || overview.moduleCards.length} 步</span>
          </div>

          <div className={styles.readingList}>
            {(recommendedModules.length ? recommendedModules : overview.moduleCards).map((card, index) => (
              <div key={card.key} className={styles.readingItem}>
                <Link
                  href={card.href}
                  className={styles.cardLink}
                  aria-label={`进入${card.label}模块`}
                />
                <span className={styles.readingIndex}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.readingBody}>
                  <h4 className={styles.readingTitle}>{card.label}</h4>
                  <p className={styles.readingText}>{card.anomaly}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={`panel ${styles.panelCard}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>异常优先入口</h3>
            <p className={styles.sectionText}>不从图表海里找问题，直接从最强异常信号跳进对应模块页。</p>
          </div>
          <span className="pill">{overview.anomalyShortcuts.length} 条快捷入口</span>
        </div>

        <div className={styles.shortcutList}>
          {overview.anomalyShortcuts.map((shortcut) => (
            <Link key={shortcut.label} href={shortcut.href} className={styles.shortcutItem}>
              <span className={styles.shortcutLabel}>{shortcut.label}</span>
              <span className={styles.shortcutMeta}>进入模块</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
