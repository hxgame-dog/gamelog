import { GoogleGenAI } from "@google/genai";
import { InputSourceType } from "@prisma/client";
import { z } from "zod";

import { planInputTemplates } from "@/data/plan-center-config";

import { getGeminiRuntimeConfig } from "./ai-config";
import { getPlanById, replacePlanEvents } from "./plans";
import { getCategoriesForProject } from "./projects";

const spreadsheetRowSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

const spreadsheetSheetSchema = z.object({
  name: z.string().min(1),
  headers: z.array(z.string()),
  rowCount: z.number().int().nonnegative(),
  previewRows: z.array(spreadsheetRowSchema).default([])
});

const generatePlanSchema = z
  .object({
    mode: z.enum(["free_text", "template", "spreadsheet"]),
    prompt: z.string().optional(),
    templateKeys: z.array(z.string()).optional(),
    spreadsheetPurpose: z.enum(["event_table", "dictionary_table"]).optional(),
    spreadsheetRows: z.array(spreadsheetRowSchema).optional(),
    spreadsheetSheets: z.array(spreadsheetSheetSchema).optional(),
    spreadsheetFileName: z.string().optional(),
    spreadsheetMappings: z
      .array(
        z.object({
          source: z.string(),
          target: z.string()
        })
      )
      .optional(),
    replaceExisting: z.boolean().optional().default(false)
  })
  .superRefine((value, ctx) => {
    if (value.mode === "free_text" && (!value.prompt || value.prompt.trim().length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prompt"],
        message: "请输入更完整的玩法说明或打点目标。"
      });
    }

    if (value.mode === "template" && (!value.templateKeys || value.templateKeys.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["templateKeys"],
        message: "请至少选择一个通用事件模板。"
      });
    }

    if (
      value.mode === "spreadsheet" &&
      (!value.spreadsheetRows || value.spreadsheetRows.length === 0) &&
      (!value.spreadsheetSheets || value.spreadsheetSheets.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["spreadsheetRows"],
        message: "请先上传并预览表格内容。"
      });
    }
  });

const generatedPlanSchema = z.object({
  planSummary: z.string().min(1),
  globalProperties: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        isRequired: z.boolean().default(true),
        sampleValue: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional()
      })
    )
    .default([]),
  events: z
    .array(
      z.object({
        categoryName: z.string().min(1),
        eventName: z.string().min(2),
        displayName: z.string().nullable().optional(),
        triggerDescription: z.string().nullable().optional(),
        businessGoal: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        properties: z.array(
          z.object({
            name: z.string().min(1),
            type: z.string().min(1),
            isRequired: z.boolean(),
            sampleValue: z.string().nullable().optional(),
            description: z.string().nullable().optional()
          })
        )
      })
    )
    .min(1, "Gemini 没有返回任何事件。"),
  dictionaries: z
    .array(
      z.object({
        name: z.string().min(1),
        configName: z.string().min(1),
        relatedModule: z.string().min(1),
        paramNames: z.array(z.string().min(1)).min(1),
        purpose: z.string().min(1),
        handoffRule: z.string().min(1),
        sourceType: z.string().default("AI_GENERATED")
      })
    )
    .default([]),
  dictionaryMappings: z
    .array(
      z.object({
        eventName: z.string().nullable().optional(),
        propertyName: z.string().min(1),
        dictionaryName: z.string().min(1),
        isRequiredMapping: z.boolean().default(true),
        mappingNote: z.string().nullable().optional()
      })
    )
    .default([])
});

