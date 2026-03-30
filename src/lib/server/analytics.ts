import { categories, chartSeries } from "@/data/mock-data";

import { getImportsForProject, getLatestImportForProject, getMetricSnapshotsForProject } from "./imports";

type CategoryKey = "system" | "onboarding" | "level" | "monetization" | "ads" | "custom";
type RankedItem = { name: string; count: number; meta?: string };
type ImportCategorySummary = {
  metrics: Record<string, number>;
  main: number[];
  aux: number[];
  auxLabels: string[];
  ranking: RankedItem[];
  insight: string;
};

type ImportSummary = {
  topEvents?: RankedItem[];
  topPlacements?: RankedItem[];
  topLevels?: RankedItem[];
  failReasons?: RankedItem[];
  categories?: Partial<Record<CategoryKey, ImportCategorySummary>>;
  overview?: {
    activeUsers?: number;
    healthScore?: number;
    keyAnomalyCount?: number;
    monetizationValue?: number;
  };
};

const fallbackConfig = {
  system: {
    title: "公共事件看板",
    color: "var(--blue)",
    metrics: [
      { label: "活跃设备", value: "18.2k" },
      { label: "总事件量", value: "124k" },
      { label: "有效会话率", value: "81.4%" },
      { label: "异常占比", value: "2.1%" }
    ],
    main: chartSeries.onboardingMain,
    trend: chartSeries.onboardingTrend,
    aux: chartSeries.monetizationMix,
    auxLabels: ["启动", "后台", "设置", "退出"],
    ranking: [
      ["session_start", "本批次占比最高"],
      ["session_end", "结束率稳定"],
      ["settings_open", "较上版本提升 12%"]
    ],
    insight: "公共事件层面没有出现新的结构性异常，可以继续作为版本比较的基线，帮助判断问题是否来自具体玩法模块。"
  },
  onboarding: {
    title: "新手引导看板",
    color: "var(--green)",
    metrics: [
      { label: "首步到达率", value: "94.2%" },
      { label: "引导完成率", value: "58.1%" },
      { label: "中途流失率", value: "12.3%" },
      { label: "平均完成时长", value: "2.4 分钟" }
    ],
    main: chartSeries.onboardingMain,
    trend: chartSeries.onboardingTrend,
    aux: chartSeries.onboardingDuration,
    auxLabels: ["步骤 1", "步骤 2", "步骤 3", "步骤 4", "步骤 5", "步骤 6"],
    ranking: [
      ["步骤 4", "完成率下降 9.3%"],
      ["步骤 5", "平均耗时提升 18%"],
      ["步骤 2", "整体稳定"]
    ],
    insight: "引导第 4 步的完成率和耗时同时恶化，更像理解成本变高而不是单点埋点异常，建议优先回看文案与提示位置。"
  },
  level: {
    title: "关卡事件看板",
    color: "var(--amber)",
    metrics: [
      { label: "关卡开局率", value: "88.6%" },
      { label: "平均通关率", value: "49.2%" },
      { label: "平均失败率", value: "37.4%" },
      { label: "平均重试次数", value: "3.2" }
    ],
    main: chartSeries.levelMain,
    trend: chartSeries.levelTrend,
    aux: chartSeries.levelFailReason,
    auxLabels: ["误触", "资源耗尽", "超时", "道具失误", "退出"],
    ranking: [
      ["关卡 12", "失败率 41%"],
      ["关卡 9", "平均重试 3.8 次"],
      ["关卡 4", "通关稳定"]
    ],
    insight: "关卡 12 的失败原因集中在道具误用与短暂停顿，说明玩家并不是不会玩，而是缺少一个更及时的操作引导。"
  },
  monetization: {
    title: "商业化看板",
    color: "var(--gold)",
    metrics: [
      { label: "首日付费转化", value: "8.7%" },
      { label: "广告触达率", value: "42.4%" },
      { label: "广告完成率", value: "76.3%" },
      { label: "价值事件量", value: "1.9k" }
    ],
    main: chartSeries.monetizationMain,
    trend: chartSeries.monetizationTrend,
    aux: chartSeries.monetizationMix,
    auxLabels: ["首充", "礼包", "激励视频", "插屏"],
    ranking: [
      ["首充礼包", "转化率 4.1%"],
      ["激励视频", "完成率 76.3%"],
      ["限时礼包", "展示后流失较低"]
    ],
    insight: "当前付费弹窗和广告位没有明显相互挤压，商业化节奏整体健康，适合小幅试探提升曝光而不是大改策略。"
  },
  ads: {
    title: "广告事件看板",
    color: "var(--violet)",
    metrics: [
      { label: "广告触发率", value: "42.4%" },
      { label: "播放完成率", value: "76.3%" },
      { label: "奖励领取率", value: "71.8%" },
      { label: "中途关闭率", value: "8.9%" }
    ],
    main: chartSeries.monetizationMain,
    trend: chartSeries.monetizationTrend,
    aux: chartSeries.monetizationMix,
    auxLabels: ["激励视频", "插屏", "Banner", "开屏"],
    ranking: [
      ["激励视频", "完成率最高"],
      ["插屏广告", "中途关闭率偏高"],
      ["Banner", "对主流程影响较低"]
    ],
    insight: "广告整体完成率不错，但插屏在关卡结束后的承接略硬，建议先做一次时机 A/B，而不是直接增加频次。"
  },
  custom: {
    title: "自定义分类看板",
    color: "var(--teal)",
    metrics: [
      { label: "自定义事件数", value: "14" },
      { label: "字段覆盖率", value: "87.5%" },
      { label: "分析可用率", value: "92.3%" },
      { label: "待补异常标签", value: "5" }
    ],
    main: chartSeries.levelMain,
    trend: chartSeries.levelTrend,
    aux: chartSeries.levelFailReason,
    auxLabels: ["任务", "社交", "活动", "成就", "资源"],
    ranking: [
      ["activity_join", "活动参与率较高"],
      ["resource_shortage", "资源焦虑明显"],
      ["mission_claim", "领取链路顺畅"]
    ],
    insight: "自定义分类已经覆盖了活动和资源系统的核心行为，当前字段完整性足够支撑专项分析，但异常标签还需要补齐。"
  }
} as const;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function metricLookup(snapshots: Array<{ metricKey: string; metricValue: number }>) {
  const map = new Map<string, number>();
  snapshots.forEach((item) => {
    if (!map.has(item.metricKey)) {
      map.set(item.metricKey, item.metricValue);
    }
  });
  return (key: string, fallback = 0) => map.get(key) ?? fallback;
}

