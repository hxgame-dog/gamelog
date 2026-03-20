export const defaultProjectCategories = [
  { name: "公共事件", type: "SYSTEM", color: "var(--blue)", sortOrder: 1, description: "启动、退出、后台切前台等通用事件。" },
  { name: "新手引导", type: "SYSTEM", color: "var(--green)", sortOrder: 2, description: "新手引导步骤、完成、跳过、中断。" },
  { name: "关卡事件", type: "SYSTEM", color: "var(--amber)", sortOrder: 3, description: "关卡开始、失败、完成、重试、道具使用。" },
  { name: "商业化", type: "SYSTEM", color: "var(--gold)", sortOrder: 4, description: "礼包展示、购买、付费失败、首充。" },
  { name: "广告事件", type: "SYSTEM", color: "var(--violet)", sortOrder: 5, description: "激励视频、插屏、Banner、奖励领取。" }
] as const;

export const starterPlanTemplate = {
  name: "核心事件基线方案",
  version: "v1.0.0",
  summary: "覆盖新手引导、关卡与商业化的基础事件结构，适合作为首个分析版本的起点。",
  inputSource: {
    type: "TEXT",
    label: "系统初始化模板",
    content: "基于默认模板生成"
  },
  events: [
    {
      eventName: "tutorial_step_complete",
      displayName: "新手步骤完成",
      categoryName: "新手引导",
      triggerDescription: "玩家完成任一引导步骤时触发。",
      businessGoal: "衡量关键引导步骤完成率，定位理解成本较高的环节。",
      notes: "建议同时搭配 tutorial_exit 观察自然流失。",
      sourceLabel: "SYSTEM_TEMPLATE",
      properties: [
        { name: "step_id", type: "string", isRequired: true, sampleValue: "guide_04", description: "当前步骤唯一标识。" },
        { name: "duration_sec", type: "number", isRequired: false, sampleValue: "28.4", description: "完成当前步骤耗时。" },
        { name: "result", type: "enum", isRequired: true, sampleValue: "success", description: "步骤结果。" }
      ]
    },
    {
      eventName: "level_fail",
      displayName: "关卡失败",
      categoryName: "关卡事件",
      triggerDescription: "玩家在关卡中失败或主动退出时触发。",
      businessGoal: "分析失败原因、重试次数和卡点集中关卡。",
      notes: "建议补充 fail_reason 和 retry_count。",
      sourceLabel: "SYSTEM_TEMPLATE",
      properties: [
        { name: "level_id", type: "string", isRequired: true, sampleValue: "level_12", description: "关卡唯一标识。" },
        { name: "fail_reason", type: "enum", isRequired: false, sampleValue: "misclick", description: "失败原因枚举。" },
        { name: "retry_count", type: "number", isRequired: false, sampleValue: "3", description: "本局之前的重试次数。" }
      ]
    },
    {
      eventName: "iap_purchase",
      displayName: "礼包购买",
      categoryName: "商业化",
      triggerDescription: "玩家确认支付成功后触发。",
      businessGoal: "监控首日付费转化和礼包转化表现。",
      notes: "与礼包展示事件联动使用可形成完整漏斗。",
      sourceLabel: "SYSTEM_TEMPLATE",
      properties: [
        { name: "offer_id", type: "string", isRequired: true, sampleValue: "starter_pack_01", description: "礼包或商品 ID。" },
        { name: "price", type: "number", isRequired: true, sampleValue: "6", description: "支付价格。" },
        { name: "currency", type: "string", isRequired: true, sampleValue: "CNY", description: "币种。" }
      ]
    }
  ]
} as const;