const fallbackGlobalProperties = [
  {
    name: "user_id",
    type: "string",
    isRequired: true,
    sampleValue: "u_1024",
    description: "玩家唯一标识，用于用户级漏斗和留存分析。",
    category: "用户标识"
  },
  {
    name: "session_id",
    type: "string",
    isRequired: true,
    sampleValue: "sess_20260317_01",
    description: "当前会话唯一标识，用于串联一轮完整行为。",
    category: "会话信息"
  },
  {
    name: "app_version",
    type: "string",
    isRequired: true,
    sampleValue: "1.0.8",
    description: "当前客户端版本号。",
    category: "应用信息"
  },
  {
    name: "device_os",
    type: "string",
    isRequired: true,
    sampleValue: "iOS",
    description: "设备系统信息。",
    category: "设备信息"
  },
  {
    name: "channel",
    type: "string",
    isRequired: true,
    sampleValue: "AppStore",
    description: "安装来源渠道或投放渠道。",
    category: "应用信息"
  },
  {
    name: "country",
    type: "string",
    isRequired: false,
    sampleValue: "CN",
    description: "玩家所在国家或地区。",
    category: "地域信息"
  },
  {
    name: "coin_balance",
    type: "number",
    isRequired: false,
    sampleValue: "1200",
    description: "事件发生时玩家的金币余额。",
    category: "经济信息"
  }
] as const;

const dictionaryCatalog = [
  {
    name: "计费商品配置表",
    configName: "ShopConfig.xlsx",
    relatedModule: "商业化与广告",
    paramNames: ["product_id", "product_type"],
    purpose: "内购唯一凭证，用于统一商品和商品类型命名。",
    handoffRule: "内购事件必须读取该表，禁止前端写死商品魔法字符串。"
  },
  {
    name: "广告位枚举表",
    configName: "AdPlacementConfig.xlsx",
    relatedModule: "商业化与广告",
    paramNames: ["ad_placement"],
    purpose: "规范广告触发位命名，保证广告分析维度一致。",
    handoffRule: "广告展示、点击、领奖都必须从该表取值。"
  },
  {
    name: "关卡配置表",
    configName: "LevelConfig.xlsx",
    relatedModule: "关卡与进度",
    paramNames: ["level_id", "level_type"],
    purpose: "统一关卡绝对编号和底层类型。",
    handoffRule: "只上传关卡编号和类型，不上传 UI 显示名。"
  },
  {
    name: "新手引导步骤表",
    configName: "TutorialConfig.xlsx",
    relatedModule: "新手引导",
    paramNames: ["step_id", "step_name"],
    purpose: "精准定位引导步骤和流失节点。",
    handoffRule: "引导状态机流转时严格按此表上报步骤序号和步骤代码。"
  },
  {
    name: "活动配置表",
    configName: "ActivityConfig.xlsx",
    relatedModule: "运营与活动",
    paramNames: ["activity_id", "activity_type"],
    purpose: "区分具体活动期数和玩法类型，支撑分期对比。",
    handoffRule: "活动事件必须查表获取活动 ID 和玩法类型。"
  },
  {
    name: "奖励/道具配置表",
    configName: "ItemRewardConfig.xlsx",
    relatedModule: "运营活动 / 局内微观心流",
    paramNames: ["reward_id", "item_name"],
    purpose: "统一全游戏资产和道具底层命名。",
    handoffRule: "奖励发放和道具使用都使用统一 reward_id / item_name 体系。"
  },
  {
    name: "资源产销途径枚举",
    configName: "SourceEnum",
    relatedModule: "经济循环与社交",
    paramNames: ["gain_source"],
    purpose: "用于监控金币、体力等资源产出来源。",
    handoffRule: "资源发放类事件必须上报规范化来源枚举。"
  }
] as const;