function buildFallbackTrend(base: number, spread = 8) {
  const safeBase = Math.max(6, Math.min(94, base));

  return Array.from({ length: 7 }, (_, index) => {
    const drift = (index - 3) * 1.8;
    const wave = ((index % 2 === 0 ? -1 : 1) * spread) / 4;
    return clampPercent(safeBase + drift + wave);
  });
}

function formatMetric(value: number, suffix = "%") {
  return `${value.toFixed(1)}${suffix}`;
}

function normalizeSeries(values: number[], minLength = 4) {
  const filtered = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (!filtered.length) {
    return Array.from({ length: minLength }, () => 0);
  }

  const max = Math.max(...filtered, 1);
  const normalized = filtered.map((value) => clampPercent((value / max) * 100));
  return normalized.length >= minLength ? normalized : [...normalized, ...Array.from({ length: minLength - normalized.length }, () => 0)];
}

function normalizeDistribution(values: number[]) {
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0);
  if (!total) {
    return values.map(() => 0);
  }
  return values.map((value) => clampPercent((Math.max(value, 0) / total) * 100));
}

function buildRanking(values: RankedItem[] | undefined, emptyLabel: string, suffix: string) {
  if (!values?.length) {
    return [[emptyLabel, "等待首批日志或模拟数据"]] as Array<[string, string]>;
  }

  return values.slice(0, 5).map((item) => [item.name, item.meta ?? `${item.count}${suffix}`] as [string, string]);
}

function buildRecentTrend(
  snapshots: Array<{ metricKey: string; metricValue: number }>,
  metricKey: string,
  fallback: number[]
) {
  const values = snapshots
    .filter((item) => item.metricKey === metricKey)
    .map((item) => item.metricValue)
    .slice(0, 7)
    .reverse();

  if (!values.length) {
    return fallback;
  }

  if (values.length === 1) {
    return buildFallbackTrend(values[0], 6);
  }

  return normalizeSeries(values, 7);
}

