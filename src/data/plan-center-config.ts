export const planCenterHelp = {
  overview: {
    title: "使用指南",
    summary: "从输入需求开始，先让 AI 生成完整方案包，再逐条修订公共属性、事件表、字典表和映射关系。",
    examples: [
      "示例输入：请为 Screw Fun 设计一套覆盖新手引导、关卡失败原因、广告位和支付流程的事件表，并补齐必要字典表。",
      "示例输入：请按“公共属性单独维护，事件字段按模块分组，配置型字段强制查表”的方式生成方案。"
    ],
    steps: [
      "先选择目标项目和已有方案，必要时再新建方案。",
      "在 AI 输入区选择自由描述、标准模板或参考表格。",
      "点击 AI 生成方案，等待公共属性、事件表、字典表和映射关系写回。",
      "先看结果区，再进入事件编辑区补齐业务目标和字段说明。",
      "完成后继续做 AI 诊断、导出或生成模拟数据。"
    ],
    pitfalls: [
      "不要把玩法目标和数据结论混在同一段描述里。",
      "先覆盖关键漏斗事件，再补充次要事件。",
      "字段只保留分析真正需要的内容，避免过多冗余字段。"
    ]
  },
  plan_list: {
    title: "方案列表",
    summary: "左侧用于切换方案和事件，适合先找准正在编辑的版本，再进入中间主编辑区。",
    examples: ["先切到目标版本，再进入事件编辑，避免在错误的方案版本里继续修改。"],
    steps: [
      "先切换到目标项目。",
      "从方案卡片进入对应版本。",
      "点具体事件后，中间编辑区会切换到该事件。"
    ],
    pitfalls: ["如果准备重生成，先确认当前是否需要覆盖已有事件。"]
  },
  ai_input: {
    title: "AI 生成输入",
    summary: "这里支持三种输入方式：自由描述、标准模板和参考表格。",
    examples: [
      "自由描述示例：前 5 分钟重点看新手引导流失，关卡失败原因必须区分超时和槽位满。",
      "参考表格示例：上传你已有的事件表或配置表结构，让 AI 按相同组织方式生成。"
    ],
    steps: [
      "自由描述适合玩法流程、漏斗目标和需要哪些字典表的说明。",
      "标准模板适合公共事件、商业化、广告、关卡等常见模块。",
      "参考表格适合上传目标事件表结构或配置表样例。"
    ],
    pitfalls: [
      "自由描述不要只写一句“帮我做埋点”，尽量包含目标和关键流程。",
      "参考表格不会直接导入，而是用于约束输出结构。"
    ]
  },
  event_editor: {
    title: "事件编辑区",
    summary: "AI 生成后，事件名、分类、触发说明和业务目标都需要人工确认。",
    examples: [
      "例如把 tutorial_step_complete 的业务目标写成：定位引导步骤完成率与高耗时节点。"
    ],
    steps: [
      "先检查事件名是否符合 snake_case。",
      "确认事件分类是否正确。",
      "补足业务目标和触发条件。"
    ],
    pitfalls: ["若一个事件承担多个分析目标，优先拆成更清晰的多个事件。"]
  },
  field_list: {
    title: "字段列表",
    summary: "字段区是研发最终参考的核心区域，要确保顺序、类型、说明和字典映射足够明确。",
    examples: [
      "例如 level_fail 事件至少要检查 level_id、fail_reason、survive_sec 是否完整。",
      "例如 iap_success 里的 product_id 应该映射到 ShopConfig，而不是前端随意写字符串。"
    ],
    steps: [
      "先保留公共主键，如 user_id、session_id、level_id。",
      "再补玩法相关字段，如 step_id、result、reason。",
      "检查哪些字段必须映射到字典表，再补示例值和说明。"
    ],
    pitfalls: [
      "避免把同一个字段名在不同事件里写成不同含义。",
      "不要让字段说明只写“备注”这类模糊描述。"
    ]
  },
  status: {
    title: "方案状态",
    summary: "右侧面板用于看生成状态、下一步建议和帮助说明。",
    examples: ["生成失败时先看卡在哪个阶段，例如“生成字段与字典”或“写回方案”，再决定是否重试。"],
    steps: [
      "生成前看当前是否允许覆盖。",
      "生成中关注阶段进度和错误提示。",
      "生成后根据 AI 引导继续修订。"
    ],
    pitfalls: ["生成失败时不要重复点击，先看失败阶段和原因。"]
  }
} as const;

