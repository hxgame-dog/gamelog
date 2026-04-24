export type ImportRow = Record<string, string | number | boolean | null>;
export type CategoryKey = "system" | "onboarding" | "level" | "monetization" | "ads" | "custom";
export type RankedItem = { name: string; count: number; meta?: string };
export type FunnelStage = {
  label: string;
  count: number;
  rate?: number;
  inferred?: boolean;
};
export type CategorySummary = {
  metrics: Record<string, number>;
  main: number[];
  aux: number[];
  auxLabels: string[];
  ranking: RankedItem[];
  insight: string;
};

export type ImportCleaning = {
  sourceKind?: string;
  encoding?: string;
  delimiter?: string;
  expandedFields?: string[];
};

export type DiagnosticSeverity = "info" | "warning" | "error";
export type DiagnosticStatus = "PASS" | "HIGH_RISK" | "SEVERE_GAP";
export type DiagnosticCode =
  | "missing_event"
  | "missing_field"
  | "invalid_value"
  | "coverage_gap"
  | "incomplete_chain"
  | "alias_only";
export type DiagnosticIssue = {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  module: "global" | "onboarding" | "level" | "ads" | "monetization" | "liveops" | "economy" | "social";
  target: string;
  message: string;
  suggestion: string;
};
export type ModuleDiagnosticCheck = {
  status: DiagnosticStatus | "MISSING";
  canAnalyze: boolean;
  matchedRows: number;
  expectedEvents: string[];
  missingEvents: string[];
  missingFields: string[];
};
export type ImportDiagnostics = {
  overallStatus: DiagnosticStatus;
  technicalSuccessRate: number;
  technicalErrorCount: number;
  businessFailureCount: number;
  moduleCoverage: number;
  moduleChecks: Record<
    "global" | "onboarding" | "level" | "ads" | "monetization" | "liveops" | "economy" | "social",
    ModuleDiagnosticCheck
  >;
  issues: DiagnosticIssue[];
};