const commonEventSeeds = [
  {
    categoryHint: "公共",
    eventName: "app_start",
    displayName: "应用启动",
    triggerDescription: "玩家打开游戏，应用冷启动时触发。",
    businessGoal: "衡量基础活跃和启动健康度。",
    notes: "用于计算 DAU 与启动成功率。",
    properties: [
      { name: "login_status", type: "string", isRequired: true, sampleValue: "guest", description: "启动后当前登录态。" },
      { name: "network_type", type: "string", isRequired: false, sampleValue: "wifi", description: "当前网络类型。" }
    ]
  },
  {
    categoryHint: "公共",
    eventName: "login_success",
    displayName: "登录成功",
    triggerDescription: "玩家成功完成静默登录或授权登录时触发。",
    businessGoal: "衡量登录成功率与账号类型分布。",
    notes: "建议保留归因和账号类型切片。",
    properties: [
      { name: "login_type", type: "string", isRequired: true, sampleValue: "guest", description: "登录方式。" },
      { name: "account_type", type: "int", isRequired: true, sampleValue: "1", description: "账号类型。" }
    ]
  },
  {
    categoryHint: "公共",
    eventName: "session_start",
    displayName: "会话开始",
    triggerDescription: "玩家进入可交互主流程时触发。",
    businessGoal: "统计有效会话和后续漏斗归因。",
    notes: "与 session_end 配对使用。",
    properties: [
      { name: "session_id", type: "string", isRequired: true, sampleValue: "sess_001", description: "当前会话唯一标识。" },
      { name: "entry_scene", type: "string", isRequired: false, sampleValue: "home", description: "会话开始场景。" }
    ]
  },
  {
    categoryHint: "公共",
    eventName: "session_end",
    displayName: "会话结束",
    triggerDescription: "玩家退出应用或会话结束时触发。",
    businessGoal: "分析会话时长、退出原因和中断位置。",
    notes: "建议和 session_start 使用相同 session_id。",
    properties: [
      { name: "session_id", type: "string", isRequired: true, sampleValue: "sess_001", description: "当前会话唯一标识。" },
      { name: "duration_sec", type: "number", isRequired: true, sampleValue: "320", description: "本次会话时长。" },
      { name: "exit_reason", type: "string", isRequired: false, sampleValue: "background", description: "退出原因。" }
    ]
  },
  {
    categoryHint: "公共",
    eventName: "error_report",
    displayName: "异常上报",
    triggerDescription: "客户端捕获异常、崩溃或严重报错时触发。",
    businessGoal: "衡量异常率与稳定性问题。",
    notes: "建议保留错误码和错误位置。",
    properties: [
      { name: "error_code", type: "string", isRequired: true, sampleValue: "net_timeout", description: "异常代码。" },
      { name: "error_message", type: "string", isRequired: false, sampleValue: "request timeout", description: "异常描述。" },
      { name: "scene_name", type: "string", isRequired: false, sampleValue: "battle", description: "异常发生场景。" }
    ]
  }
] as const;

function applyTemplateSeeds(
  generated: z.infer<typeof generatedPlanSchema>,
  categories: Awaited<ReturnType<typeof getCategoriesForProject>>,
  templateKeys?: string[]
) {
  if (!templateKeys?.includes("common")) {
    return generated;
  }

  const existingNames = new Set(generated.events.map((event) => event.eventName));
  const fallbackCategoryName =
    categories.find((category) => category.name.includes("公共"))?.name ?? categories[0]?.name ?? "公共事件";

  const seededEvents = commonEventSeeds
    .filter((seed) => !existingNames.has(seed.eventName))
    .map((seed) => ({
      categoryName: fallbackCategoryName,
      eventName: seed.eventName,
      displayName: seed.displayName,
      triggerDescription: seed.triggerDescription,
      businessGoal: seed.businessGoal,
      notes: seed.notes,
      properties: seed.properties.map((property) => ({
        ...property
      }))
    }));

  return {
    ...generated,
    events: [...generated.events, ...seededEvents]
  };
}

function enrichPackageFromFields(generated: z.infer<typeof generatedPlanSchema>) {
  const properties = generated.events.flatMap((event) =>
    event.properties.map((property) => ({
      eventName: event.eventName,
      propertyName: property.name.toLowerCase()
    }))
  );

  const detectedDictionaries = dictionaryCatalog.filter((dictionary) =>
    dictionary.paramNames.some((param) =>
      properties.some((property) => property.propertyName === param.toLowerCase())
    )
  );

  const dictionaries = [
    ...generated.dictionaries,
    ...detectedDictionaries
      .filter((dictionary) => !generated.dictionaries.some((item) => item.name === dictionary.name))
      .map((dictionary) => ({
        ...dictionary,
        paramNames: [...dictionary.paramNames],
        sourceType: "SYSTEM_IDENTIFIED"
      }))
  ];

  const dictionaryMappings = [
    ...generated.dictionaryMappings,
    ...detectedDictionaries.flatMap((dictionary) =>
      properties
        .filter((property) =>
          dictionary.paramNames.some((param) => param.toLowerCase() === property.propertyName)
        )
        .filter(
          (property) =>
            !generated.dictionaryMappings.some(
              (mapping) =>
                mapping.eventName === property.eventName &&
                mapping.propertyName.toLowerCase() === property.propertyName &&
                mapping.dictionaryName === dictionary.name
            )
        )
        .map((property) => ({
          eventName: property.eventName,
          propertyName: property.propertyName,
          dictionaryName: dictionary.name,
          isRequiredMapping: true,
          mappingNote: `${property.propertyName} 需读取 ${dictionary.configName}。`
        }))
    )
  ];

  return {
    ...generated,
    globalProperties: generated.globalProperties.length
      ? generated.globalProperties
      : fallbackGlobalProperties.map((item) => ({ ...item })),
    dictionaries,
    dictionaryMappings
  };
}

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text.trim();
}