export const planInputTemplates = [
  {
    key: "common",
    label: "公共事件",
    summary: "适合 session_start、session_end、app_open、error_report 等高复用事件。",
    prompt:
      "请补齐一套休闲手游通用公共事件，同时生成独立的全局公共属性区，包括启动、登录、会话、异常、客户端环境与基础用户属性。"
  },
  {
    key: "onboarding",
    label: "新手引导",
    summary: "适合新手引导步骤、完成率、流失节点和关键耗时分析。",
    prompt:
      "请基于新手引导流程生成事件，重点关注 step_start、step_complete、step_fail、tutorial_complete 等关键漏斗节点。"
  },
  {
    key: "level",
    label: "关卡事件",
    summary: "适合关卡开始、失败、完成、复活、重试、道具使用等行为。",
    prompt:
      "请生成关卡分析需要的核心事件，覆盖 level_start、level_fail、level_complete、retry、revive、booster_use 等场景。"
  },
  {
    key: "ads",
    label: "广告事件",
    summary: "适合激励视频、插屏、广告位曝光、触发和完成监测。",
    prompt:
      "请生成广告行为分析事件，覆盖 ad_impression、ad_click、ad_reward_claim、ad_close，并自动生成 ad_placement 对应字典表。"
  },
  {
    key: "monetization",
    label: "商业化 / IAP",
    summary: "适合首充、礼包、支付流程、订单状态和付费转化分析。",
    prompt:
      "请生成商业化与计费相关事件，覆盖 paywall_view、iap_click、iap_order_create、iap_success、iap_fail 等关键流程，并自动补充商品配置字典表。"
  }
] as const;

export const aiGenerationStages = [
  { key: "understand", label: "理解输入", detail: "解析玩法说明、模板或表格内容。" },
  { key: "categorize", label: "匹配事件分类", detail: "将需求映射到当前项目的事件分类与模块。" },
  { key: "events", label: "生成事件草案", detail: "产出事件名、显示名和触发说明。" },
  { key: "properties", label: "生成字段与字典", detail: "补全字段定义，并识别字典表和映射关系。" },
  { key: "persist", label: "写回方案", detail: "将结果保存到当前方案并刷新编辑区。" }
] as const;

export const spreadsheetMappingTargets = [
  { key: "ignore", label: "忽略该列", description: "这列不会送给 AI，也不会参与事件生成。", example: "-" },
  { key: "event_name", label: "事件名", description: "用于明确标准事件名或原始事件标识。", example: "iap_success" },
  { key: "event_display_name", label: "事件显示名", description: "用于补充更友好的事件中文名或展示名。", example: "支付成功" },
  { key: "business_goal", label: "业务目标", description: "说明该事件要支持什么分析目标。", example: "观察首充转化率" },
  { key: "trigger", label: "触发说明", description: "描述事件在什么时机上报。", example: "用户支付成功回调后上报" },
  { key: "category_hint", label: "事件分类提示", description: "帮助 AI 判断事件属于公共、新手、商业化等哪一类。", example: "商业化" },
  { key: "sku", label: "商品 / SKU", description: "商品 ID、礼包 ID 或内购项目标识。", example: "starter_pack_1" },
  { key: "price", label: "价格", description: "金额、价格或付费档位。", example: "6" },
  { key: "currency", label: "币种", description: "支付币种或地区货币。", example: "CNY" },
  { key: "placement", label: "广告位", description: "广告位、广告场景或 placement 标识。", example: "revive_rewarded" },
  { key: "reward_type", label: "奖励类型", description: "看激励广告或完成行为后的奖励类型。", example: "coins" },
  { key: "result", label: "结果状态", description: "成功、失败、取消等流程结果。", example: "success" },
  { key: "reason", label: "原因 / 失败原因", description: "失败原因、取消原因或异常上下文。", example: "payment_timeout" },
  { key: "step_id", label: "步骤 ID", description: "用于新手引导或流程步骤分析。", example: "step_3" },
  { key: "level_id", label: "关卡 ID", description: "用于关卡或阶段分析。", example: "level_12" },
  { key: "property_hint", label: "字段补充提示", description: "作为附加字段提示给 AI，用于生成更完整字段。", example: "channel / campaign / region" }
] as const;