export type ImportSummary = {
  recordCount: number;
  successRate: number;
  errorCount: number;
  technicalSuccessRate?: number;
  technicalErrorCount?: number;
  businessFailureCount?: number;
  moduleCoverage?: number;
  cleaning?: ImportCleaning;
  diagnostics?: ImportDiagnostics;
  unmatchedEvents: number;
  previewRows: ImportRow[];
  topEvents: RankedItem[];
  topPlacements: RankedItem[];
  topLevels: RankedItem[];
  failReasons: RankedItem[];
  onboardingFunnel: Array<{
    stepId: string;
    stepName: string;
    arrivals: number;
    completions: number;
    completionRate: number;
    dropoffCount: number;
    avgDuration: number;
  }>;
  onboardingStepTrend: Array<{
    stepId: string;
    stepName: string;
    arrivals: number;
    completions: number;
    completionRate: number;
    avgDuration: number;
  }>;
  onboardingSteps: Array<{
    stepId: string;
    stepName: string;
    arrivals: number;
    completions: number;
    completionRate: number;
    avgDuration: number;
  }>;
  levelProgress: Array<{
    levelId: string;
    levelType: string;
    starts: number;
    completes: number;
    fails: number;
    retries: number;
    topFailReason: string;
  }>;
  levelFunnel: Array<{
    levelId: string;
    levelType: string;
    starts: number;
    completes: number;
    fails: number;
    retries: number;
    completionRate: number;
    failRate: number;
    topFailReason: string;
  }>;
  levelFailReasonDistribution: RankedItem[];
  levelRetryRanking: Array<{
    levelId: string;
    levelType: string;
    retries: number;
    starts: number;
    retryRate: number;
  }>;
  microflowRows: Array<{
    levelId: string;
    action: string;
    count: number;
    ratio: number;
    avgDuration: number;
  }>;
  microflowByLevel: Array<{
    levelId: string;
    actions: Array<{
      action: string;
      count: number;
      ratio: number;
      avgDuration: number;
    }>;
  }>;
  monetizationStoreFunnel: FunnelStage[];
  monetizationPaymentFunnel: FunnelStage[];
  giftPackDistribution: Array<{
    name: string;
    exposures: number;
    clicks: number;
    orders: number;
    successes: number;
    successRate: number;
    inferred?: boolean;
  }>;
  adPlacementBreakdown: Array<{
    placement: string;
    requests: number;
    plays: number;
    clicks: number;
    rewards: number;
    clickRate: number;
    rewardRate: number;
    inferred?: boolean;
  }>;
  adPlacementFlow: Array<{
    placement: string;
    requests: number;
    plays: number;
    clicks: number;
  }>;
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

function readRowValue(row: ImportRow, ...keys: Array<string | undefined>) {
  for (const key of keys) {
    if (!key) {
      continue;
    }
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function readRowText(row: ImportRow, ...keys: Array<string | undefined>) {
  const value = readRowValue(row, ...keys);
  return value === null ? "" : String(value).trim();
}

function readRowNumber(row: ImportRow, ...keys: Array<string | undefined>) {
  const value = readRowValue(row, ...keys);
  return value === null ? null : safeNumber(value);
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

function normalizeActionLabel(eventName: string) {
  const normalized = eventName.trim().toLowerCase();

  switch (normalized) {
    case "camera_rotate":
      return "旋转视角";
    case "screw_interact":
      return "螺丝操作";
    case "item_use":
      return "道具使用";
    case "unlock_extra_slot":
      return "开启额外槽位";
    case "ad_reward_claim":
      return "领取广告奖励";
    default:
      return normalized;
  }
}

function isMonetizationTransactionEvent(eventName: string) {
  return /^(iap_order_create|iap_success)$/i.test(eventName);
}

function looksRetryEvent(eventName: string) {
  return /(retry|restart|replay)/i.test(eventName);
}

function looksStoreExposure(eventName: string, triggerScene: string, placement: string, rewardType: string) {
  return /(store_view|shop_view|paywall_view|gift_pack_view|offer_view|shop|paywall)/i.test(eventName)
    || /(shop|store|pass|gift)/i.test(triggerScene)
    || /(shop|store|gift|礼包)/i.test(placement);
}

function looksStoreClick(eventName: string) {
  return /(iap_click|purchase_click|pay_click|checkout_click|offer_click|store_click)/i.test(eventName);
}

function looksAdRequest(eventName: string) {
  return /(ad_request|request_ad|load_ad)/i.test(eventName);
}

function looksAdPlay(eventName: string) {
  return /(ad_play|ad_impression|af_ad_view|video_complete|rewarded_show)/i.test(eventName);
}

function looksAdClick(eventName: string) {
  return /(ad_click|af_ad_click)/i.test(eventName);
}

function looksAdReward(eventName: string) {
  return /(reward_claim|reward_complete|ad_reward_claim)/i.test(eventName);
}

function classifyRow(input: {
  eventName: string;
  levelId: string;
  stepId: string;
  placement: string;
  price: number | null;
}) {
  const { eventName, levelId, stepId, placement, price } = input;

  if (/(camera_rotate|screw_interact|item_use|unlock_extra_slot)/i.test(eventName) && levelId) {
    return "level" as const;
  }

  if (/(tutorial|guide|ftue|onboarding|tutorial_level_start|tutorial_complete)/i.test(eventName)) {
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
        : "公共事件层整体稳定，可以继续作为版本对比和其他运营分析模块的基线。";
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

type BuildImportSummaryContext = ImportCleaning;

type ModuleDefinition = {
  key: keyof ImportDiagnostics["moduleChecks"];
  kind: "strict" | "soft";
  anchorEvents?: string[];
  anchorMode?: "all" | "any";
  anchorMissingStatus?: DiagnosticStatus;
  expectedEvents: string[];
  eventMatchers: Array<(eventName: string) => boolean>;
  requiredFields: string[];
};

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: "global",
    kind: "strict",
    anchorEvents: ["session_start"],
    expectedEvents: ["session_start"],
    eventMatchers: [
      (eventName) => /(session_start|app_start|launch|login_success|logout|error|crash|install|heartbeat|settings)/i.test(eventName)
    ],
    requiredFields: ["event_name", "event_time", "user_id"]
  },
  {
    key: "onboarding",
    kind: "strict",
    anchorEvents: ["tutorial_step"],
    expectedEvents: ["tutorial_begin", "tutorial_step", "tutorial_complete"],
    eventMatchers: [(eventName) => /^(tutorial_begin|tutorial_step|tutorial_complete|tutorial_level_start|tutorial_step_complete|tutorial_step_fail)$/i.test(eventName)],
    requiredFields: ["step_id", "step_name"]
  },
  {
    key: "level",
    kind: "strict",
    anchorEvents: ["level_start"],
    expectedEvents: ["level_start", "level_complete", "level_fail"],
    eventMatchers: [
      (eventName) => /^(level_start|level_complete|level_fail|retry|restart|replay)$/i.test(eventName),
      (eventName) => /^(camera_rotate|screw_interact|item_use|unlock_extra_slot)$/i.test(eventName)
    ],
    requiredFields: ["level_id"]
  },
  {
    key: "ads",
    kind: "strict",
    anchorEvents: ["ad_impression"],
    expectedEvents: ["ad_impression", "ad_click", "ad_reward_claim"],
    eventMatchers: [
      (eventName) => /^(ad_request|ad_impression|ad_play|ad_click|ad_reward_claim)$/i.test(eventName)
    ],
    requiredFields: ["placement"]
  },
  {
    key: "monetization",
    kind: "strict",
    anchorEvents: ["iap_order_create", "iap_success"],
    anchorMode: "any",
    anchorMissingStatus: "HIGH_RISK",
    expectedEvents: ["iap_order_create", "iap_success"],
    eventMatchers: [
      (eventName) =>
        /^(store_view|shop_view|paywall_view|gift_pack_view|offer_view|iap_click|purchase_click|pay_click|checkout_click|offer_click|store_click|iap_order_create|iap_success)$/i.test(eventName)
    ],
    requiredFields: ["price"]
  },
  {
    key: "liveops",
    kind: "soft",
    expectedEvents: ["liveops"],
    eventMatchers: [(eventName) => /(liveops|event_|activity|quest|season|campaign)/i.test(eventName)],
    requiredFields: ["event_name"]
  },
  {
    key: "economy",
    kind: "soft",
    expectedEvents: ["currency_gain", "currency_spend"],
    eventMatchers: [(eventName) => /^(currency_gain|currency_spend|resource_gain|resource_spend|economy_adjust|shop_balance_update)$/i.test(eventName)],
    requiredFields: ["event_name"]
  },
  {
    key: "social",
    kind: "soft",
    expectedEvents: ["share", "invite", "friend"],
    eventMatchers: [(eventName) => /(social|share|invite|friend|guild|chat|follow)/i.test(eventName)],
    requiredFields: ["event_name"]
  }
];

function buildIssue(
  severity: DiagnosticSeverity,
  code: DiagnosticCode,
  module: DiagnosticIssue["module"],
  target: string,
  message: string,
  suggestion: string
): DiagnosticIssue {
  return { severity, code, module, target, message, suggestion };
}

function buildModuleDiagnostic(input: {
  rows: ImportRow[];
  definition: ModuleDefinition;
}) {
  const { rows, definition } = input;
  const matchedRows = rows.filter((row) => {
    const eventName = normalizeImportedEventName(readRowText(row, "event_name"));
    return definition.eventMatchers.some((matcher) => matcher(eventName));
  });
  const matchedEvents = new Set(
    matchedRows.map((row) => normalizeImportedEventName(readRowText(row, "event_name"))).filter(Boolean)
  );
  const anchorEvents = definition.anchorEvents ?? [];
  const anchorMode = definition.anchorMode ?? "all";
  const missingAnchorEvents = anchorEvents.filter((eventName) => !matchedEvents.has(eventName));
  const missingEvents = definition.expectedEvents.filter((eventName) => !matchedEvents.has(eventName));

  const missingFields = new Set<string>();
  matchedRows.forEach((row) => {
    const normalizedEventName = normalizeImportedEventName(readRowText(row, "event_name"));
    definition.requiredFields.forEach((field) => {
      if (field === "price") {
        if (!isMonetizationTransactionEvent(normalizedEventName)) {
          return;
        }
        if (readRowValue(row, field) === null) {
          missingFields.add(field);
        }
        return;
      }
      if (!readRowText(row, field)) {
        missingFields.add(field);
      }
    });
  });

  let status: DiagnosticStatus | "MISSING" = "PASS";
  if (matchedRows.length === 0) {
    status = definition.kind === "soft" ? "MISSING" : "HIGH_RISK";
  } else if (
    definition.kind === "strict" &&
    anchorEvents.length > 0 &&
    ((anchorMode === "all" && missingAnchorEvents.length > 0) || (anchorMode === "any" && missingAnchorEvents.length === anchorEvents.length))
  ) {
    status = definition.anchorMissingStatus ?? "SEVERE_GAP";
  } else if (missingFields.size > 0) {
    status = "SEVERE_GAP";
  } else if (missingEvents.length > 0) {
    status = "HIGH_RISK";
  }

  return {
    status,
    canAnalyze: matchedRows.length > 0,
    matchedRows: matchedRows.length,
    expectedEvents: definition.expectedEvents,
    missingEvents,
    missingFields: [...missingFields]
  };
}

function buildDiagnostics(input: {
  rows: ImportRow[];
  technicalSuccessRate: number;
  technicalErrorCount: number;
  businessFailureCount: number;
  moduleCoverage: number;
}) {
  const { rows, technicalSuccessRate, technicalErrorCount, businessFailureCount, moduleCoverage } = input;
  const moduleChecks = Object.fromEntries(
    MODULE_DEFINITIONS.map((definition) => [definition.key, buildModuleDiagnostic({ rows, definition })])
  ) as ImportDiagnostics["moduleChecks"];

  const issues: DiagnosticIssue[] = [];

  MODULE_DEFINITIONS.forEach((definition) => {
    const check = moduleChecks[definition.key];
    if (check.status === "MISSING") {
      issues.push(
        buildIssue(
          "info",
          "coverage_gap",
          definition.key,
          definition.expectedEvents[0] ?? definition.key,
          `${definition.key} 模块当前批次没有命中可分析数据。`,
          "如果这是预期外情况，请补传对应模块日志或检查字段映射。"
        )
      );
      return;
    }

    if (check.missingEvents.length > 0) {
      check.missingEvents.forEach((missingEvent) => {
        const isAnchorMissing =
          definition.kind === "strict" &&
          (definition.anchorEvents ?? []).includes(missingEvent) &&
          check.status === "SEVERE_GAP";
        issues.push(
          buildIssue(
            isAnchorMissing
              ? "error"
              : definition.kind === "strict"
                ? "warning"
                : "info",
            "missing_event",
            definition.key,
            missingEvent,
            `${definition.key} 模块缺少关键事件 ${missingEvent}。`,
            "请补齐标准事件埋点，或确认该模块是否被正确映射到清洗字段。"
          )
        );
      });
    }

    if (check.missingFields.length > 0) {
      check.missingFields.forEach((missingField) => {
        issues.push(
          buildIssue(
            definition.kind === "strict" ? "error" : "warning",
            "missing_field",
            definition.key,
            missingField,
            `${definition.key} 模块缺少关键字段 ${missingField}。`,
            "请确认清洗后的标准字段已经输出到摘要输入中。"
          )
        );
      });
    }

    const matchedRows = rows.filter((row) => {
      const eventName = normalizeImportedEventName(readRowText(row, "event_name"));
      return definition.eventMatchers.some((matcher) => matcher(eventName));
    });
    const matchedEvents = new Set(matchedRows.map((row) => normalizeImportedEventName(readRowText(row, "event_name"))));
    const aliasEvents = new Set(
      matchedRows
        .map((row) => {
          const rawEventName = readRowText(row, "raw_event_name");
          const cleanedEventName = readRowText(row, "event_name");
          return rawEventName && rawEventName !== cleanedEventName ? rawEventName : "";
        })
        .filter(Boolean)
    );

    aliasEvents.forEach((rawEventName) => {
      issues.push(
        buildIssue(
          "info",
          "alias_only",
          definition.key,
          rawEventName,
          `${definition.key} 模块当前通过别名事件 ${rawEventName} 归一化后参与诊断。`,
          "建议后续尽量统一为标准事件名，降低跨版本诊断歧义。"
        )
      );
    });

    if (
      definition.key === "ads" &&
      !matchedEvents.has("ad_request") &&
      (matchedEvents.has("ad_impression") || matchedEvents.has("ad_click") || matchedEvents.has("ad_reward_claim"))
    ) {
      if (check.status === "PASS") {
        check.status = "HIGH_RISK";
      }
      issues.push(
        buildIssue(
          "warning",
          "incomplete_chain",
          "ads",
          "ad_request",
          "广告链路缺少 request 事件，当前只能从曝光/点击/发奖开始分析。",
          "建议补齐广告请求事件，便于核对广告位从请求到播放的完整流转。"
        )
      );
    }

    if (
      definition.key === "monetization" &&
      matchedRows.some((row) => {
        const eventName = normalizeImportedEventName(readRowText(row, "event_name"));
        return isMonetizationTransactionEvent(eventName) && readRowValue(row, "price") !== null && (readRowNumber(row, "price") ?? 0) <= 0;
      })
    ) {
      issues.push(
        buildIssue(
          "error",
          "invalid_value",
          "monetization",
          "price",
          "商业化事件存在非法金额值，当前金额口径不可靠。",
          "请检查 price/event_revenue 的清洗结果，确认金额为大于 0 的合法数值。"
        )
      );
    }
  });

  const strictStatuses = (["global", "onboarding", "level", "ads", "monetization"] as const).map((key) => moduleChecks[key].status);
  const hasStrictErrorIssue = issues.some(
    (issue) =>
      issue.severity === "error" &&
      ["global", "onboarding", "level", "ads", "monetization"].includes(issue.module)
  );
  const overallStatus: DiagnosticStatus = hasStrictErrorIssue || strictStatuses.includes("SEVERE_GAP")
    ? "SEVERE_GAP"
    : strictStatuses.includes("HIGH_RISK")
      ? "HIGH_RISK"
      : "PASS";

  return {
    overallStatus,
    technicalSuccessRate,
    technicalErrorCount,
    businessFailureCount,
    moduleCoverage,
    moduleChecks,
    issues
  } satisfies ImportDiagnostics;
}

export function buildImportSummary(
  rows: ImportRow[],
  mappings: Array<{ source: string; target: string }>,
  context?: BuildImportSummaryContext
): ImportSummary {
  const activeMappings = mappings.filter((item) => item.target !== "ignore");
  const findMapping = (target: string) => activeMappings.find((item) => item.target === target);

  const eventMapping = findMapping("event_name");
  const eventTimeMapping = findMapping("event_time");
  const resultMapping = findMapping("result");
  const levelMapping = findMapping("level_id");
  const levelTypeMapping = findMapping("level_type");
  const stepMapping = findMapping("step_id");
  const stepNameMapping = findMapping("step_name");
  const placementMapping = findMapping("placement");
  const priceMapping = findMapping("price");
  const durationMapping = findMapping("duration_sec");
  const userMapping = findMapping("user_id");
  const platformMapping = findMapping("platform");
  const appVersionMapping = findMapping("app_version");
  const countryCodeMapping = findMapping("country_code");
  const reasonMapping = findMapping("fail_reason") ?? findMapping("reason");
  const rewardMapping = findMapping("reward_type");
  const productIdMapping = findMapping("product_id");
  const rewardIdMapping = findMapping("reward_id");
  const itemNameMapping = findMapping("item_name");
  const triggerSceneMapping = findMapping("trigger_scene");
  const activityIdMapping = findMapping("activity_id");
  const activityTypeMapping = findMapping("activity_type");
  const gainSourceMapping = findMapping("gain_source");
  const gainAmountMapping = findMapping("gain_amount");
  const resourceTypeMapping = findMapping("resource_type");
  const propertyHintMappings = activeMappings.filter((item) => item.target === "property_hint").map((item) => item.source);

  let errorCount = 0;
  let businessFailureCount = 0;
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
  const storePlacementCounts = new Map<string, number>();
  const giftPackStats = new Map<
    string,
    { exposures: number; clicks: number; orders: number; successes: number; inferred?: boolean }
  >();
  const adPlacementStats = new Map<
    string,
    { requests: number; plays: number; clicks: number; rewards: number; inferred?: boolean }
  >();
  const stepStats = new Map<
    string,
    {
      stepId: string;
      stepName: string;
      arrivals: number;
      completions: number;
      durationTotal: number;
      durationCount: number;
    }
  >();
  const levelStats = new Map<
    string,
    {
      levelId: string;
      levelType: string;
      starts: number;
      completes: number;
      fails: number;
      retries: number;
      failReasons: Map<string, number>;
    }
  >();
  const levelUserStarts = new Map<string, Map<string, number>>();
  const microflowStats = new Map<
    string,
    Map<
      string,
      {
        count: number;
        durationTotal: number;
        durationCount: number;
      }
    >
  >();
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
  const cleanedDiagnosticRows: ImportRow[] = [];

  rows.forEach((row) => {
    const rawEventName = readRowText(row, eventMapping?.target, eventMapping?.source, "event_name");
    const eventName = normalizeImportedEventName(rawEventName);
    const eventTime = readRowText(row, eventTimeMapping?.target, eventTimeMapping?.source, "event_time");
    const result = readRowText(row, resultMapping?.target, resultMapping?.source, "result").toLowerCase();
    const levelId = readRowText(row, levelMapping?.target, levelMapping?.source, "level_id");
    const stepId = readRowText(row, stepMapping?.target, stepMapping?.source, "step_id");
    const stepName = readRowText(row, stepNameMapping?.target, stepNameMapping?.source, "step_name");
    const placement = readRowText(row, placementMapping?.target, placementMapping?.source, "placement");
    const price = readRowNumber(row, priceMapping?.target, priceMapping?.source, "price");
    const duration = readRowNumber(row, durationMapping?.target, durationMapping?.source, "duration_sec");
    const userId = readRowText(row, userMapping?.target, userMapping?.source, "user_id");
    const reason = readRowText(row, reasonMapping?.target, reasonMapping?.source, "fail_reason", "reason");
    const rewardType = readRowText(row, rewardMapping?.target, rewardMapping?.source, "reward_type");
    const levelType = readRowText(row, levelTypeMapping?.target, levelTypeMapping?.source, "level_type");
    const gainSource = readRowText(row, gainSourceMapping?.target, gainSourceMapping?.source, "gain_source");
    const propertyHints = propertyHintMappings
      .map((source) => ({ source, value: readRowText(row, source) }))
      .filter((entry) => entry.value);
    const sceneHint =
      propertyHints.find((entry) => /(scene|trigger|placement|entry|source|from)/i.test(entry.source))?.value ||
      propertyHints.find((entry) => !/(sku|product|content|item|reward|pack|offer)/i.test(entry.source))?.value ||
      propertyHints[0]?.value ||
      "";
    const contentHint =
      propertyHints.find((entry) => /(sku|product|content|item|reward|pack|offer)/i.test(entry.source))?.value ||
      propertyHints.find((entry) => entry.value !== sceneHint)?.value ||
      propertyHints.at(-1)?.value ||
      "";
    const triggerScene =
      readRowText(row, triggerSceneMapping?.target, triggerSceneMapping?.source, "trigger_scene") ||
      sceneHint ||
      "";
    const contentId =
      rewardType ||
      readRowText(row, productIdMapping?.target, productIdMapping?.source, "product_id") ||
      readRowText(row, rewardIdMapping?.target, rewardIdMapping?.source, itemNameMapping?.target, itemNameMapping?.source, "reward_id", "item_name") ||
      contentHint ||
      "";
    const isLevelStart = /level_start|tutorial_level_start|begin|enter|start/i.test(eventName);
    const isLevelComplete = result === "success" || result === "complete" || /complete|win|clear|achieved/i.test(eventName);
    const isLevelFail = result === "fail" || result === "failed" || /fail|lose|timeout/i.test(eventName);

    if (!eventName) {
      errorCount += 1;
      unmatchedEvents += 1;
      return;
    }

    cleanedDiagnosticRows.push({
      event_name: eventName,
      raw_event_name: rawEventName,
      event_time: eventTime,
      user_id: userId,
      platform: readRowText(row, platformMapping?.target, platformMapping?.source, "platform", "device_os", "os"),
      app_version: readRowText(row, appVersionMapping?.target, appVersionMapping?.source, "app_version"),
      country_code: readRowText(row, countryCodeMapping?.target, countryCodeMapping?.source, "country_code", "country"),
      level_id: levelId,
      level_type: levelType,
      step_id: stepId,
      step_name: stepName,
      result,
      fail_reason: reason,
      duration_sec: duration,
      placement,
      price,
      reward_type: rewardType,
      product_id: readRowText(row, productIdMapping?.target, productIdMapping?.source, "product_id"),
      reward_id: readRowText(row, rewardIdMapping?.target, rewardIdMapping?.source, "reward_id"),
      item_name: readRowText(row, itemNameMapping?.target, itemNameMapping?.source, "item_name"),
      trigger_scene: triggerScene,
      activity_id: readRowText(row, activityIdMapping?.target, activityIdMapping?.source, "activity_id"),
      activity_type: readRowText(row, activityTypeMapping?.target, activityTypeMapping?.source, "activity_type"),
      gain_source: gainSource,
      gain_amount: readRowNumber(row, gainAmountMapping?.target, gainAmountMapping?.source, "gain_amount"),
      resource_type: readRowText(row, resourceTypeMapping?.target, resourceTypeMapping?.source, "resource_type")
    });

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
      businessFailureCount += 1;
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
      const stepKey = stepId || stepName || eventName;
      stepCounts.set(stepName || stepId || eventName, (stepCounts.get(stepName || stepId || eventName) ?? 0) + 1);
      const currentStep = stepStats.get(stepKey) ?? {
        stepId: stepId || stepKey,
        stepName: stepName || stepKey,
        arrivals: 0,
        completions: 0,
        durationTotal: 0,
        durationCount: 0
      };
      currentStep.arrivals += 1;
      if (result === "success" || result === "complete" || /complete|finish|done/i.test(eventName)) {
        perCategory.onboarding.success += 1;
        currentStep.completions += 1;
      }
      if (duration !== null) {
        perCategory.onboarding.durationTotal += duration;
        perCategory.onboarding.durationCount += 1;
        currentStep.durationTotal += duration;
        currentStep.durationCount += 1;
      }
      stepStats.set(stepKey, currentStep);
    }

    if (category === "level") {
      perCategory.level.count += 1;
      const levelKey = levelId || eventName;
      const levelDisplayKey = levelId || eventName;
      levelCounts.set(levelKey, (levelCounts.get(levelKey) ?? 0) + 1);
      const currentLevel = levelStats.get(levelDisplayKey) ?? {
        levelId: levelId || levelDisplayKey,
        levelType,
        starts: 0,
        completes: 0,
        fails: 0,
        retries: 0,
        failReasons: new Map<string, number>()
      };
      if (!currentLevel.levelType && levelType) {
        currentLevel.levelType = levelType;
      }
      if (isLevelStart) {
        currentLevel.starts += 1;
        if (userId) {
          const perUser = levelUserStarts.get(levelDisplayKey) ?? new Map<string, number>();
          perUser.set(userId, (perUser.get(userId) ?? 0) + 1);
          levelUserStarts.set(levelDisplayKey, perUser);
        }
      }
      if (looksRetryEvent(eventName)) {
        currentLevel.retries += 1;
      }
      if (isLevelComplete) {
        perCategory.level.success += 1;
        currentLevel.completes += 1;
      }
      if (isLevelFail) {
        perCategory.level.fail += 1;
        currentLevel.fails += 1;
        if (reason) {
          failReasonCounts.set(reason, (failReasonCounts.get(reason) ?? 0) + 1);
          currentLevel.failReasons.set(reason, (currentLevel.failReasons.get(reason) ?? 0) + 1);
        }
      }
      levelStats.set(levelDisplayKey, currentLevel);
    }

    if (category === "monetization") {
      perCategory.monetization.count += 1;
      if (price !== null && price > 0) {
        perCategory.monetization.value += price;
      }
      if (userId) {
        monetizationUsers.add(userId);
      }

      const monetizationKey = contentId || placement || triggerScene || rewardType || eventName;
      const pack = giftPackStats.get(monetizationKey) ?? {
        exposures: 0,
        clicks: 0,
        orders: 0,
        successes: 0,
        inferred: false
      };

      if (looksStoreExposure(eventName, triggerScene, placement, rewardType)) {
        pack.exposures += 1;
        storePlacementCounts.set(monetizationKey, (storePlacementCounts.get(monetizationKey) ?? 0) + 1);
        if (!/(store_view|shop_view|paywall_view|gift_pack_view|offer_view)/i.test(eventName)) {
          pack.inferred = true;
        }
      }
      if (looksStoreClick(eventName)) {
        pack.clicks += 1;
      }
      if (/iap_order_create|checkout|order/i.test(eventName)) {
        pack.orders += 1;
      }
      if (/iap_success|purchase|pay_success/i.test(eventName) || (result === "success" && price !== null && price > 0)) {
        pack.successes += 1;
      }
      giftPackStats.set(monetizationKey, pack);
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

      const placementKey = placement || triggerScene || eventName;
      const stat = adPlacementStats.get(placementKey) ?? {
        requests: 0,
        plays: 0,
        clicks: 0,
        rewards: 0,
        inferred: false
      };
      if (looksAdRequest(eventName)) {
        stat.requests += 1;
      }
      if (looksAdPlay(eventName)) {
        stat.plays += 1;
      }
      if (looksAdClick(eventName)) {
        stat.clicks += 1;
      }
      if (looksAdReward(eventName)) {
        stat.rewards += 1;
      }
      if (stat.requests === 0 && (stat.plays > 0 || looksAdPlay(eventName))) {
        stat.requests += 1;
        stat.inferred = true;
      }
      adPlacementStats.set(placementKey, stat);
    }

    if (category === "custom") {
      perCategory.custom.count += 1;
      if (gainSource) {
        failReasonCounts.set(gainSource, (failReasonCounts.get(gainSource) ?? 0) + 1);
      }
    }

    if (levelId && !isLevelStart && !isLevelComplete && !isLevelFail) {
      const actionKey = normalizeActionLabel(eventName);
      const perLevel = microflowStats.get(levelId) ?? new Map<string, { count: number; durationTotal: number; durationCount: number }>();
      const currentAction = perLevel.get(actionKey) ?? { count: 0, durationTotal: 0, durationCount: 0 };
      currentAction.count += 1;
      if (duration !== null) {
        currentAction.durationTotal += duration;
        currentAction.durationCount += 1;
      }
      perLevel.set(actionKey, currentAction);
      microflowStats.set(levelId, perLevel);
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
  const previewRows = rows.slice(0, 20);
  const onboardingSteps = [...stepStats.values()]
    .sort((a, b) => {
      const aNum = Number(a.stepId);
      const bNum = Number(b.stepId);
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
        return aNum - bNum;
      }
      return a.stepName.localeCompare(b.stepName, "zh-Hans-CN");
    })
    .map((item) => ({
      stepId: item.stepId,
      stepName: item.stepName,
      arrivals: item.arrivals,
      completions: item.completions,
      completionRate: clampPercent(item.arrivals ? (item.completions / item.arrivals) * 100 : 0),
      avgDuration: Number((item.durationCount ? item.durationTotal / item.durationCount : 0).toFixed(2))
    }));
  const onboardingFunnel = onboardingSteps.map((item, index) => {
    const nextArrivals = onboardingSteps[index + 1]?.arrivals ?? item.completions;
    return {
      ...item,
      dropoffCount: Math.max(0, item.arrivals - nextArrivals)
    };
  });
  const levelProgress = [...levelStats.values()]
    .map((item) => {
      const userStartMap = levelUserStarts.get(item.levelId + (item.levelType ? ` (${item.levelType})` : "")) ?? levelUserStarts.get(item.levelId) ?? new Map<string, number>();
      const inferredRetries = [...userStartMap.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
      const retries = item.retries > 0 ? item.retries : inferredRetries;
      const topFailReason = [...item.failReasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      return {
        levelId: item.levelId,
        levelType: item.levelType,
        starts: item.starts,
        completes: item.completes,
        fails: item.fails,
        retries,
        topFailReason
      };
    })
    .sort((a, b) => {
      const aNum = Number(a.levelId);
      const bNum = Number(b.levelId);
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
        return aNum - bNum;
      }
      return a.levelId.localeCompare(b.levelId, "zh-Hans-CN");
    });
  const levelFunnel = levelProgress.map((item) => ({
    ...item,
    completionRate: clampPercent(item.starts ? (item.completes / item.starts) * 100 : 0),
    failRate: clampPercent(item.starts ? (item.fails / item.starts) * 100 : 0)
  }));
  const levelFailReasonDistribution = failReasons;
  const levelRetryRanking = levelFunnel
    .slice()
    .sort((a, b) => b.retries - a.retries)
    .slice(0, 8)
    .map((item) => ({
      levelId: item.levelId,
      levelType: item.levelType,
      retries: item.retries,
      starts: item.starts,
      retryRate: clampPercent(item.starts ? (item.retries / item.starts) * 100 : 0)
    }));
  const microflowRows = [...microflowStats.entries()]
    .flatMap(([levelId, actionMap]) => {
      const totalCount = [...actionMap.values()].reduce((sum, item) => sum + item.count, 0);
      return [...actionMap.entries()].map(([action, item]) => ({
        levelId,
        action,
        count: item.count,
        ratio: clampPercent(totalCount ? (item.count / totalCount) * 100 : 0),
        avgDuration: Number((item.durationCount ? item.durationTotal / item.durationCount : 0).toFixed(2))
      }));
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);
  const microflowByLevel = [...microflowStats.entries()]
    .map(([levelId, actionMap]) => {
      const totalCount = [...actionMap.values()].reduce((sum, item) => sum + item.count, 0);
      return {
        levelId,
        actions: [...actionMap.entries()]
          .map(([action, item]) => ({
            action,
            count: item.count,
            ratio: clampPercent(totalCount ? (item.count / totalCount) * 100 : 0),
            avgDuration: Number((item.durationCount ? item.durationTotal / item.durationCount : 0).toFixed(2))
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
      };
    })
    .sort((a, b) => {
      const totalA = a.actions.reduce((sum, item) => sum + item.count, 0);
      const totalB = b.actions.reduce((sum, item) => sum + item.count, 0);
      return totalB - totalA;
    });

  const monetizationStoreFunnel: FunnelStage[] = [
    {
      label: "商店/礼包曝光",
      count: [...giftPackStats.values()].reduce((sum, item) => sum + item.exposures, 0)
    },
    {
      label: "点击",
      count: [...giftPackStats.values()].reduce((sum, item) => sum + item.clicks, 0)
    },
    {
      label: "下单",
      count: [...giftPackStats.values()].reduce((sum, item) => sum + item.orders, 0)
    },
    {
      label: "支付成功",
      count: [...giftPackStats.values()].reduce((sum, item) => sum + item.successes, 0)
    }
  ].map((stage, index, collection) => ({
    ...stage,
    rate: index === 0 ? 100 : clampPercent((stage.count / Math.max(collection[index - 1]?.count || 1, 1)) * 100),
    inferred: index === 0 && [...giftPackStats.values()].some((item) => item.inferred)
  }));

  const monetizationPaymentFunnel: FunnelStage[] = [
    {
      label: "支付请求",
      count: [...giftPackStats.values()].reduce((sum, item) => sum + item.clicks + item.orders, 0)
    },
    {
      label: "下单",
      count: [...giftPackStats.values()].reduce((sum, item) => sum + item.orders, 0)
    },
    {
      label: "支付成功",
      count: [...giftPackStats.values()].reduce((sum, item) => sum + item.successes, 0)
    }
  ].map((stage, index, collection) => ({
    ...stage,
    rate: index === 0 ? 100 : clampPercent((stage.count / Math.max(collection[index - 1]?.count || 1, 1)) * 100)
  }));

  const giftPackDistribution = [...giftPackStats.entries()]
    .map(([name, item]) => ({
      name,
      exposures: item.exposures,
      clicks: item.clicks,
      orders: item.orders,
      successes: item.successes,
      successRate: clampPercent(item.orders ? (item.successes / item.orders) * 100 : 0),
      inferred: item.inferred
    }))
    .sort((a, b) => b.exposures + b.successes - (a.exposures + a.successes))
    .slice(0, 10);

  const adPlacementBreakdown = [...adPlacementStats.entries()]
    .map(([placement, item]) => ({
      placement,
      requests: item.requests,
      plays: item.plays,
      clicks: item.clicks,
      rewards: item.rewards,
      clickRate: clampPercent(item.plays ? (item.clicks / item.plays) * 100 : 0),
      rewardRate: clampPercent(item.plays ? (item.rewards / item.plays) * 100 : 0),
      inferred: item.inferred
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 12);
  const adPlacementFlow = adPlacementBreakdown.map((item) => ({
    placement: item.placement,
    requests: item.requests,
    plays: item.plays,
    clicks: item.clicks
  }));

  const healthScore = clampPercent(
    successRate * 45 +
      (categories.onboarding.metrics.completionRate / 100) * 20 +
      (categories.level.metrics.completionRate / 100) * 20 +
      (categories.ads.metrics.completionRate / 100) * 10 +
      (Math.min(categories.monetization.metrics.conversionRate, 15) / 15) * 5
  );

  const diagnostics = buildDiagnostics({
    rows: cleanedDiagnosticRows,
    technicalSuccessRate: successRate,
    technicalErrorCount: errorCount,
    businessFailureCount,
    moduleCoverage: 0
  });
  const moduleCoverage = clampPercent(
    (["onboarding", "level", "ads", "monetization"] as const).reduce((count, key) => {
      return count + (diagnostics.moduleChecks[key].canAnalyze ? 1 : 0);
    }, 0) / 4 * 100
  );
  diagnostics.moduleCoverage = moduleCoverage;

  const metrics = [
    { metricKey: "active_users", metricLabel: "活跃用户数", metricValue: categories.system.metrics.activeUsers, dimension: "system" },
    { metricKey: "system_event_count", metricLabel: "公共事件量", metricValue: categories.system.metrics.eventCount, dimension: "system" },
    { metricKey: "system_valid_rate", metricLabel: "公共事件有效率", metricValue: categories.system.metrics.validRate, dimension: "system" },
    { metricKey: "system_error_rate", metricLabel: "公共事件异常占比", metricValue: categories.system.metrics.errorRate, dimension: "system" },
    { metricKey: "import_success_rate", metricLabel: "技术通过率", metricValue: Number((successRate * 100).toFixed(2)), dimension: "overview" },
    { metricKey: "business_failure_count", metricLabel: "业务失败事件数", metricValue: businessFailureCount, dimension: "overview" },
    { metricKey: "module_coverage", metricLabel: "模块覆盖率", metricValue: moduleCoverage, dimension: "overview" },
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
    technicalSuccessRate: successRate,
    technicalErrorCount: errorCount,
    businessFailureCount,
    moduleCoverage,
    cleaning: context ? { ...context } : undefined,
    diagnostics,
    unmatchedEvents,
    previewRows,
    topEvents,
    topPlacements,
    topLevels,
    failReasons,
    onboardingFunnel,
    onboardingStepTrend: onboardingSteps,
    onboardingSteps,
    levelProgress,
    levelFunnel,
    levelFailReasonDistribution,
    levelRetryRanking,
    microflowRows,
    microflowByLevel,
    monetizationStoreFunnel,
    monetizationPaymentFunnel,
    giftPackDistribution,
    adPlacementBreakdown,
    adPlacementFlow,
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