function composeInputContext(payload: z.infer<typeof generatePlanSchema>) {
  if (payload.mode === "free_text") {
    return {
      sourceContent: payload.prompt!.trim(),
      sourceLabel: "自由描述生成",
      inputSourceType: InputSourceType.TEXT
    };
  }

  if (payload.mode === "template") {
    const selectedTemplates = planInputTemplates.filter((item) =>
      (payload.templateKeys ?? []).includes(item.key)
    );

    const content = `__OMNILOG_TEMPLATE__${JSON.stringify({
      version: 1,
      templateKeys: selectedTemplates.map((item) => item.key),
      templates: selectedTemplates.map((item) => ({
        key: item.key,
        label: item.label,
        summary: item.summary,
        prompt: item.prompt
      }))
    })}`;

    return {
      sourceContent: content,
      sourceLabel: `模板增强生成（${selectedTemplates.map((item) => item.label).join("、")}）`,
      inputSourceType: InputSourceType.FORM
    };
  }

  const previewRows = (payload.spreadsheetRows ?? []).slice(0, 12);
  const sheetSummary = (payload.spreadsheetSheets ?? []).map((sheet) => ({
    name: sheet.name,
    headers: sheet.headers,
    rowCount: sheet.rowCount,
    previewRows: sheet.previewRows.slice(0, 5)
  }));
  return {
    sourceContent: [
      `表格文件：${payload.spreadsheetFileName ?? "uploaded-file"}`,
      `参考类型：${payload.spreadsheetPurpose === "dictionary_table" ? "字典表参考" : "事件表参考"}`,
      sheetSummary.length
        ? `工作表结构：\n${JSON.stringify(sheetSummary, null, 2)}`
        : "工作表结构：未提供",
      "字段映射：",
      JSON.stringify(payload.spreadsheetMappings ?? [], null, 2),
      "主表预览：",
      JSON.stringify(previewRows, null, 2)
    ].join("\n\n"),
    sourceLabel: `${
      payload.spreadsheetPurpose === "dictionary_table" ? "字典表转方案" : "事件表转方案"
    }（${payload.spreadsheetFileName ?? "spreadsheet"}）`,
    inputSourceType: InputSourceType.FILE
  };
}