function sourceLabel(source: string | null | undefined) {
  return source === "SYNTHETIC" ? "Synthetic 数据" : "真实数据";
}

function metricCard(label: string, current: string, compare?: string | null) {
  return {
    label,
    value: current,
    compareValue: compare ?? null
  };
}

function versionDelta(current: number, compare: number | null | undefined, suffix = "%") {
  if (compare === null || compare === undefined) {
    return null;
  }
  const delta = current - compare;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}${suffix}`;
}

function resolveCompareImport(
  imports: Array<{ version: string; uploadedAt?: Date | number; summaryJson?: unknown }>,
  currentVersion: string,
  compareVersion?: string | null
) {
  if (compareVersion) {
    return imports.find((item) => item.version === compareVersion) ?? null;
  }

  return imports.find((item) => item.version !== currentVersion) ?? null;
}

function emptyCompareSeries(values: number[]) {
  return values.map(() => 0);
}

export async function getAnalyticsCategoryData(
  category: CategoryKey,
  projectId?: string | null,
  compareVersion?: string | null
) {
  const fallback = fallbackConfig[category];

  if (!projectId) {
    return {
      ...fallback,
      categories,
      source: "fallback",
      sourceLabel: "演示数据",
      versionLabel: "未导入"
    };
  }

  const latestImport = await getLatestImportForProject(projectId);

  if (!latestImport) {
    return {
      ...fallback,
      categories,
      source: "fallback",
      sourceLabel: "演示数据",
      versionLabel: "未导入"
    };
  }

  const allImports = await getImportsForProject(projectId);
  const compareImport = resolveCompareImport(allImports, latestImport.version, compareVersion);
  const versionOptions = [...new Set(allImports.map((item) => item.version))];

  const [currentSnapshots, allSnapshots, compareSnapshots] = await Promise.all([
    getMetricSnapshotsForProject(projectId, latestImport.version),
    getMetricSnapshotsForProject(projectId),
    compareImport ? getMetricSnapshotsForProject(projectId, compareImport.version) : Promise.resolve([])
  ]);

  const summary = (latestImport.summaryJson ?? {}) as ImportSummary;
  const categorySummary = summary.categories?.[category];
  const compareSummary = (compareImport?.summaryJson ?? {}) as ImportSummary;
  const compareCategorySummary = compareSummary.categories?.[category];

  if (!currentSnapshots.length || !categorySummary) {
    return {
      ...fallback,
      categories,
      source: latestImport.source,
      sourceLabel: sourceLabel(latestImport.source),
      versionLabel: latestImport.version
    };
  }

  const getMetric = metricLookup(currentSnapshots);
  const getCompareMetric = metricLookup(compareSnapshots);
  const base = {
    title: fallback.title,
    color: fallback.color,
    categories,
    source: latestImport.source,
    sourceLabel: sourceLabel(latestImport.source),
    versionLabel: latestImport.version,
    compareVersionLabel: compareImport?.version ?? null,
    versionOptions
  };

  if (category === "system") {
    const validRate = getMetric("system_valid_rate", getMetric("import_success_rate"));
    const compareValidRate = compareImport
      ? getCompareMetric("system_valid_rate", getCompareMetric("import_success_rate"))
      : null;
    const errorRate = getMetric("system_error_rate");
    const compareErrorRate = compareImport ? getCompareMetric("system_error_rate") : null;

    return {
      ...base,
      metrics: [
        metricCard("活跃用户", getMetric("active_users").toFixed(0), compareImport ? getCompareMetric("active_users").toFixed(0) : null),
        metricCard("公共事件量", getMetric("system_event_count").toFixed(0), compareImport ? getCompareMetric("system_event_count").toFixed(0) : null),
        metricCard("有效会话率", formatMetric(validRate), compareValidRate !== null ? formatMetric(compareValidRate) : null),
        metricCard("异常占比", formatMetric(errorRate), compareErrorRate !== null ? formatMetric(compareErrorRate) : null)
      ],
      main: normalizeSeries(categorySummary.main),
      compareMain: compareCategorySummary ? normalizeSeries(compareCategorySummary.main) : emptyCompareSeries(normalizeSeries(categorySummary.main)),
      trend: buildRecentTrend(allSnapshots, "system_valid_rate", fallback.trend),
      compareTrend: compareImport
        ? buildRecentTrend(compareSnapshots, "system_valid_rate", fallback.trend)
        : emptyCompareSeries(buildRecentTrend(allSnapshots, "system_valid_rate", fallback.trend)),
      aux: normalizeDistribution(categorySummary.aux),
      auxLabels: categorySummary.auxLabels.length ? categorySummary.auxLabels : fallback.auxLabels,
      ranking: buildRanking(categorySummary.ranking, "公共事件", " 次"),
      insight:
        compareImport && compareValidRate !== null
          ? `${categorySummary.insight} 与 ${compareImport.version} 相比，有效会话率 ${versionDelta(validRate, compareValidRate)}，异常占比 ${versionDelta(errorRate, compareErrorRate)}。`
          : categorySummary.insight
    };
  }

  if (category === "onboarding") {
    const reach = getMetric("onboarding_reach_rate");
    const compareReach = compareImport ? getCompareMetric("onboarding_reach_rate") : null;
    const completion = getMetric("onboarding_completion_rate");
    const compareCompletion = compareImport ? getCompareMetric("onboarding_completion_rate") : null;
    const drop = getMetric("onboarding_drop_rate");
    const compareDrop = compareImport ? getCompareMetric("onboarding_drop_rate") : null;
    const avgDuration = getMetric("onboarding_avg_duration");
    const compareDuration = compareImport ? getCompareMetric("onboarding_avg_duration") : null;

    return {
      ...base,
      metrics: [
        metricCard("首步到达率", formatMetric(reach), compareReach !== null ? formatMetric(compareReach) : null),
        metricCard("引导完成率", formatMetric(completion), compareCompletion !== null ? formatMetric(compareCompletion) : null),
        metricCard("中途流失率", formatMetric(drop), compareDrop !== null ? formatMetric(compareDrop) : null),
        metricCard("平均完成时长", `${avgDuration.toFixed(1)} 秒`, compareDuration !== null ? `${compareDuration.toFixed(1)} 秒` : null)
      ],
      main: normalizeSeries(categorySummary.main, 6),
      compareMain: compareCategorySummary ? normalizeSeries(compareCategorySummary.main, 6) : emptyCompareSeries(normalizeSeries(categorySummary.main, 6)),
      trend: buildRecentTrend(allSnapshots, "onboarding_completion_rate", fallback.trend),
      compareTrend: compareImport
        ? buildRecentTrend(compareSnapshots, "onboarding_completion_rate", fallback.trend)
        : emptyCompareSeries(buildRecentTrend(allSnapshots, "onboarding_completion_rate", fallback.trend)),
      aux: normalizeSeries(categorySummary.aux, 6),
      auxLabels: categorySummary.auxLabels.length ? categorySummary.auxLabels : fallback.auxLabels,
      ranking: buildRanking(categorySummary.ranking, "引导步骤", " 次"),
      insight:
        compareImport && compareCompletion !== null
          ? `${categorySummary.insight} 与 ${compareImport.version} 相比，引导完成率 ${versionDelta(completion, compareCompletion)}，流失率 ${versionDelta(drop, compareDrop)}。`
          : categorySummary.insight
    };
  }

  if (category === "level") {
    const start = getMetric("level_start_rate");
    const compareStart = compareImport ? getCompareMetric("level_start_rate") : null;
    const completion = getMetric("level_completion_rate");
    const compareCompletion = compareImport ? getCompareMetric("level_completion_rate") : null;
    const fail = getMetric("level_fail_rate");
    const compareFail = compareImport ? getCompareMetric("level_fail_rate") : null;
    const retry = getMetric("level_retry_avg");
    const compareRetry = compareImport ? getCompareMetric("level_retry_avg") : null;

    return {
      ...base,
      metrics: [
        metricCard("关卡开局率", formatMetric(start), compareStart !== null ? formatMetric(compareStart) : null),
        metricCard("平均通关率", formatMetric(completion), compareCompletion !== null ? formatMetric(compareCompletion) : null),
        metricCard("平均失败率", formatMetric(fail), compareFail !== null ? formatMetric(compareFail) : null),
        metricCard("平均重试次数", retry.toFixed(1), compareRetry !== null ? compareRetry.toFixed(1) : null)
      ],
      main: normalizeSeries(categorySummary.main),
      compareMain: compareCategorySummary ? normalizeSeries(compareCategorySummary.main) : emptyCompareSeries(normalizeSeries(categorySummary.main)),
      trend: buildRecentTrend(allSnapshots, "level_completion_rate", fallback.trend),
      compareTrend: compareImport
        ? buildRecentTrend(compareSnapshots, "level_completion_rate", fallback.trend)
        : emptyCompareSeries(buildRecentTrend(allSnapshots, "level_completion_rate", fallback.trend)),
      aux: categorySummary.aux,
      auxLabels: categorySummary.auxLabels.length ? categorySummary.auxLabels : fallback.auxLabels,
      ranking: buildRanking(categorySummary.ranking, "关卡", " 次"),
      insight:
        compareImport && compareCompletion !== null
          ? `${categorySummary.insight} 与 ${compareImport.version} 相比，通关率 ${versionDelta(completion, compareCompletion)}，失败率 ${versionDelta(fail, compareFail)}。`
          : categorySummary.insight
    };
  }

  if (category === "monetization") {
    const conversion = getMetric("monetization_conversion_rate");
    const compareConversion = compareImport ? getCompareMetric("monetization_conversion_rate") : null;
    const eventCount = getMetric("monetization_event_count");
    const compareEventCount = compareImport ? getCompareMetric("monetization_event_count") : null;
    const adCompletion = getMetric("ad_completion_rate");
    const compareAdCompletion = compareImport ? getCompareMetric("ad_completion_rate") : null;
    const value = getMetric("monetization_value");
    const compareValue = compareImport ? getCompareMetric("monetization_value") : null;

    return {
      ...base,
      metrics: [
        metricCard("商业化转化率", formatMetric(conversion), compareConversion !== null ? formatMetric(compareConversion) : null),
        metricCard("商业化事件数", eventCount.toFixed(0), compareEventCount !== null ? compareEventCount.toFixed(0) : null),
        metricCard("广告完成率", formatMetric(adCompletion), compareAdCompletion !== null ? formatMetric(compareAdCompletion) : null),
        metricCard("价值事件金额", value.toFixed(2), compareValue !== null ? compareValue.toFixed(2) : null)
      ],
      main: normalizeSeries(categorySummary.main),
      compareMain: compareCategorySummary ? normalizeSeries(compareCategorySummary.main) : emptyCompareSeries(normalizeSeries(categorySummary.main)),
      trend: buildRecentTrend(allSnapshots, "monetization_conversion_rate", fallback.trend),
      compareTrend: compareImport
        ? buildRecentTrend(compareSnapshots, "monetization_conversion_rate", fallback.trend)
        : emptyCompareSeries(buildRecentTrend(allSnapshots, "monetization_conversion_rate", fallback.trend)),
      aux: categorySummary.aux,
      auxLabels: categorySummary.auxLabels.length ? categorySummary.auxLabels : fallback.auxLabels,
      ranking: buildRanking(categorySummary.ranking, "商业化事件", " 次"),
      insight:
        compareImport && compareConversion !== null
          ? `${categorySummary.insight} 与 ${compareImport.version} 相比，商业化转化率 ${versionDelta(conversion, compareConversion)}，价值事件金额 ${versionDelta(value, compareValue, "")}。`
          : categorySummary.insight
    };
  }

  if (category === "ads") {
    const trigger = getMetric("ad_trigger_rate");
    const compareTrigger = compareImport ? getCompareMetric("ad_trigger_rate") : null;
    const completion = getMetric("ad_completion_rate");
    const compareCompletion = compareImport ? getCompareMetric("ad_completion_rate") : null;
    const reward = getMetric("ad_reward_rate");
    const compareReward = compareImport ? getCompareMetric("ad_reward_rate") : null;
    const closeRate = 100 - completion;
    const compareCloseRate = compareImport ? 100 - getCompareMetric("ad_completion_rate") : null;

    return {
      ...base,
      metrics: [
        metricCard("广告触发率", formatMetric(trigger), compareTrigger !== null ? formatMetric(compareTrigger) : null),
        metricCard("播放完成率", formatMetric(completion), compareCompletion !== null ? formatMetric(compareCompletion) : null),
        metricCard("奖励领取率", formatMetric(reward), compareReward !== null ? formatMetric(compareReward) : null),
        metricCard("中途关闭率", formatMetric(closeRate), compareCloseRate !== null ? formatMetric(compareCloseRate) : null)
      ],
      main: normalizeSeries(categorySummary.main),
      compareMain: compareCategorySummary ? normalizeSeries(compareCategorySummary.main) : emptyCompareSeries(normalizeSeries(categorySummary.main)),
      trend: buildRecentTrend(allSnapshots, "ad_completion_rate", fallback.trend),
      compareTrend: compareImport
        ? buildRecentTrend(compareSnapshots, "ad_completion_rate", fallback.trend)
        : emptyCompareSeries(buildRecentTrend(allSnapshots, "ad_completion_rate", fallback.trend)),
      aux: categorySummary.aux,
      auxLabels: categorySummary.auxLabels.length ? categorySummary.auxLabels : fallback.auxLabels,
      ranking: buildRanking(categorySummary.ranking, "广告位", " 次"),
      insight:
        compareImport && compareCompletion !== null
          ? `${categorySummary.insight} 与 ${compareImport.version} 相比，广告完成率 ${versionDelta(completion, compareCompletion)}，关闭率 ${versionDelta(closeRate, compareCloseRate)}。`
          : categorySummary.insight
    };
  }

  const coverageRate = categorySummary.metrics.coverageRate ?? getMetric("import_success_rate");
  const compareCoverageRate = compareImport ? getCompareMetric("import_success_rate") : null;
  const usableRate = categorySummary.metrics.usableRate ?? getMetric("import_success_rate");
  const compareUsableRate = compareImport ? getCompareMetric("import_success_rate") : null;
  const eventCount = categorySummary.metrics.eventCount ?? ((summary.topEvents ?? []).length || 0);
  const compareEventCount = compareCategorySummary?.metrics.eventCount ?? ((compareSummary.topEvents ?? []).length || 0);
  const anomalyCount = categorySummary.metrics.anomalyCount ?? ((summary.failReasons ?? []).length || 0);
  const compareAnomalyCount = compareCategorySummary?.metrics.anomalyCount ?? ((compareSummary.failReasons ?? []).length || 0);

  return {
    ...base,
    metrics: [
      {
        label: "自定义事件数",
        value: String(eventCount),
        compareValue: compareImport ? String(compareEventCount) : null
      },
      { label: "字段覆盖率", value: formatMetric(coverageRate), compareValue: compareCoverageRate !== null ? formatMetric(compareCoverageRate) : null },
      { label: "分析可用率", value: formatMetric(usableRate), compareValue: compareUsableRate !== null ? formatMetric(compareUsableRate) : null },
      {
        label: "待补异常标签",
        value: String(anomalyCount),
        compareValue: compareImport ? String(compareAnomalyCount) : null
      }
    ],
    main: normalizeSeries(categorySummary.main),
    compareMain: compareCategorySummary ? normalizeSeries(compareCategorySummary.main) : emptyCompareSeries(normalizeSeries(categorySummary.main)),
    trend: buildRecentTrend(allSnapshots, "import_success_rate", fallback.trend),
    compareTrend: compareImport
      ? buildRecentTrend(compareSnapshots, "import_success_rate", fallback.trend)
      : emptyCompareSeries(buildRecentTrend(allSnapshots, "import_success_rate", fallback.trend)),
    aux: categorySummary.aux.length ? categorySummary.aux : fallback.aux,
    auxLabels: categorySummary.auxLabels.length ? categorySummary.auxLabels : fallback.auxLabels,
    ranking: buildRanking(categorySummary.ranking, "自定义事件", " 次"),
    insight:
      compareImport
        ? `${categorySummary.insight} 与 ${compareImport.version} 相比，字段覆盖率 ${versionDelta(coverageRate, compareCoverageRate)}。`
        : categorySummary.insight
  };
}
