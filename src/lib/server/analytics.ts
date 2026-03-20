import { categories, chartSeries } from "@/data/mock-data";

import { getLatestImportForProject, getMetricSnapshotsForProject } from "./imports";

type CategoryKey = "system" | "onboarding" | "level" | "monetization" | "ads" | "custom";

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

function buildTrend(base: number, spread = 8) {
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

function buildRanking(
  values: Array<{ name: string; count: number }>,
  emptyLabel: string,
  suffix: string
) {
  if (!values.length) {
    return [[emptyLabel, "等待首批日志或模拟数据"]] as Array<[string, string]>;
  }

  return values.slice(0, 3).map((item) => [item.name, `${item.count}${suffix}`] as [string, string]);
}

export async function getAnalyticsCategoryData(category: CategoryKey, projectId?: string | null) {
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

  const snapshots = await getMetricSnapshotsForProject(projectId, latestImport.version);
  const getMetric = metricLookup(snapshots);
  const summary = (latestImport.summaryJson ?? {}) as {
    topEvents?: Array<{ name: string; count: number }>;
    topPlacements?: Array<{ name: string; count: number }>;
    topLevels?: Array<{ name: string; count: number }>;
    failReasons?: Array<{ name: string; count: number }>;
  };

  if (!snapshots.length) {
    return {
      ...fallback,
      categories,
      source: latestImport.source,
      sourceLabel: latestImport.source === "SYNTHETIC" ? "Synthetic 数据" : "真实数据",
      versionLabel: latestImport.version
    };
  }

  if (category === "system") {
    const activeUsers = getMetric("active_users");
    const systemEvents = getMetric("system_event_count");
    const validRate = getMetric("import_success_rate");
    const errorRate = clampPercent(100 - validRate);

    return {
      title: fallback.title,
      color: fallback.color,
      metrics: [
        { label: "活跃用户", value: activeUsers.toFixed(0) },
        { label: "公共事件量", value: systemEvents.toFixed(0) },
        { label: "有效会话率", value: formatMetric(validRate) },
        { label: "异常占比", value: formatMetric(errorRate) }
      ],
      main: [activeUsers, systemEvents / 2, validRate, 100 - errorRate].map((item) =>
        clampPercent(item > 100 ? item / Math.max(activeUsers || 1, 1) * 100 : item)
      ),
      trend: buildTrend(validRate, 6),
      aux: (summary.topEvents ?? []).slice(0, 4).map((item) => item.count),
      auxLabels: (summary.topEvents ?? []).slice(0, 4).map((item) => item.name),
      ranking: buildRanking(summary.topEvents ?? [], "公共事件", " 次"),
      insight:
        latestImport.source === "SYNTHETIC"
          ? "当前结果来自模拟数据，适合先验证事件结构和图表布局，再导入真实日志做版本判断。"
          : "公共事件层面的有效率稳定，适合继续作为其他玩法模块的基线参照。",
      categories,
      source: latestImport.source,
      sourceLabel: latestImport.source === "SYNTHETIC" ? "Synthetic 数据" : "真实数据",
      versionLabel: latestImport.version
    };
  }

  if (category === "onboarding") {
    const reach = getMetric("onboarding_reach_rate");
    const complete = getMetric("onboarding_completion_rate");
    const drop = getMetric("onboarding_drop_rate");
    const duration = getMetric("onboarding_avg_duration");

    return {
      title: fallback.title,
      color: fallback.color,
      metrics: [
        { label: "首步到达率", value: formatMetric(reach) },
        { label: "引导完成率", value: formatMetric(complete) },
        { label: "中途流失率", value: formatMetric(drop) },
        { label: "平均完成时长", value: `${duration.toFixed(1)} 秒` }
      ],
      main: [reach, Math.max(complete + 14, 0), complete, Math.max(complete - 12, 0), Math.max(complete - 18, 0), Math.max(complete - 24, 0)].map(clampPercent),
      trend: buildTrend(complete, 10),
      aux: [duration * 0.6, duration * 0.8, duration, duration * 1.1, duration * 1.2, duration * 1.35].map(clampPercent),
      auxLabels: ["步骤 1", "步骤 2", "步骤 3", "步骤 4", "步骤 5", "步骤 6"],
      ranking: buildRanking(summary.topEvents ?? [], "引导步骤", " 次"),
      insight:
        complete < 60
          ? "当前引导完成率偏低，建议优先检查中段步骤说明和点击反馈是否清楚。"
          : "引导链路整体稳定，接下来更适合逐步细化关键步骤的字段定义。",
      categories,
      source: latestImport.source,
      sourceLabel: latestImport.source === "SYNTHETIC" ? "Synthetic 数据" : "真实数据",
      versionLabel: latestImport.version
    };
  }

  if (category === "level") {
    const startRate = getMetric("level_start_rate");
    const complete = getMetric("level_completion_rate");
    const fail = getMetric("level_fail_rate");
    const retry = getMetric("level_retry_avg");

    return {
      title: fallback.title,
      color: fallback.color,
      metrics: [
        { label: "关卡开局率", value: formatMetric(startRate) },
        { label: "平均通关率", value: formatMetric(complete) },
        { label: "平均失败率", value: formatMetric(fail) },
        { label: "平均重试次数", value: retry.toFixed(1) }
      ],
      main: [100, startRate, complete + 12, complete, Math.max(complete - 6, 0), Math.max(complete - 10, 0)].map(clampPercent),
      trend: buildTrend(complete, 9),
      aux: (summary.failReasons ?? []).slice(0, 5).map((item) => item.count),
      auxLabels: (summary.failReasons ?? []).slice(0, 5).map((item) => item.name),
      ranking: buildRanking(summary.topLevels ?? [], "关卡", " 次"),
      insight:
        fail > complete
          ? "关卡失败率高于通关率，适合优先回看失败原因和关键资源点，而不是先调整整体难度曲线。"
          : "关卡主漏斗目前可读性不错，接下来更适合补齐失败原因和重试字段。",
      categories,
      source: latestImport.source,
      sourceLabel: latestImport.source === "SYNTHETIC" ? "Synthetic 数据" : "真实数据",
      versionLabel: latestImport.version
    };
  }

  if (category === "monetization") {
    const conversion = getMetric("monetization_conversion_rate");
    const adTrigger = getMetric("ad_trigger_rate");
    const adCompletion = getMetric("ad_completion_rate");
    const value = getMetric("monetization_value");

    return {
      title: fallback.title,
      color: fallback.color,
      metrics: [
        { label: "商业化转化率", value: formatMetric(conversion) },
        { label: "广告触发率", value: formatMetric(adTrigger) },
        { label: "广告完成率", value: formatMetric(adCompletion) },
        { label: "价值事件金额", value: value.toFixed(2) }
      ],
      main: [100, Math.max(conversion * 2.2, 8), Math.max(conversion, 4), Math.max(conversion * 0.5, 2)].map(clampPercent),
      trend: buildTrend(Math.max(conversion * 1.5, 12), 7),
      aux: [value, getMetric("monetization_event_count"), adTrigger, adCompletion].map(clampPercent),
      auxLabels: ["收入", "付费事件", "广告触发", "广告完成"],
      ranking: buildRanking(summary.topEvents ?? [], "商业化事件", " 次"),
      insight:
        latestImport.source === "SYNTHETIC"
          ? "这批商业化结果来自模拟数据，适合先验证付费和广告事件是否被正确拆解。"
          : "商业化指标已经具备首轮分析价值，下一步建议叠加版本对比观察曝光与转化是否同步变化。",
      categories,
      source: latestImport.source,
      sourceLabel: latestImport.source === "SYNTHETIC" ? "Synthetic 数据" : "真实数据",
      versionLabel: latestImport.version
    };
  }

  if (category === "ads") {
    const trigger = getMetric("ad_trigger_rate");
    const complete = getMetric("ad_completion_rate");
    const reward = getMetric("ad_reward_rate");
    const closeRate = clampPercent(100 - complete);

    return {
      title: fallback.title,
      color: fallback.color,
      metrics: [
        { label: "广告触发率", value: formatMetric(trigger) },
        { label: "播放完成率", value: formatMetric(complete) },
        { label: "奖励领取率", value: formatMetric(reward) },
        { label: "中途关闭率", value: formatMetric(closeRate) }
      ],
      main: [100, trigger, complete, reward].map(clampPercent),
      trend: buildTrend(complete, 8),
      aux: (summary.topPlacements ?? []).slice(0, 4).map((item) => item.count),
      auxLabels: (summary.topPlacements ?? []).slice(0, 4).map((item) => item.name),
      ranking: buildRanking(summary.topPlacements ?? [], "广告位", " 次"),
      insight:
        closeRate > 30
          ? "广告中途关闭率偏高，建议先优化触发时机和承接文案。"
          : "广告完成率表现平稳，可以继续细化不同广告位的分层表现。",
      categories,
      source: latestImport.source,
      sourceLabel: latestImport.source === "SYNTHETIC" ? "Synthetic 数据" : "真实数据",
      versionLabel: latestImport.version
    };
  }

  return {
    title: fallback.title,
    color: fallback.color,
    metrics: [
      { label: "自定义事件数", value: String((summary.topEvents ?? []).length || 0) },
      { label: "字段覆盖率", value: formatMetric(getMetric("import_success_rate")) },
      { label: "分析可用率", value: formatMetric(getMetric("import_success_rate")) },
      { label: "待补异常标签", value: String((summary.failReasons ?? []).length || 0) }
    ],
    main: chartSeries.levelMain,
    trend: buildTrend(getMetric("import_success_rate"), 6),
    aux: chartSeries.levelFailReason,
    auxLabels: ["任务", "活动", "社交", "资源", "其他"],
    ranking: buildRanking(summary.topEvents ?? [], "自定义事件", " 次"),
    insight: "自定义分类已经有了第一批可视化结果，接下来更适合补齐业务语义和专项字段。",
    categories,
    source: latestImport.source,
    sourceLabel: latestImport.source === "SYNTHETIC" ? "Synthetic 数据" : "真实数据",
    versionLabel: latestImport.version
  };
}
