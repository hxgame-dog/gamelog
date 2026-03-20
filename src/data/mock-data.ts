export type CategoryKey =
  | "system"
  | "onboarding"
  | "level"
  | "monetization"
  | "ads"
  | "custom";

export const categories = [
  { key: "system", label: "公共事件", color: "var(--blue)" },
  { key: "onboarding", label: "新手引导", color: "var(--green)" },
  { key: "level", label: "关卡事件", color: "var(--amber)" },
  { key: "monetization", label: "商业化", color: "var(--gold)" },
  { key: "ads", label: "广告事件", color: "var(--violet)" },
  { key: "custom", label: "自定义分类", color: "var(--teal)" }
] as const;

export const metrics = [
  {
    title: "版本健康分",
    value: "81.7",
    unit: " / 100",
    delta: "较昨日 +1.8",
    trend: [61, 63, 64, 67, 71, 77, 82],
    tone: "var(--green)"
  },
  {
    title: "最新导入批次",
    value: "97.6",
    unit: "% 通过",
    delta: "31,284 条日志",
    trend: [88, 86, 90, 92, 94, 96, 98],
    tone: "var(--blue)"
  },
  {
    title: "待处理异常",
    value: "6",
    unit: " 条",
    delta: "2 条高优先级",
    trend: [14, 12, 11, 10, 9, 7, 6],
    tone: "var(--red)"
  },
  {
    title: "本周 AI 洞察",
    value: "14",
    unit: " 条",
    delta: "3 条待确认",
    trend: [28, 31, 29, 36, 42, 47, 53],
    tone: "var(--teal)"
  }
];

export const overviewInsights = [
  {
    title: "引导第 4 步完成率继续下滑",
    description: "过去 3 个导入批次里，第 4 步到第 5 步完成率持续低于 62%，已经不是一次性波动，建议优先回看文案和点击热区。",
    tone: "var(--red)"
  },
  {
    title: "关卡 12 重试峰值仍然偏高",
    description: "失败原因主要集中在道具未命中和回退操作，说明玩家知道目标但执行成本偏高，更像设计问题不是数值问题。",
    tone: "var(--amber)"
  },
  {
    title: "商业化节奏暂时稳定",
    description: "礼包弹窗触发后广告完成率没有明显下探，当前版本的付费和广告节奏可以先维持，重点观察后续留存。",
    tone: "var(--gold)"
  }
];

export const planCategories = [
  {
    title: "新手引导",
    source: "系统推荐",
    items: ["tutorial_start", "tutorial_step_complete", "tutorial_exit"]
  },
  {
    title: "关卡事件",
    source: "AI 生成",
    items: ["level_start", "level_fail", "level_complete", "booster_use"]
  },
  {
    title: "商业化",
    source: "人工新增",
    items: ["iap_offer_show", "iap_purchase", "ad_reward_claim"]
  }
];

export const planFields = [
  {
    field: "event_name",
    type: "string",
    required: "Yes",
    sample: "tutorial_step_complete"
  },
  {
    field: "step_id",
    type: "string",
    required: "Yes",
    sample: "guide_04"
  },
  {
    field: "duration_sec",
    type: "number",
    required: "No",
    sample: "28.4"
  },
  {
    field: "result",
    type: "enum",
    required: "Yes",
    sample: "success"
  }
];

export const diagnosisItems = [
  {
    title: "关卡失败原因字段建议细化",
    detail: "当前 `level_fail` 只有 result 字段，后续无法区分操作失误、资源不足还是主动退出，建议至少补充 fail_reason / retry_count。",
    target: "level_fail",
    state: "待确认"
  },
  {
    title: "引导漏斗缺少中断点",
    detail: "如果没有 tutorial_skip / tutorial_background，当前引导漏斗只能看到流失，不能解释玩家为什么中断。",
    target: "tutorial_step_complete",
    state: "高优先级"
  }
];

export const uploadSteps = [
  { title: "选择项目 / 版本 / 方案版本", status: "已完成" },
  { title: "上传真实日志或模拟数据", status: "已完成" },
  { title: "字段映射与格式校验", status: "处理中" },
  { title: "导入结果摘要", status: "等待中" }
];

export const uploadSummary = [
  { label: "导入通过率", value: "97.6%", tone: "var(--green)" },
  { label: "错误记录", value: "742", tone: "var(--red)" },
  { label: "未匹配事件", value: "2", tone: "var(--amber)" },
  { label: "数据来源", value: "1.0.8 真实日志", tone: "var(--teal)" }
];

export const chartSeries = {
  onboardingMain: [94, 90, 82, 73, 64, 58],
  onboardingTrend: [66, 68, 65, 72, 70, 74, 69],
  onboardingDuration: [12, 18, 15, 21, 19, 24],
  levelMain: [100, 84, 67, 58, 53, 49],
  levelTrend: [36, 44, 41, 52, 49, 58, 55],
  levelFailReason: [24, 14, 18, 31, 12],
  monetizationMain: [100, 41, 18, 9],
  monetizationTrend: [12, 14, 13, 16, 18, 17, 21],
  monetizationMix: [42, 28, 16, 14]
};

export const reportCards = [
  {
    title: "数据异动",
    content: "相较版本 1.0.7，新手引导第 4 步完成率下降 9.3%，关卡 12 的失败率上升 6.1%，异常都集中在体验前 10 分钟内。",
    tone: "var(--red)"
  },
  {
    title: "归因推测",
    content: "当前更像是引导节奏和提示时机的组合问题。版本对比里，文案变长和提示出现后移同时发生，增加了玩家的犹豫成本。",
    tone: "var(--blue)"
  },
  {
    title: "调优建议",
    content: "优先缩短关键引导文案，在第 4 步前增加一次弱提示，并在关卡 12 开局 15 秒内加入一次道具演示试用。",
    tone: "var(--teal)"
  }
];

export const recentTasks = [
  { name: "1.0.8 日志导入", status: "完成", detail: "31,284 条日志已入库，字段映射通过率 97.6%" },
  { name: "Gemini 方案诊断", status: "待确认", detail: "识别出 2 条高优先级问题，等待策划确认补充字段" },
  { name: "版本对比报告", status: "处理中", detail: "正在对比 1.0.8 与 1.0.7 的引导和关卡核心指标" }
];
