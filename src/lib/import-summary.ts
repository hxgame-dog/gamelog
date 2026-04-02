export type ImportRow = Record<string, string | number | boolean | null>;
export type CategoryKey = "system" | "onboarding" | "level" | "monetization" | "ads" | "custom";
export type RankedItem = { name: string; count: number; meta?: string };
export type CategorySummary = {
  metrics: Record<string, number>;
  main: number[];
  aux: number[];
  auxLabels: string[];
  ranking: RankedItem[];
  insight: string;
};

export type ImportSummary = {
  recordCount: number;
  successRate: number;
  errorCount: number;
  unmatchedEvents: number;
  topEvents: RankedItem[];
  topPlacements: RankedItem[];
  topLevels: RankedItem[];
  failReasons: RankedItem[];
  categories: Record<CategoryKey, CategorySummary>;
  overview: {
    activeUsers: number;
    healthScore: number;
    keyAnomalyCount: number;
    monetizationValue: number;
  };
  metrics: Array<{
    metricKey: string;
    metricLabel: string;
    metricValue: number;
    dimension: string;
  }>;
};

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function toCountRanking(map: Map<string, number>, limit = 5): RankedItem[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function eventLooksSystem(eventName: string) {
  return /(app|session|login|logout|error|crash|install|launch|heartbeat|settings)/i.test(eventName);
}

function eventLooksOnboarding(eventName: string) {
  return /(tutorial|guide|ftue|onboarding|step)/i.test(eventName);
}

function eventLooksLevel(eventName: string) {
  return /(level|battle|stage|mission|round)/i.test(eventName);
}

function eventLooksMonetization(eventName: string) {
  return /(purchase|pay|iap|sku|order|paywall|offer|shop|revenue)/i.test(eventName);
}

function eventLooksAds(eventName: string) {
  return /(^|_)(ad|ads|reward(ed)?|interstitial|banner|placement|video)(_|$)/i.test(eventName);
}

function normalizeImportedEventName(eventName: string) {
  const normalized = eventName.trim().toLowerCase();

  switch (normalized) {
    case "af_ad_view":
      return "ad_impression";
    case "af_ad_click":
      return "ad_click";
    case "ad_reward_claim":
      return "ad_reward_claim";
    case "af_purchase":
      return "iap_success";
    case "af_initiated_checkout":
      return "iap_order_create";
    case "af_level_achieved":
      return "level_complete";
    case "af_tutorial_completion":
      return "tutorial_complete";
    case "tutoriallevel_start":
      return "tutorial_level_start";
    default:
      return normalized;
  }
}

function classifyRow(input: {
  eventName: string;
  levelId: string;
  stepId: string;
  placement: string;
  price: number | null;
}) {
  const { eventName, levelId, stepId, placement, price } = input;

  if (/(tutorial|camera_rotate|screw_interact|tutorial_level_start|tutorial_complete)/i.test(eventName)) {
    return "onboarding" as const;
  }

  if (price !== null && price > 0) {
    return "monetization" as const;
  }
  if (placement || eventLooksAds(eventName)) {
    return "ads" as const;
  }
  if (stepId || eventLooksOnboarding(eventName)) {
    return "onboarding" as const;
  }
  if (levelId || eventLooksLevel(eventName)) {
    return "level" as const;
  }
  if (eventLooksSystem(eventName)) {
    return "system" as const;
  }
  if (eventLooksMonetization(eventName)) {
    return "monetization" as const;
  }
  return "custom" as const;
}

function buildInsight(category: CategoryKey, summary: CategorySummary) {
  switch (category) {
    case "system":
      return summary.metrics.errorRate > 8
        ? "公共事件异常占比偏高，建议先核对 session 和 error 上报口径，再分析具体玩法模块。"
        : "公共事件层整体稳定，可以继续作为版本对比和其他分类分析的基线。";
    case "onboarding":
      return summary.metrics.completionRate < 55
        ? "新手引导完成率偏低，建议优先排查中段步骤的提示强度与交互反馈。"
        : "新手引导核心漏斗可读性较好，下一步适合细化关键步骤字段。";
    case "level":
      return summary.metrics.failRate > summary.metrics.completionRate
        ? "关卡失败率高于通关率，建议先查看失败原因和高失败关卡，而不是直接整体降难。"
        : "关卡主漏斗已经可用，后续更适合补齐失败原因和重试细节。";
    case "monetization":
      return summary.metrics.conversionRate < 5
        ? "商业化转化偏弱，建议回看付费入口事件是否完整，以及展示时机是否过晚。"
        : "商业化链路已经具备分析价值，可以开始对 SKU 和入口位做细分观察。";
    case "ads":
      return summary.metrics.completionRate < 60
        ? "广告完成率偏低，建议优先检查广告位触发时机和奖励承接逻辑。"
        : "广告完成和发奖链路整体稳定，可以进一步对比不同广告位表现。";
    default:
      return "自定义分类已有首批结构化结果，适合继续补齐字段语义和专项业务标签。";
  }
}

export function buildImportSummary(rows: ImportRow[], mappings: Array<{ source: string; target: string }>): ImportSummary {
  const activeMappings = mappings.filter((item) => item.target !== "ignore");
  const findMapping = (target: string) => activeMappings.find((item) => item.target === target);

  const eventMapping = findMapping("event_name");
  const resultMapping = findMapping("result");
  const levelMapping = findMapping("level_id");
  const stepMapping = findMapping("step_id");
  const placementMapping = findMapping("placement");
  const priceMapping = findMapping("price");
  const durationMapping = findMapping("duration_sec");
  const userMapping = findMapping("user_id");
  const reasonMapping = findMapping("fail_reason") ?? findMapping("reason");
  const rewardMapping = findMapping("reward_type");

  let errorCount = 0;
  let unmatchedEvents = 0;
  let sessionStartCount = 0;
  let loginSuccessCount = 0;
  let errorReportCount = 0;

  const uniqueUsers = new Set<string>();
  const monetizationUsers = new Set<string>();
  const eventCounts = new Map<string, number>();
  const placementCounts = new Map<string, number>();
  const levelCounts = new Map<string, number>();
  const stepCounts = new Map<string, number>();
  const failReasonCounts = new Map<string, number>();
  const categoryEventCounts: Record<CategoryKey, Map<string, number>> = {
    system: new Map(),
    onboarding: new Map(),
    level: new Map(),
    monetization: new Map(),
    ads: new Map(),
    custom: new Map()
  };

  const perCategory = {
    system: { count: 0 },
    onboarding: { count: 0, success: 0, durationTotal: 0, durationCount: 0 },
    level: { count: 0, success: 0, fail: 0 },
    monetization: { count: 0, value: 0 },
    ads: { count: 0, success: 0, reward: 0 },
    custom: { count: 0 }
  };

  rows.forEach((row) => {
    const eventName = eventMapping ? normalizeImportedEventName(String(row[eventMapping.source] ?? "").trim()) : "";
    const result = resultMapping ? String(row[resultMapping.source] ?? "").trim().toLowerCase() : "";
    const levelId = levelMapping ? String(row[levelMapping.source] ?? "").trim() : "";
    const stepId = stepMapping ? String(row[stepMapping.source] ?? "").trim() : "";
    const placement = placementMapping ? String(row[placementMapping.source] ?? "").trim() : "";
    const price = priceMapping ? safeNumber(row[priceMapping.source]) : null;
    const duration = durationMapping ? safeNumber(row[durationMapping.source]) : null;
    const userId = userMapping ? String(row[userMapping.source] ?? "").trim() : "";
    const reason = reasonMapping ? String(row[reasonMapping.source] ?? "").trim() : "";
    const rewardType = rewardMapping ? String(row[rewardMapping.source] ?? "").trim() : "";
    const stepName = String(row.step_name ?? "").trim();
    const levelType = String(row.level_type ?? "").trim();
    const gainSource = String(row.gain_source ?? "").trim();

    if (!eventName) {
      errorCount += 1;
      unmatchedEvents += 1;
      return;
    }

    if (userId) {
      uniqueUsers.add(userId);
    }

    eventCounts.set(eventName, (eventCounts.get(eventName) ?? 0) + 1);

    if (/(session_start|app_start|launch)/i.test(eventName)) {
      sessionStartCount += 1;
    }
    if (/(login_success|sign_in_success|auth_success)/i.test(eventName)) {
      loginSuccessCount += 1;
    }
    if (/(error|crash)/i.test(eventName) || result === "error") {
      errorReportCount += 1;
    }

    if (result === "fail" || result === "failed" || result === "error") {
      errorCount += 1;
    }

    const category = classifyRow({
      eventName: stepId || stepName ? `${eventName}_${stepName || stepId}` : eventName,
      levelId,
      stepId,
      placement,
      price
    });
    categoryEventCounts[category].set(eventName, (categoryEventCounts[category].get(eventName) ?? 0) + 1);

    if (category === "system") {
      perCategory.system.count += 1;
    }

    if (category === "onboarding") {
      perCategory.onboarding.count += 1;
      stepCounts.set(stepName || stepId || eventName, (stepCounts.get(stepName || stepId || eventName) ?? 0) + 1);
      if (result === "success" || result === "complete" || /complete|finish|done/i.test(eventName)) {
        perCategory.onboarding.success += 1;
      }
      if (duration !== null) {
        perCategory.onboarding.durationTotal += duration;
        perCategory.onboarding.durationCount += 1;
      }
    }

    if (category === "level") {
      perCategory.level.count += 1;
      const levelKey = levelId ? `${levelId}${levelType ? ` (${levelType})` : ""}` : eventName;
      levelCounts.set(levelKey, (levelCounts.get(levelKey) ?? 0) + 1);
      if (result === "success" || result === "complete" || /complete|win|clear/i.test(eventName)) {
        perCategory.level.success += 1;
      }
      if (result === "fail" || result === "failed" || /fail|lose|timeout/i.test(eventName)) {
        perCategory.level.fail += 1;
        if (reason) {
          failReasonCounts.set(reason, (failReasonCounts.get(reason) ?? 0) + 1);
        }
      }
    }

    if (category === "monetization") {
      perCategory.monetization.count += 1;
      if (price !== null && price > 0) {
        perCategory.monetization.value += price;
      }
      if (userId) {
        monetizationUsers.add(userId);
      }
    }

    if (category === "ads") {
      perCategory.ads.count += 1;
      placementCounts.set(placement || eventName, (placementCounts.get(placement || eventName) ?? 0) + 1);
      if (result === "success" || result === "complete" || /reward|complete/i.test(eventName)) {
        perCategory.ads.success += 1;
      }
      if (rewardType || /reward/i.test(eventName)) {
        perCategory.ads.reward += 1;
      }
    }

    if (category === "custom") {
      perCategory.custom.count += 1;
      if (gainSource) {
        failReasonCounts.set(gainSource, (failReasonCounts.get(gainSource) ?? 0) + 1);
      }
    }
  });

  const recordCount = rows.length;
  const successRate = recordCount ? (recordCount - errorCount) / recordCount : 0;

  const systemSummary: CategorySummary = {
    metrics: {
      activeUsers: uniqueUsers.size,
      eventCount: perCategory.system.count,
      validRate: clampPercent(successRate * 100),
      errorRate: clampPercent(recordCount ? (errorReportCount / recordCount) * 100 : 0),
      sessionStartCount,
      loginSuccessCount,
      errorReportCount
    },
    main: [sessionStartCount, loginSuccessCount, perCategory.system.count, errorReportCount],
    aux: toCountRanking(categoryEventCounts.system, 4).map((item) => item.count),
    auxLabels: toCountRanking(categoryEventCounts.system, 4).map((item) => item.name),
    ranking: toCountRanking(categoryEventCounts.system, 5).map((item) => ({ ...item, meta: `${item.count} 次` })),
    insight: ""
  };

  const onboardingCompletion = perCategory.onboarding.count
    ? (perCategory.onboarding.success / perCategory.onboarding.count) * 100
    : 0;
  const onboardingReach = recordCount ? (perCategory.onboarding.count / recordCount) * 100 : 0;
  const onboardingDrop = Math.max(0, 100 - onboardingCompletion);
  const onboardingDuration = perCategory.onboarding.durationCount
    ? perCategory.onboarding.durationTotal / perCategory.onboarding.durationCount
    : 0;
  const onboardingStepRanking = toCountRanking(stepCounts, 6);
  const onboardingSummary: CategorySummary = {
    metrics: {
      reachRate: clampPercent(onboardingReach),
      completionRate: clampPercent(onboardingCompletion),
      dropRate: clampPercent(onboardingDrop),
      avgDuration: Number(onboardingDuration.toFixed(2))
    },
    main: onboardingStepRanking.length
      ? onboardingStepRanking.map((item) => clampPercent((item.count / Math.max(onboardingStepRanking[0]?.count || 1, 1)) * 100))
      : [0, 0, 0, 0],
    aux: onboardingStepRanking.map((item) => clampPercent((item.count / Math.max(recordCount, 1)) * 100)),
    auxLabels: onboardingStepRanking.map((item) => item.name),
    ranking: onboardingStepRanking.map((item) => ({ ...item, meta: `${item.count} 次触达` })),
    insight: ""
  };

  const levelCompletion = perCategory.level.count ? (perCategory.level.success / perCategory.level.count) * 100 : 0;
  const levelFail = perCategory.level.count ? (perCategory.level.fail / perCategory.level.count) * 100 : 0;
  const levelStart = recordCount ? (perCategory.level.count / recordCount) * 100 : 0;
  const retryAvg = Number((perCategory.level.fail / Math.max(perCategory.level.success || 1, 1)).toFixed(2));
  const levelRanking = toCountRanking(levelCounts, 5);
  const levelReasonRanking = toCountRanking(failReasonCounts, 5);
  const levelSummary: CategorySummary = {
    metrics: {
      startRate: clampPercent(levelStart),
      completionRate: clampPercent(levelCompletion),
      failRate: clampPercent(levelFail),
      retryAvg
    },
    main: [100, clampPercent(levelStart), clampPercent(levelCompletion), clampPercent(levelFail)],
    aux: levelReasonRanking.map((item) => clampPercent((item.count / Math.max(perCategory.level.fail || 1, 1)) * 100)),
    auxLabels: levelReasonRanking.map((item) => item.name),
    ranking: levelRanking.map((item) => ({ ...item, meta: `${item.count} 次进入/结算` })),
    insight: ""
  };

  const monetizationConversion = uniqueUsers.size ? (monetizationUsers.size / uniqueUsers.size) * 100 : 0;
  const monetizationSummary: CategorySummary = {
    metrics: {
      conversionRate: clampPercent(monetizationConversion),
      eventCount: perCategory.monetization.count,
      value: Number(perCategory.monetization.value.toFixed(2)),
      averageValue:
        perCategory.monetization.count > 0
          ? Number((perCategory.monetization.value / perCategory.monetization.count).toFixed(2))
          : 0
    },
    main: [100, clampPercent(monetizationConversion * 2), clampPercent(monetizationConversion), clampPercent(monetizationConversion * 0.6)],
    aux: [
      clampPercent(perCategory.monetization.value),
      clampPercent((perCategory.monetization.count / Math.max(recordCount, 1)) * 100),
      clampPercent(monetizationConversion),
      clampPercent(perCategory.monetization.count > 0 ? perCategory.monetization.value / perCategory.monetization.count : 0)
    ],
    auxLabels: ["收入", "付费事件", "转化率", "客单值"],
    ranking: toCountRanking(categoryEventCounts.monetization, 5).map((item) => ({ ...item, meta: `${item.count} 次触发` })),
    insight: ""
  };

  const adTrigger = recordCount ? (perCategory.ads.count / recordCount) * 100 : 0;
  const adCompletion = perCategory.ads.count ? (perCategory.ads.success / perCategory.ads.count) * 100 : 0;
  const adRewardRate = perCategory.ads.count ? (perCategory.ads.reward / perCategory.ads.count) * 100 : 0;
  const placementRanking = toCountRanking(placementCounts, 5);
  const adsSummary: CategorySummary = {
    metrics: {
      triggerRate: clampPercent(adTrigger),
      completionRate: clampPercent(adCompletion),
      rewardRate: clampPercent(adRewardRate),
      closeRate: clampPercent(100 - adCompletion)
    },
    main: [100, clampPercent(adTrigger), clampPercent(adCompletion), clampPercent(adRewardRate)],
    aux: placementRanking.map((item) => clampPercent((item.count / Math.max(perCategory.ads.count || 1, 1)) * 100)),
    auxLabels: placementRanking.map((item) => item.name),
    ranking: placementRanking.map((item) => ({ ...item, meta: `${item.count} 次触发` })),
    insight: ""
  };

  const customRanking = toCountRanking(categoryEventCounts.custom, 5);
  const customSummary: CategorySummary = {
    metrics: {
      eventCount: customRanking.length,
      coverageRate: clampPercent(successRate * 100),
      usableRate: clampPercent(successRate * 100),
      anomalyCount: levelReasonRanking.length
    },
    main: customRanking.length ? customRanking.map((item) => clampPercent((item.count / Math.max(customRanking[0]?.count || 1, 1)) * 100)) : [0, 0, 0],
    aux: levelReasonRanking.map((item) => clampPercent((item.count / Math.max(errorCount || 1, 1)) * 100)),
    auxLabels: levelReasonRanking.map((item) => item.name),
    ranking: customRanking.map((item) => ({ ...item, meta: `${item.count} 次触发` })),
    insight: ""
  };

  const categories: Record<CategoryKey, CategorySummary> = {
    system: systemSummary,
    onboarding: onboardingSummary,
    level: levelSummary,
    monetization: monetizationSummary,
    ads: adsSummary,
    custom: customSummary
  };

  (Object.keys(categories) as CategoryKey[]).forEach((category) => {
    categories[category].insight = buildInsight(category, categories[category]);
  });

  const topEvents = toCountRanking(eventCounts, 5);
  const topPlacements = placementRanking;
  const topLevels = levelRanking;
  const failReasons = levelReasonRanking;

  const healthScore = clampPercent(
    successRate * 45 +
      (categories.onboarding.metrics.completionRate / 100) * 20 +
      (categories.level.metrics.completionRate / 100) * 20 +
      (categories.ads.metrics.completionRate / 100) * 10 +
      (Math.min(categories.monetization.metrics.conversionRate, 15) / 15) * 5
  );

  const metrics = [
    { metricKey: "active_users", metricLabel: "活跃用户数", metricValue: categories.system.metrics.activeUsers, dimension: "system" },
    { metricKey: "system_event_count", metricLabel: "公共事件量", metricValue: categories.system.metrics.eventCount, dimension: "system" },
    { metricKey: "system_valid_rate", metricLabel: "公共事件有效率", metricValue: categories.system.metrics.validRate, dimension: "system" },
    { metricKey: "system_error_rate", metricLabel: "公共事件异常占比", metricValue: categories.system.metrics.errorRate, dimension: "system" },
    { metricKey: "import_success_rate", metricLabel: "导入通过率", metricValue: Number((successRate * 100).toFixed(2)), dimension: "overview" },
    { metricKey: "health_score", metricLabel: "版本健康分", metricValue: healthScore, dimension: "overview" },
    { metricKey: "onboarding_reach_rate", metricLabel: "新手引导到达率", metricValue: categories.onboarding.metrics.reachRate, dimension: "onboarding" },
    { metricKey: "onboarding_completion_rate", metricLabel: "新手引导完成率", metricValue: categories.onboarding.metrics.completionRate, dimension: "onboarding" },
    { metricKey: "onboarding_drop_rate", metricLabel: "新手引导流失率", metricValue: categories.onboarding.metrics.dropRate, dimension: "onboarding" },
    { metricKey: "onboarding_avg_duration", metricLabel: "新手引导平均耗时", metricValue: categories.onboarding.metrics.avgDuration, dimension: "onboarding" },
    { metricKey: "level_start_rate", metricLabel: "关卡开局率", metricValue: categories.level.metrics.startRate, dimension: "level" },
    { metricKey: "level_completion_rate", metricLabel: "关卡完成率", metricValue: categories.level.metrics.completionRate, dimension: "level" },
    { metricKey: "level_fail_rate", metricLabel: "关卡失败率", metricValue: categories.level.metrics.failRate, dimension: "level" },
    { metricKey: "level_retry_avg", metricLabel: "平均重试次数", metricValue: categories.level.metrics.retryAvg, dimension: "level" },
    { metricKey: "ad_trigger_rate", metricLabel: "广告触发率", metricValue: categories.ads.metrics.triggerRate, dimension: "ads" },
    { metricKey: "ad_completion_rate", metricLabel: "广告完成率", metricValue: categories.ads.metrics.completionRate, dimension: "ads" },
    { metricKey: "ad_reward_rate", metricLabel: "广告奖励领取率", metricValue: categories.ads.metrics.rewardRate, dimension: "ads" },
    { metricKey: "monetization_conversion_rate", metricLabel: "商业化转化率", metricValue: categories.monetization.metrics.conversionRate, dimension: "monetization" },
    { metricKey: "monetization_event_count", metricLabel: "商业化事件数", metricValue: categories.monetization.metrics.eventCount, dimension: "monetization" },
    { metricKey: "monetization_value", metricLabel: "商业化金额", metricValue: categories.monetization.metrics.value, dimension: "monetization" }
  ];

  return {
    recordCount,
    successRate,
    errorCount,
    unmatchedEvents,
    topEvents,
    topPlacements,
    topLevels,
    failReasons,
    categories,
    overview: {
      activeUsers: uniqueUsers.size,
      healthScore,
      keyAnomalyCount: failReasons.length + (categories.system.metrics.errorRate > 5 ? 1 : 0),
      monetizationValue: categories.monetization.metrics.value
    },
    metrics
  };
}