export async function generateTrackingPlanFromPrompt(planId: string, input: unknown) {
  const payload = generatePlanSchema.parse(input);
  const plan = await getPlanById(planId);

  if (!plan) {
    throw new Error("方案不存在。");
  }

  if (plan.events.length > 0 && !payload.replaceExisting) {
    throw new Error("当前方案已经有事件了。若要重生成，请勾选覆盖现有事件。");
  }

  const categories = await getCategoriesForProject(plan.projectId);
  if (!categories.length) {
    throw new Error("当前项目还没有可用的事件分类。");
  }

  const { apiKey, model } = await getGeminiRuntimeConfig();
  const ai = new GoogleGenAI({ apiKey });

  const categoryGuide = categories
    .map((category) => `- ${category.name}${category.description ? `：${category.description}` : ""}`)
    .join("\n");

  const inputContext = composeInputContext(payload);
  const systemPrompt = [
    "你是一个游戏埋点方案专家，需要把手游策划的想法、模板清单或表格资料转成研发可执行的标准化事件方案。",
    "输出必须是严格 JSON，不要包含额外解释。",
    "事件命名使用 snake_case，字段命名也使用 snake_case。",
    "categoryName 必须从给定分类列表中选择最合适的一项。",
    "properties 只保留真正需要用于分析的字段，避免冗余。",
    "除了事件表，还要识别全局公共属性、字典表以及事件参数与字典的映射关系。",
    "如果输入是商业化、广告或计费表格，要主动补出分析所需事件和字段，而不是机械复制表格列名。",
    "每个事件至少给出 1 个字段，优先包含 user_id、level_id、step_id、result、reason、placement、product_id 等有分析意义的字段。",
    "对于 product_id、product_type、ad_placement、level_id、level_type、step_id、step_name、activity_id、activity_type、reward_id、item_name、gain_source 这些字段，要同步生成对应字典表和映射关系。"
  ].join("\n");

  const userPrompt = [
    `项目方案名称：${plan.name}`,
    `方案版本：${plan.version}`,
    `现有方案摘要：${plan.summary ?? "暂无"}`,
    `当前输入模式：${payload.mode}`,
    "可选事件分类：",
    categoryGuide,
    "请根据下面的输入内容，生成一份完整的打点方案包。",
    "返回 JSON 结构：",
    JSON.stringify(
      {
        planSummary: "string",
        globalProperties: [
          {
            name: "string",
            type: "string",
            isRequired: true,
            sampleValue: "string",
            description: "string",
            category: "string"
          }
        ],
        events: [
          {
            categoryName: "string",
            eventName: "string",
            displayName: "string",
            triggerDescription: "string",
            businessGoal: "string",
            notes: "string",
            properties: [
              {
                name: "string",
                type: "string",
                isRequired: true,
                sampleValue: "string",
                description: "string"
              }
            ]
          }
        ],
        dictionaries: [
          {
            name: "string",
            configName: "string",
            relatedModule: "string",
            paramNames: ["string"],
            purpose: "string",
            handoffRule: "string",
            sourceType: "AI_GENERATED"
          }
        ],
        dictionaryMappings: [
          {
            eventName: "string",
            propertyName: "string",
            dictionaryName: "string",
            isRequiredMapping: true,
            mappingNote: "string"
          }
        ]
      },
      null,
      2
    ),
    "输入内容如下：",
    inputContext.sourceContent
  ].join("\n\n");

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
      }
    ],
    config: {
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text;
  if (!rawText) {
    throw new Error("Gemini 没有返回可解析的内容。");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(rawText));
  } catch {
    throw new Error("Gemini 返回内容不是有效 JSON，请重试。");
  }

  const generated = enrichPackageFromFields(
    applyTemplateSeeds(generatedPlanSchema.parse(parsed), categories, payload.templateKeys)
  );
  const categoryMap = new Map(categories.map((category) => [category.name.toLowerCase(), category.id]));
  const fallbackCategoryId = categories[0]?.id;

  const events = generated.events.map((event) => ({
    categoryId: categoryMap.get(event.categoryName.toLowerCase()) ?? fallbackCategoryId ?? "",
    eventName: event.eventName,
    displayName: event.displayName ?? null,
    triggerDescription: event.triggerDescription ?? null,
    businessGoal: event.businessGoal ?? null,
    notes: event.notes ?? null,
    sourceLabel: "AI_GENERATED",
    properties: event.properties.map((property) => ({
      name: property.name,
      type: property.type,
      isRequired: property.isRequired,
      sampleValue: property.sampleValue ?? null,
      description: property.description ?? null
    }))
  }));

  const updatedPlan = await replacePlanEvents(planId, {
    summary: generated.planSummary,
    sourceContent: inputContext.sourceContent,
    sourceLabel: `${inputContext.sourceLabel} (${model})`,
    inputSourceType: inputContext.inputSourceType,
    events,
    globalProperties: generated.globalProperties,
    dictionaries: generated.dictionaries.map((dictionary) => ({
      ...dictionary,
      sourceType: "CANDIDATE"
    })),
    dictionaryMappings: generated.dictionaryMappings
  });

  return {
    plan: updatedPlan,
    generatedCount: events.length,
    candidateCount: generated.dictionaries.length,
    model,
    mode: payload.mode
  };
}
