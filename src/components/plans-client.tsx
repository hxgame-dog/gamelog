"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";

import {
  aiGenerationStages,
  planCenterHelp,
  planInputTemplates
} from "@/data/plan-center-config";

import styles from "./plan-page.module.css";

type Plan = {
  id: string;
  name: string;
  version: string;
  status: string;
  summary?: string | null;
  diagnosisStatus: string;
  diagnosis?: {
    id: string;
    summary: string;
    generatedAt: string | number | Date;
    findings: Array<{
      type: string;
      severity: "high" | "medium" | "low";
      title: string;
      detail: string;
      eventName?: string | null;
      recommendation?: string | null;
    }>;
  } | null;
  inputSources?: Array<{
    id: string;
    type: string;
    label?: string | null;
    content?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    createdAt: string | number | Date;
  }>;
  globalProperties?: Array<{
    id: string;
    name: string;
    type: string;
    isRequired: boolean;
    sampleValue?: string | null;
    description?: string | null;
    category?: string | null;
  }>;
  dictionaries?: Array<{
    id: string;
    name: string;
    configName: string;
    relatedModule: string;
    paramNames: string[];
    purpose: string;
    handoffRule: string;
    sourceType: string;
  }>;
  dictionaryMappings?: Array<{
    id: string;
    eventName?: string | null;
    propertyName: string;
    isRequiredMapping: boolean;
    mappingNote?: string | null;
    dictionary?: {
      id: string;
      name: string;
      configName: string;
    } | null;
  }>;
  events: Array<{
    id: string;
    eventName: string;
    displayName?: string | null;
    triggerDescription?: string | null;
    businessGoal?: string | null;
    notes?: string | null;
    sourceLabel?: string | null;
    category?: { id?: string; name: string } | null;
    properties: Array<{
      id?: string;
      name: string;
      type: string;
      isRequired: boolean;
      sampleValue?: string | null;
      description?: string | null;
    }>;
  }>;
};

type Project = {
  id: string;
  name: string;
  currentVersion?: string | null;
};

type Category = {
  id: string;
  name: string;
};

type EditableProperty = {
  id?: string;
  name: string;
  type: string;
  isRequired: boolean;
  sampleValue?: string | null;
  description?: string | null;
};

type EditableGlobalProperty = {
  name: string;
  type: string;
  isRequired: boolean;
  sampleValue: string;
  description: string;
  category: string;
};

type EditableDictionary = {
  name: string;
  configName: string;
  relatedModule: string;
  paramNames: string;
  purpose: string;
  handoffRule: string;
  sourceType: string;
};

type EditableDictionaryMapping = {
  eventName: string;
  propertyName: string;
  dictionaryName: string;
  isRequiredMapping: boolean;
  mappingNote: string;
};

type EditableEvent = {
  id?: string;
  eventName: string;
  displayName: string;
  triggerDescription: string;
  businessGoal: string;
  notes: string;
  sourceLabel: string;
  categoryId: string;
  properties: EditableProperty[];
};

type PlanInputSource = NonNullable<Plan["inputSources"]>[number];

type GenerationMode = "free_text" | "template" | "spreadsheet";
type PlanStep = "create" | "generate" | "results" | "schema";
type HelpKey = keyof typeof planCenterHelp;
type SpreadsheetSheetRole = "global_properties" | "event_table" | "dictionary_reference" | "ignore";
type StageState = {
  key: string;
  label: string;
  detail: string;
  status: "waiting" | "processing" | "completed" | "failed";
  message?: string;
};

type PlanJob = {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  message: string;
  error: string | null;
  result: Record<string, unknown> | null;
};

type ExportVariant = "planner" | "developer";

type SpreadsheetRow = Record<string, string | number | boolean | null>;
type SpreadsheetSheet = {
  name: string;
  headers: string[];
  rowCount: number;
  previewRows: SpreadsheetRow[];
  rows: SpreadsheetRow[];
  role: SpreadsheetSheetRole;
  roleConfidence: SpreadsheetMapping["confidence"];
  roleReason: string;
  mappings: SpreadsheetMapping[];
  confirmed: boolean;
};
type SpreadsheetMapping = {
  source: string;
  target: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

type SpreadsheetTargetOption = {
  key: string;
  label: string;
  description: string;
  example: string;
};

type PersistedSpreadsheetSheet = Pick<
  SpreadsheetSheet,
  "name" | "headers" | "rowCount" | "role" | "roleConfidence" | "roleReason" | "confirmed" | "mappings"
> & {
  previewRows: SpreadsheetRow[];
  rows: SpreadsheetRow[];
};

const PERSISTED_SPREADSHEET_PREFIX = "__OMNILOG_SPREADSHEET__";
const PERSISTED_TEMPLATE_PREFIX = "__OMNILOG_TEMPLATE__";

function serializeSpreadsheetInputSource(
  sheets: SpreadsheetSheet[],
  fileName: string,
  activeSheetName: string | null
) {
  return `${PERSISTED_SPREADSHEET_PREFIX}${JSON.stringify({
    version: 1,
    fileName,
    activeSheetName,
    sheets: sheets.map((sheet) => ({
      name: sheet.name,
      headers: sheet.headers,
      rowCount: sheet.rowCount,
      previewRows: sheet.previewRows,
      rows: sheet.rows,
      role: sheet.role,
      roleConfidence: sheet.roleConfidence,
      roleReason: sheet.roleReason,
      mappings: sheet.mappings,
      confirmed: sheet.confirmed
    }))
  })}`;
}

function parseSpreadsheetInputSource(content?: string | null) {
  if (!content) {
    return null;
  }

  if (content.startsWith(PERSISTED_SPREADSHEET_PREFIX)) {
    try {
      const parsed = JSON.parse(content.slice(PERSISTED_SPREADSHEET_PREFIX.length)) as {
        fileName?: string;
        activeSheetName?: string | null;
        sheets?: PersistedSpreadsheetSheet[];
      };

      const sheets = (parsed.sheets ?? []).map((sheet) => ({
        ...sheet,
        rows: sheet.rows ?? sheet.previewRows ?? []
      }));

      if (!sheets.length) {
        return null;
      }

      return {
        fileName: parsed.fileName ?? "",
        activeSheetName: parsed.activeSheetName ?? sheets[0]?.name ?? null,
        sheets
      };
    } catch {
      return null;
    }
  }

  const sheetNameMatch = content.match(/工作表：(.+)/);
  const roleMatch = content.match(/角色：(.+)/);
  if (!sheetNameMatch) {
    return null;
  }

  const roleLabel = roleMatch?.[1]?.trim() ?? "";
  const role: SpreadsheetSheetRole =
    roleLabel.includes("公共属性")
      ? "global_properties"
      : roleLabel.includes("字典")
        ? "dictionary_reference"
        : "event_table";

  return {
    fileName: "",
    activeSheetName: sheetNameMatch[1].trim(),
    sheets: [
      {
        name: sheetNameMatch[1].trim(),
        headers: [],
        rowCount: 0,
        previewRows: [],
        rows: [],
        role,
        roleConfidence: "low" as const,
        roleReason: "这是旧版保存的参考表格输入，仅恢复了工作表记录，详细映射请重新上传确认。",
        mappings: [],
        confirmed: true
      }
    ]
  };
}

function parseTemplateInputSource(content?: string | null) {
  if (!content) {
    return null;
  }

  if (content.startsWith(PERSISTED_TEMPLATE_PREFIX)) {
    try {
      const parsed = JSON.parse(content.slice(PERSISTED_TEMPLATE_PREFIX.length)) as {
        templateKeys?: string[];
      };
      return {
        templateKeys: parsed.templateKeys ?? []
      };
    } catch {
      return null;
    }
  }

  const labels = Array.from(content.matchAll(/模板：(.+)/g)).map((match) => match[1]?.trim()).filter(Boolean);
  if (!labels.length) {
    return null;
  }

  const matchedKeys = planInputTemplates
    .filter((template) => labels.includes(template.label))
    .map((template) => template.key);

  return {
    templateKeys: matchedKeys
  };
}

function hasEffectiveMappings(sheet: SpreadsheetSheet) {
  return sheet.mappings.some((item) => {
    const target = item.target?.trim();
    return Boolean(target && target.length > 0 && target !== "ignore");
  });
}

function countEffectiveMappings(sheet: SpreadsheetSheet) {
  return sheet.mappings.filter((item) => {
    const target = item.target?.trim();
    return Boolean(target && target.length > 0 && target !== "ignore");
  }).length;
}

function countConfirmableSheets(sheets: SpreadsheetSheet[]) {
  return sheets.filter((sheet) => sheet.rowCount > 0 && sheet.role !== "ignore").length;
}

function isSpreadsheetFullyConfirmed(sheets: SpreadsheetSheet[]) {
  const confirmableSheets = sheets.filter((sheet) => sheet.rowCount > 0 && sheet.role !== "ignore");
  return confirmableSheets.length > 0 && confirmableSheets.every((sheet) => sheet.confirmed && hasEffectiveMappings(sheet));
}

function buildPlansUrl(
  projectId: string | null,
  planId?: string | null,
  eventId?: string | null,
  focusField?: string | null,
  step?: PlanStep | null
) {
  const params = new URLSearchParams();

  if (projectId) {
    params.set("projectId", projectId);
  }
  if (planId) {
    params.set("planId", planId);
  }
  if (eventId) {
    params.set("eventId", eventId);
  }
  if (focusField) {
    params.set("focusField", focusField);
  }
  if (step) {
    params.set("step", step);
  }

  const query = params.toString();
  return query ? `/plans?${query}` : "/plans";
}

function createBlankEvent(categoryId: string) {
  return {
    eventName: "new_event",
    displayName: "",
    triggerDescription: "",
    businessGoal: "",
    notes: "",
    sourceLabel: "MANUAL",
    categoryId,
    properties: [
      {
        name: "user_id",
        type: "string",
        isRequired: true,
        sampleValue: "u_10001",
        description: "用户唯一标识"
      }
    ]
  } satisfies EditableEvent;
}

function getEventPreviewFields(event: Plan["events"][number]) {
  return event.properties.slice(0, 5).map((property) => property.name);
}

function isCommonCategory(name?: string | null) {
  if (!name) {
    return false;
  }

  const normalized = name.toLowerCase();
  return normalized.includes("公共") || normalized.includes("common") || normalized.includes("global");
}

function getExpectedEventsForGroup(groupName: string) {
  const normalized = groupName.toLowerCase();

  if (normalized.includes("公共") || normalized.includes("common") || normalized.includes("global")) {
    return ["app_start", "login_success", "session_start", "session_end", "error_report"];
  }
  if (normalized.includes("新手") || normalized.includes("guide") || normalized.includes("tutorial")) {
    return ["tutorial_step_start", "tutorial_step_complete", "tutorial_step_fail", "tutorial_complete"];
  }
  if (normalized.includes("关卡") || normalized.includes("level")) {
    return ["level_start", "level_fail", "level_complete"];
  }
  if (normalized.includes("广告") || normalized.includes("ad")) {
    return ["ad_impression", "ad_click", "ad_reward_claim", "ad_close"];
  }
  if (
    normalized.includes("商业化") ||
    normalized.includes("iap") ||
    normalized.includes("monetization") ||
    normalized.includes("付费")
  ) {
    return ["paywall_view", "iap_click", "iap_order_create", "iap_success", "iap_fail"];
  }

  return [];
}

function createSuggestedEvent(eventName: string, categoryId: string) {
  const presetMap: Record<
    string,
    {
      displayName: string;
      triggerDescription: string;
      businessGoal: string;
      properties: EditableProperty[];
    }
  > = {
    app_start: {
      displayName: "应用启动",
      triggerDescription: "客户端冷启动或热启动完成后立即上报。",
      businessGoal: "衡量启动量、启动成功率和大盘活跃趋势。",
      properties: [
        { name: "launch_type", type: "string", isRequired: true, sampleValue: "cold", description: "启动类型" },
        { name: "client_time", type: "string", isRequired: true, sampleValue: "2026-03-17T10:00:00+08:00", description: "客户端启动时间" }
      ]
    },
    login_success: {
      displayName: "登录成功",
      triggerDescription: "玩家完成账号校验并进入游戏主流程时上报。",
      businessGoal: "观察登录成功率、渠道登录表现和首日进入率。",
      properties: [
        { name: "login_type", type: "string", isRequired: true, sampleValue: "guest", description: "登录方式" },
        { name: "account_id", type: "string", isRequired: true, sampleValue: "acc_1024", description: "账号标识" }
      ]
    },
    session_start: {
      displayName: "会话开始",
      triggerDescription: "玩家进入可操作状态并开启一轮会话时上报。",
      businessGoal: "统计会话次数、会话起点和行为序列分析入口。",
      properties: [
        { name: "session_id", type: "string", isRequired: true, sampleValue: "sess_1001", description: "会话唯一标识" },
        { name: "entry_scene", type: "string", isRequired: false, sampleValue: "home", description: "进入会话时所在场景" }
      ]
    },
    session_end: {
      displayName: "会话结束",
      triggerDescription: "玩家退出游戏或会话自然结束时上报。",
      businessGoal: "衡量会话时长、退出原因和活跃质量。",
      properties: [
        { name: "session_id", type: "string", isRequired: true, sampleValue: "sess_1001", description: "会话唯一标识" },
        { name: "duration_sec", type: "number", isRequired: true, sampleValue: "248", description: "本轮会话时长（秒）" },
        { name: "exit_reason", type: "string", isRequired: false, sampleValue: "background", description: "结束原因" }
      ]
    },
    error_report: {
      displayName: "异常上报",
      triggerDescription: "客户端捕获异常、报错或关键失败时上报。",
      businessGoal: "排查崩溃与异常，评估版本稳定性。",
      properties: [
        { name: "error_code", type: "string", isRequired: true, sampleValue: "net_timeout", description: "异常代码" },
        { name: "error_message", type: "string", isRequired: false, sampleValue: "request timeout", description: "异常详情" }
      ]
    },
    tutorial_step_start: {
      displayName: "引导步骤开始",
      triggerDescription: "引导状态机进入某个具体步骤时上报。",
      businessGoal: "构建新手漏斗，判断关键步骤的到达率。",
      properties: [
        { name: "step_id", type: "string", isRequired: true, sampleValue: "guide_03", description: "引导步骤 ID" },
        { name: "step_name", type: "string", isRequired: false, sampleValue: "use_drill", description: "引导步骤名称" }
      ]
    },
    tutorial_step_complete: {
      displayName: "引导步骤完成",
      triggerDescription: "玩家完成某个引导步骤时上报。",
      businessGoal: "衡量每个引导步骤的完成率和耗时。",
      properties: [
        { name: "step_id", type: "string", isRequired: true, sampleValue: "guide_03", description: "引导步骤 ID" },
        { name: "duration_sec", type: "number", isRequired: false, sampleValue: "8.4", description: "步骤耗时" }
      ]
    },
    tutorial_step_fail: {
      displayName: "引导步骤失败",
      triggerDescription: "玩家在引导步骤中断、失败或退出时上报。",
      businessGoal: "定位前期流失和高阻力步骤。",
      properties: [
        { name: "step_id", type: "string", isRequired: true, sampleValue: "guide_04", description: "引导步骤 ID" },
        { name: "fail_reason", type: "string", isRequired: false, sampleValue: "timeout", description: "失败原因" }
      ]
    },
    tutorial_complete: {
      displayName: "新手引导完成",
      triggerDescription: "玩家完成整段引导流程时上报。",
      businessGoal: "衡量完整引导完成率，作为早期留存前置指标。",
      properties: [
        { name: "total_duration_sec", type: "number", isRequired: false, sampleValue: "120", description: "完整引导耗时" }
      ]
    },
    level_start: {
      displayName: "关卡开始",
      triggerDescription: "玩家开始一局关卡时上报。",
      businessGoal: "衡量关卡进入率和关卡难度基线。",
      properties: [
        { name: "level_id", type: "string", isRequired: true, sampleValue: "47", description: "关卡 ID" },
        { name: "level_type", type: "string", isRequired: false, sampleValue: "normal", description: "关卡类型" }
      ]
    },
    level_fail: {
      displayName: "关卡失败",
      triggerDescription: "玩家在一局关卡中失败结算时上报。",
      businessGoal: "分析失败原因、卡点和失败前坚持时长。",
      properties: [
        { name: "level_id", type: "string", isRequired: true, sampleValue: "47", description: "关卡 ID" },
        { name: "fail_reason", type: "string", isRequired: false, sampleValue: "timeout", description: "失败原因" },
        { name: "survive_sec", type: "number", isRequired: false, sampleValue: "92", description: "失败前坚持时长" }
      ]
    },
    level_complete: {
      displayName: "关卡完成",
      triggerDescription: "玩家通关完成时上报。",
      businessGoal: "衡量通关率、通关时长和难度变化。",
      properties: [
        { name: "level_id", type: "string", isRequired: true, sampleValue: "47", description: "关卡 ID" },
        { name: "duration_sec", type: "number", isRequired: false, sampleValue: "131", description: "通关耗时" }
      ]
    },
    ad_impression: {
      displayName: "广告展示",
      triggerDescription: "广告位成功展示时上报。",
      businessGoal: "衡量广告触发和展示库存表现。",
      properties: [
        { name: "ad_placement", type: "string", isRequired: true, sampleValue: "FreeBox", description: "广告位" },
        { name: "ad_type", type: "string", isRequired: false, sampleValue: "rewarded", description: "广告类型" }
      ]
    },
    ad_click: {
      displayName: "广告点击",
      triggerDescription: "玩家点击广告创意或广告入口时上报。",
      businessGoal: "衡量广告点击率与广告质量。",
      properties: [
        { name: "ad_placement", type: "string", isRequired: true, sampleValue: "FreeBox", description: "广告位" }
      ]
    },
    ad_reward_claim: {
      displayName: "广告奖励领取",
      triggerDescription: "玩家完整观看激励广告并成功领取奖励时上报。",
      businessGoal: "评估激励广告完成率和奖励领取情况。",
      properties: [
        { name: "ad_placement", type: "string", isRequired: true, sampleValue: "FreeBox", description: "广告位" },
        { name: "reward_id", type: "string", isRequired: false, sampleValue: "coins_100", description: "奖励 ID" }
      ]
    },
    ad_close: {
      displayName: "广告关闭",
      triggerDescription: "广告被关闭时上报。",
      businessGoal: "分析广告中断、提前退出和关闭路径。",
      properties: [
        { name: "ad_placement", type: "string", isRequired: true, sampleValue: "FreeBox", description: "广告位" },
        { name: "close_reason", type: "string", isRequired: false, sampleValue: "skip", description: "关闭原因" }
      ]
    },
    paywall_view: {
      displayName: "付费墙曝光",
      triggerDescription: "玩家看到任意付费入口或付费弹窗时上报。",
      businessGoal: "观察付费入口曝光量和后续点击转化。",
      properties: [
        { name: "product_id", type: "string", isRequired: false, sampleValue: "scr013", description: "商品 ID" },
        { name: "placement", type: "string", isRequired: false, sampleValue: "fail_offer", description: "付费入口位置" }
      ]
    },
    iap_click: {
      displayName: "内购点击",
      triggerDescription: "玩家点击购买按钮时上报。",
      businessGoal: "衡量支付发起前的兴趣与点击转化。",
      properties: [
        { name: "product_id", type: "string", isRequired: true, sampleValue: "scr013", description: "商品 ID" },
        { name: "product_type", type: "string", isRequired: false, sampleValue: "fail_pack", description: "商品类型" }
      ]
    },
    iap_order_create: {
      displayName: "订单创建",
      triggerDescription: "客户端成功发起订单创建时上报。",
      businessGoal: "分析支付链路中订单创建成功率。",
      properties: [
        { name: "order_id", type: "string", isRequired: true, sampleValue: "order_10001", description: "订单 ID" },
        { name: "product_id", type: "string", isRequired: true, sampleValue: "scr013", description: "商品 ID" }
      ]
    },
    iap_success: {
      displayName: "支付成功",
      triggerDescription: "内购订单支付完成并发奖后上报。",
      businessGoal: "衡量支付成功率和首充转化。",
      properties: [
        { name: "order_id", type: "string", isRequired: true, sampleValue: "order_10001", description: "订单 ID" },
        { name: "product_id", type: "string", isRequired: true, sampleValue: "scr013", description: "商品 ID" },
        { name: "price", type: "number", isRequired: false, sampleValue: "6", description: "支付金额" }
      ]
    },
    iap_fail: {
      displayName: "支付失败",
      triggerDescription: "订单失败、取消或回调异常时上报。",
      businessGoal: "分析支付流失与失败原因。",
      properties: [
        { name: "order_id", type: "string", isRequired: false, sampleValue: "order_10001", description: "订单 ID" },
        { name: "product_id", type: "string", isRequired: true, sampleValue: "scr013", description: "商品 ID" },
        { name: "fail_reason", type: "string", isRequired: false, sampleValue: "payment_timeout", description: "失败原因" }
      ]
    }
  };

  const preset = presetMap[eventName] ?? {
    displayName: eventName,
    triggerDescription: "请补充该事件的具体触发时机。",
    businessGoal: "请补充该事件的分析目标。",
    properties: []
  };

  return {
    eventName,
    displayName: preset.displayName,
    triggerDescription: preset.triggerDescription,
    businessGoal: preset.businessGoal,
    notes: "",
    sourceLabel: "MANUAL",
    categoryId,
    properties: [
      {
        name: "user_id",
        type: "string",
        isRequired: true,
        sampleValue: "u_10001",
        description: "用户唯一标识"
      },
      ...preset.properties
    ]
  } satisfies EditableEvent;
}

function createGlobalPropertyDraft(plan: Plan | null) {
  return (plan?.globalProperties ?? []).map((property) => ({
    name: property.name,
    type: property.type,
    isRequired: property.isRequired,
    sampleValue: property.sampleValue ?? "",
    description: property.description ?? "",
    category: property.category ?? ""
  }));
}

function createDictionaryDraft(plan: Plan | null) {
  return (plan?.dictionaries ?? []).map((dictionary) => ({
    name: dictionary.name,
    configName: dictionary.configName,
    relatedModule: dictionary.relatedModule,
    paramNames: dictionary.paramNames.join(", "),
    purpose: dictionary.purpose,
    handoffRule: dictionary.handoffRule,
    sourceType: dictionary.sourceType
  }));
}

function createMappingDraft(plan: Plan | null) {
  return (plan?.dictionaryMappings ?? []).map((mapping) => ({
    eventName: mapping.eventName ?? "",
    propertyName: mapping.propertyName,
    dictionaryName: mapping.dictionary?.name ?? "",
    isRequiredMapping: mapping.isRequiredMapping,
    mappingNote: mapping.mappingNote ?? ""
  }));
}

function createDraftFromEvent(
  activeEvent: Plan["events"][number] | null,
  categories: Category[]
): EditableEvent | null {
  if (!activeEvent) {
    return null;
  }

  return {
    id: activeEvent.id,
    eventName: activeEvent.eventName,
    displayName: activeEvent.displayName ?? "",
    triggerDescription: activeEvent.triggerDescription ?? "",
    businessGoal: activeEvent.businessGoal ?? "",
    notes: activeEvent.notes ?? "",
    sourceLabel: activeEvent.sourceLabel ?? "MANUAL",
    categoryId: activeEvent.category?.id ?? categories[0]?.id ?? "",
    properties: activeEvent.properties.map((property) => ({
      id: property.id,
      name: property.name,
      type: property.type,
      isRequired: property.isRequired,
      sampleValue: property.sampleValue ?? "",
      description: property.description ?? ""
    }))
  };
}

function createInitialStages(): StageState[] {
  return aiGenerationStages.map((stage) => ({
    ...stage,
    status: "waiting"
  }));
}

function suggestMapping(header: string, role: SpreadsheetSheetRole = "event_table") {
  const result = (target: string, confidence: SpreadsheetMapping["confidence"], reason: string) => ({
    target,
    confidence,
    reason
  });
  const normalized = header.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  if (role === "global_properties") {
    if (normalized.includes("field")) {
      return result("field_name", "high", "列名直接包含 Field，识别为公共属性字段名。");
    }
    if (normalized.includes("type")) {
      return result("field_type", "high", "列名包含 Type，识别为字段类型。");
    }
    if (normalized.includes("req") || normalized.includes("required")) {
      return result("field_required", "high", "列名包含 Req/Required，识别为是否必填。");
    }
    if (normalized.includes("example") || normalized.includes("sample")) {
      return result("field_example", "high", "列名包含 Example，识别为示例值。");
    }
    if (normalized.includes("category")) {
      return result("field_category", "high", "列名包含 Category，识别为字段分类。");
    }
    if (normalized.includes("description") || normalized.includes("note")) {
      return result("field_description", "high", "列名包含 Description/Note，识别为字段说明。");
    }
    return result("property_hint", "low", "没有明确命中规则，建议人工确认为公共属性相关列。");
  }

  if (role === "dictionary_reference") {
    if (normalized.includes("config")) {
      return result("config_name", "high", "列名像配置名或配置表名。");
    }
    if (normalized.includes("module")) {
      return result("related_module", "high", "列名像关联模块。");
    }
    if (normalized.includes("param")) {
      return result("related_param", "high", "列名像关联参数。");
    }
    if (normalized.includes("purpose")) {
      return result("dictionary_purpose", "high", "列名像用途说明。");
    }
    if (normalized.includes("handoff") || normalized.includes("rule")) {
      return result("handoff_rule", "medium", "列名像研发约定或规范说明。");
    }
    if (normalized.includes("name")) {
      return result("dictionary_name", "medium", "列名包含 name，优先识别为字典名。");
    }
    return result("property_hint", "low", "没有明确命中规则，建议人工确认为字典表相关列。");
  }

  if (normalized.includes("event") && normalized.includes("name")) {
    return result("event_name", "high", "列名直接包含 event + name。");
  }
  if (normalized.includes("display") || normalized.includes("title")) {
    return result("event_display_name", "medium", "列名包含 display 或 title。");
  }
  if (normalized.includes("goal") || normalized.includes("purpose")) {
    return result("business_goal", "medium", "列名接近目标描述字段。");
  }
  if (normalized.includes("trigger")) {
    return result("trigger", "high", "列名包含 trigger。");
  }
  if (normalized.includes("param") && normalized.includes("name")) {
    return result("param_name", "high", "列名包含 param + name。");
  }
  if (normalized.includes("param") && normalized.includes("type")) {
    return result("param_type", "high", "列名包含 param + type。");
  }
  if (normalized.includes("req") || normalized.includes("required")) {
    return result("param_required", "high", "列名包含 Req/Required。");
  }
  if (normalized.includes("example") || normalized.includes("sample")) {
    return result("param_example", "high", "列名包含 Example/Sample。");
  }
  if (normalized.includes("description")) {
    return result("param_description", "high", "列名包含 Description。");
  }
  if (normalized.includes("category") || normalized.includes("module")) {
    return result("category_hint", "medium", "列名像分类或模块信息。");
  }
  if (normalized.includes("sku") || normalized.includes("product") || normalized.includes("item")) {
    return result("sku", "high", "列名像商品或 SKU 标识。");
  }
  if (normalized.includes("price") || normalized.includes("amount")) {
    return result("price", "high", "列名像金额或价格。");
  }
  if (normalized.includes("currency")) {
    return result("currency", "high", "列名包含 currency。");
  }
  if (normalized.includes("placement") || normalized.includes("ad_unit") || normalized.includes("slot")) {
    return result("placement", "high", "列名像广告位或 placement。");
  }
  if (normalized.includes("reward")) {
    return result("reward_type", "medium", "列名包含 reward。");
  }
  if (normalized.includes("result") || normalized.includes("status")) {
    return result("result", "medium", "列名像结果状态字段。");
  }
  if (normalized.includes("reason") || normalized.includes("error")) {
    return result("reason", "high", "列名像原因或错误信息。");
  }
  if (normalized.includes("step")) {
    return result("step_id", "medium", "列名包含 step。");
  }
  if (normalized.includes("level") || normalized.includes("stage")) {
    return result("level_id", "medium", "列名包含 level 或 stage。");
  }

  return result("property_hint", "low", "没有明确命中规则，建议人工确认。");
}

function buildMappedRows(rows: SpreadsheetRow[], mappings: SpreadsheetMapping[]) {
  const activeMappings = mappings.filter((item) => item.target !== "ignore");

  return rows.map((row) => {
    const nextRow: SpreadsheetRow = {};
    activeMappings.forEach((mapping) => {
      nextRow[mapping.target] = row[mapping.source] ?? null;
    });
    return nextRow;
  });
}

function normalizeSpreadsheetToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[()（）]/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function guessSheetRole(name: string, headers: string[]) {
  const normalizedName = normalizeSpreadsheetToken(name);
  const normalizedHeaders = headers.map((header) => normalizeSpreadsheetToken(header));

  const hasAnyHeader = (...patterns: string[]) =>
    patterns.some((pattern) => normalizedHeaders.some((header) => header.includes(pattern)));

  if (
    normalizedName.includes("global") ||
    normalizedName.includes("公共属性") ||
    (hasAnyHeader("field", "字段名") &&
      hasAnyHeader("req", "必填") &&
      hasAnyHeader("category", "分类"))
  ) {
    return {
      role: "global_properties" as const,
      confidence: "high" as const,
      reason: "工作表名称或列头更像公共属性底座字段定义。"
    };
  }

  if (
    normalizedName.includes("config") ||
    normalizedName.includes("字典") ||
    normalizedName.includes("枚举") ||
    hasAnyHeader("config_name", "配置名", "枚举名") ||
    (hasAnyHeader("param", "参数") && hasAnyHeader("handoff", "约定", "规范"))
  ) {
    return {
      role: "dictionary_reference" as const,
      confidence: "medium" as const,
      reason: "工作表名称或列头更像字典表 / 配置表参考。"
    };
  }

  if (
    hasAnyHeader("event_name", "事件名") ||
    hasAnyHeader("trigger", "触发") ||
    hasAnyHeader("param_name", "参数名")
  ) {
    return {
      role: "event_table" as const,
      confidence: "high" as const,
      reason: "列头包含事件名、触发说明或参数名，判断为事件表。"
    };
  }

  return {
    role: "event_table" as const,
    confidence: "low" as const,
    reason: "未命中明确规则，默认按事件表处理，请人工确认。"
  };
}

function getMappingGroupsForRole(role: SpreadsheetSheetRole) {
  if (role === "global_properties") {
    return [
      {
        label: "基础控制",
        options: [
          { key: "ignore", label: "忽略该列", description: "这列不会参与生成。", example: "-" }
        ]
      },
      {
        label: "公共属性字段",
        options: [
          { key: "field_name", label: "字段名 (Field)", description: "公共属性字段名。", example: "user_id" },
          { key: "field_type", label: "类型 (Type)", description: "字段类型。", example: "string" },
          { key: "field_required", label: "必填 (Req)", description: "字段是否必填。", example: "required" },
          { key: "field_example", label: "示例值 (Example)", description: "字段示例值。", example: "u_1024" },
          { key: "field_category", label: "分类 (Category)", description: "公共属性分组。", example: "设备信息" },
          { key: "field_description", label: "说明 / 备注 (Description)", description: "字段用途和备注。", example: "玩家唯一标识" }
        ]
      },
      {
        label: "附加提示",
        options: [
          { key: "property_hint", label: "字段补充提示", description: "用于告诉 AI 该列的额外语义。", example: "region / language / vip_level" }
        ]
      }
    ];
  }

  if (role === "dictionary_reference") {
    return [
      {
        label: "基础控制",
        options: [{ key: "ignore", label: "忽略该列", description: "这列不会参与生成。", example: "-" }]
      },
      {
        label: "字典定义",
        options: [
          { key: "dictionary_name", label: "字典名", description: "例如：广告位枚举表。", example: "广告位枚举表" },
          { key: "config_name", label: "配置名 / 枚举名", description: "配置表文件名或枚举名。", example: "AdPlacementConfig.xlsx" },
          { key: "related_module", label: "关联模块", description: "强关联的业务模块。", example: "商业化与广告" },
          { key: "related_param", label: "关联参数", description: "需要查表的参数名。", example: "ad_placement" },
          { key: "dictionary_purpose", label: "用途说明", description: "字典表在分析中的作用。", example: "规范广告位命名" },
          { key: "handoff_rule", label: "研发约定", description: "研发接入时的规范说明。", example: "禁止前端写死字符串" },
          { key: "property_hint", label: "字段补充提示", description: "附加说明。", example: "只取底层 ID，不取 UI 文案" }
        ]
      }
    ];
  }

  return [
    {
      label: "基础控制",
      options: [{ key: "ignore", label: "忽略该列", description: "这列不会参与生成。", example: "-" }]
    },
    {
      label: "事件信息",
      options: [
        { key: "event_name", label: "事件名", description: "标准 snake_case 事件名。", example: "level_fail" },
        { key: "event_display_name", label: "事件显示名", description: "用于产品或表格阅读的事件中文名。", example: "关卡失败" },
        { key: "trigger", label: "触发说明", description: "事件在什么时机上报。", example: "结算失败弹窗出现时上报" },
        { key: "business_goal", label: "业务目标", description: "该事件支持什么分析目标。", example: "定位失败原因与卡点" },
        { key: "category_hint", label: "事件分类提示", description: "帮助识别所属模块。", example: "关卡与进度" }
      ]
    },
    {
      label: "参数字段",
      options: [
        { key: "param_name", label: "参数名 (Param Name)", description: "单个事件参数名。", example: "fail_reason" },
        { key: "param_type", label: "参数类型 (Type)", description: "参数类型。", example: "string" },
        { key: "param_required", label: "必填", description: "参数是否必填。", example: "required" },
        { key: "param_example", label: "示例值 (Example)", description: "参数示例值。", example: "timeout" },
        { key: "param_description", label: "参数说明 (Description)", description: "参数的业务含义。", example: "失败原因" }
      ]
    },
    {
      label: "商业化 / 广告扩展",
      options: [
        { key: "sku", label: "商品 / SKU", description: "商品或礼包标识。", example: "scr013" },
        { key: "price", label: "价格", description: "商品金额。", example: "6" },
        { key: "currency", label: "币种", description: "货币类型。", example: "CNY" },
        { key: "placement", label: "广告位", description: "广告 placement。", example: "FreeBox" },
        { key: "reward_type", label: "奖励类型", description: "激励广告或奖励类型。", example: "coins" }
      ]
    },
    {
      label: "流程扩展",
      options: [
        { key: "result", label: "结果状态", description: "成功、失败等结果值。", example: "success" },
        { key: "reason", label: "原因 / 失败原因", description: "失败或退出原因。", example: "slot_full" },
        { key: "step_id", label: "步骤 ID", description: "引导或流程步骤标识。", example: "use_drill" },
        { key: "level_id", label: "关卡 ID", description: "关卡编号。", example: "47" },
        { key: "property_hint", label: "字段补充提示", description: "用于补充 AI 对列语义的理解。", example: "channel / region / campaign" }
      ]
    }
  ];
}

function getTargetPresentation(targetKey: string, role: SpreadsheetSheetRole) {
  const groups = getMappingGroupsForRole(role);
  for (const group of groups) {
    const option = group.options.find((item) => item.key === targetKey);
    if (option) {
      return {
        label: option.label,
        description: option.description,
        example: option.example,
        groupLabel: group.label
      };
    }
  }

  return {
    label: targetKey,
    description: "",
    example: "",
    groupLabel: "其他"
  };
}

function getSheetRoleLabel(role: SpreadsheetSheetRole) {
  if (role === "global_properties") {
    return "公共属性表";
  }
  if (role === "dictionary_reference") {
    return "字典表参考";
  }
  if (role === "ignore") {
    return "忽略该表";
  }
  return "事件表";
}

function getConfidenceLabel(confidence: SpreadsheetMapping["confidence"]) {
  if (confidence === "high") {
    return "高置信";
  }
  if (confidence === "medium") {
    return "中置信";
  }
  return "低置信";
}

function formatInputSource(type?: string | null) {
  if (type === "FORM") {
    return "标准模板";
  }
  if (type === "FILE") {
    return "参考表格";
  }
  return "自由描述";
}

function getInsightCopy({
  activePlan,
  activeEvent,
  isGenerating,
  latestSource,
  resultView
}: {
  activePlan: Plan | null;
  activeEvent: Plan["events"][number] | null;
  isGenerating: boolean;
  latestSource?: PlanInputSource;
  resultView?: "global" | "events" | "candidates" | "dictionaries";
}) {
  if (!activePlan) {
    return "先创建一份方案，再选择自由描述、模板或表格上传作为第一批输入。";
  }

  if (isGenerating) {
    return "AI 正在处理中。等阶段面板全部完成后，再检查分类、事件命名和字段定义。";
  }

  if (!activePlan.events.length) {
    return "当前方案还没有事件。最适合先用通用模板或玩法描述生成第一版，再人工修订。";
  }

  const pendingCandidates = (activePlan.dictionaries ?? []).filter((dictionary) => dictionary.sourceType === "CANDIDATE").length;
  if (pendingCandidates > 0 && resultView !== "global" && resultView !== "events" && resultView !== "candidates") {
    return `当前还有 ${pendingCandidates} 个字典候选待确认。建议先完成候选确认，再执行 AI 诊断与方案确认。`;
  }

  if (!activeEvent) {
    return "这份方案已有事件，建议先从左侧选择一个关键事件，检查触发说明和字段是否完整。";
  }

  if (resultView === "global") {
    return "你当前看到的是所有事件共享的公共属性底座，建议重点检查等级、金币、设备、版本、地区等横切分析字段是否齐全。";
  }

  if (resultView === "events") {
    return "你当前看到的是事件表结果，建议先核对每个模块下的事件是否够全，再看每条事件的触发说明、事件字段和共享公共属性是否合理。";
  }

  if (resultView === "candidates") {
    return `你当前看到的是基于整份事件表统一扫描出的字典候选。当前还有 ${pendingCandidates} 个候选待确认，建议先确认哪些字段必须查表，再生成正式字典表和映射关系。`;
  }

  if (resultView === "dictionaries") {
    return pendingCandidates > 0
      ? `你当前看到的是已确认字典和正式映射关系，但仍有 ${pendingCandidates} 个候选未处理。建议先回到“字典候选”补完，再执行 AI 诊断。`
      : "你当前看到的是已确认字典和正式映射关系，建议重点核对 product_id、ad_placement、level_id、step_id 这类配置型字段是否都查到了正确字典。";
  }

  if (latestSource?.type === "FILE") {
    return "这份方案最近来自表格输入，建议重点检查字段映射是否过于贴近原表，必要时补充业务语义字段。";
  }

  return "这份方案已经可以继续做 AI 诊断、确认方案，或导出给研发进行埋点接入。";
}

function getSeverityLabel(severity: "high" | "medium" | "low") {
  if (severity === "high") {
    return "高优先级";
  }
  if (severity === "medium") {
    return "中优先级";
  }
  return "低优先级";
}

function HelpButton({
  label,
  active,
  onClick
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.helpButton} ${active ? styles.helpButtonActive : ""}`}
      onClick={onClick}
      aria-label={`${label}帮助`}
    >
      ?
    </button>
  );
}

export function PlansHeaderActions() {
  const [isGuideOpen, setGuideOpen] = useState(false);

  return (
    <>
      <div className="header-actions">
        <button className="button-secondary" type="button" onClick={() => setGuideOpen(true)}>
          使用指南
        </button>
      </div>

      {isGuideOpen ? (
        <div className={styles.guideOverlay} onClick={() => setGuideOpen(false)}>
          <aside className={styles.guideDrawer} onClick={(event) => event.stopPropagation()}>
            <div className={styles.guideHeader}>
              <div>
                <p className={styles.sectionLabel}>方案设计</p>
                <h2 className="section-title" style={{ fontSize: 20 }}>
                  {planCenterHelp.overview.title}
                </h2>
              </div>
              <button className="button-ghost" type="button" onClick={() => setGuideOpen(false)}>
                关闭
              </button>
            </div>
            <p className={styles.guideLead}>{planCenterHelp.overview.summary}</p>
            <div className={styles.helpBlock}>
              <h3 className={styles.helpBlockTitle}>推荐操作路径</h3>
              <ol className={styles.helpList}>
                {planCenterHelp.overview.steps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
            <div className={styles.helpBlock}>
              <h3 className={styles.helpBlockTitle}>常见误区</h3>
              <ul className={styles.helpList}>
                {planCenterHelp.overview.pitfalls.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {"examples" in planCenterHelp.overview && planCenterHelp.overview.examples?.length ? (
              <div className={styles.helpBlock}>
                <h3 className={styles.helpBlockTitle}>输入示例</h3>
                <ul className={styles.helpList}>
                  {planCenterHelp.overview.examples.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function PlansClient({
  projects,
  activeProjectId,
  activePlanId,
  activeEventId,
  initialFocusField,
  initialStep,
  initialPlans,
  categories
}: {
  projects: Project[];
  activeProjectId: string | null;
  activePlanId: string | null;
  activeEventId: string | null;
  initialFocusField: string | null;
  initialStep: PlanStep;
  initialPlans: Plan[];
  categories: Category[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [summary, setSummary] = useState("");
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    activePlanId ?? initialPlans[0]?.id ?? null
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    activeEventId ?? initialPlans[0]?.events[0]?.id ?? null
  );
  const [currentStep, setCurrentStep] = useState<PlanStep>(initialStep);
  const [focusField, setFocusField] = useState<string | null>(initialFocusField);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeHelp, setActiveHelp] = useState<HelpKey>("overview");
  const [currentResultView, setCurrentResultView] = useState<"global" | "events" | "candidates" | "dictionaries">("events");
  const [progressStages, setProgressStages] = useState<StageState[]>(createInitialStages());
  const [progressMessage, setProgressMessage] = useState<string>("等待新的 AI 生成任务。");
  const [isGenerating, setIsGenerating] = useState(false);
  const progressIndexRef = useRef(0);
  const progressTimerRef = useRef<number | null>(null);
  const plans = initialPlans;
  const activePlan =
    plans.find((plan) => plan.id === selectedPlanId) ??
    plans.find((plan) => plan.id === activePlanId) ??
    plans[0] ??
    null;
  const activeEvent =
    activePlan?.events.find((event) => event.id === selectedEventId) ??
    activePlan?.events.find((event) => event.id === activeEventId) ??
    activePlan?.events[0] ??
    null;
  const latestInputSource = activePlan?.inputSources?.at(-1);

  function navigate(
    projectId: string | null,
    planId?: string | null,
    eventId?: string | null,
    nextFocusField?: string | null,
    nextStep?: PlanStep | null
  ) {
    setFocusField(nextFocusField ?? null);
    if (nextStep) {
      setCurrentStep(nextStep);
    }
    router.push(buildPlansUrl(projectId, planId, eventId, nextFocusField, nextStep ?? currentStep));
  }

  function refreshWithSelection(
    planId?: string | null,
    eventId?: string | null,
    nextFocusField?: string | null,
    nextStep?: PlanStep | null
  ) {
    const params = new URLSearchParams(searchParams.toString());

    if (activeProjectId) {
      params.set("projectId", activeProjectId);
    }

    const resolvedPlanId = planId ?? activePlan?.id ?? null;
    const resolvedEventId = eventId ?? activeEvent?.id ?? null;

    if (resolvedPlanId) {
      params.set("planId", resolvedPlanId);
    } else {
      params.delete("planId");
    }

    if (resolvedEventId) {
      params.set("eventId", resolvedEventId);
    } else {
      params.delete("eventId");
    }
    if (nextFocusField) {
      params.set("focusField", nextFocusField);
    } else {
      params.delete("focusField");
    }
    const resolvedStep = nextStep ?? currentStep;
    params.set("step", resolvedStep);

    router.replace(`/plans?${params.toString()}`);
    router.refresh();
  }

  function resetProgress(messageText = "等待新的 AI 生成任务。") {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    progressIndexRef.current = 0;
    setProgressStages(createInitialStages());
    setProgressMessage(messageText);
  }

  function startProgress() {
    resetProgress("正在生成方案，请勿重复点击。");
    setProgressStages((current) =>
      current.map((item, index) =>
        index === 0 ? { ...item, status: "processing", message: "正在解析输入内容..." } : item
      )
    );

    progressTimerRef.current = window.setInterval(() => {
      progressIndexRef.current = Math.min(progressIndexRef.current + 1, aiGenerationStages.length - 2);
      const currentIndex = progressIndexRef.current;

      setProgressStages((previous) =>
        previous.map((item, index) => {
          if (index < currentIndex) {
            return { ...item, status: "completed", message: "已完成" };
          }
          if (index === currentIndex) {
            return { ...item, status: "processing", message: item.detail };
          }
          return item;
        })
      );
    }, 900);
  }

  const pendingCandidateCount = (activePlan?.dictionaries ?? []).filter(
    (dictionary) => dictionary.sourceType === "CANDIDATE"
  ).length;

  const stepItems: Array<{
    key: PlanStep;
    index: string;
    title: string;
    hint: string;
    status: "completed" | "current" | "waiting";
  }> = [
    {
      key: "create",
      index: "01",
      title: "新建方案",
      hint: "创建方案并确认当前版本状态",
      status: currentStep === "create" ? "current" : activePlan ? "completed" : "waiting"
    },
    {
      key: "generate",
      index: "02",
      title: "输入与生成",
      hint: "输入需求、确认映射并生成事件方案",
      status:
        currentStep === "generate"
          ? "current"
          : activePlan && ["results", "schema"].includes(currentStep) && activePlan.events.length > 0
            ? "completed"
            : "waiting"
    },
    {
      key: "results",
      index: "03",
      title: "方案结果区",
      hint: "审查公共属性、事件表和字典候选",
      status:
        currentStep === "results"
          ? "current"
          : (currentStep === "schema" || activePlan?.status === "CONFIRMED" || activePlan?.diagnosisStatus === "COMPLETED") &&
              pendingCandidateCount === 0
            ? "completed"
            : "waiting"
    },
    {
      key: "schema",
      index: "04",
      title: "字段结构查看",
      hint: "从结构视角统一检查四张逻辑表",
      status:
        currentStep === "schema"
          ? "current"
          : activePlan?.status === "CONFIRMED" && pendingCandidateCount === 0
            ? "completed"
            : "waiting"
    }
  ];
  const activePlanCompletionItems = activePlan
    ? [
        { label: "公共属性表", value: activePlan.globalProperties?.length ?? 0, hint: "所有事件共享的分析底座字段" },
        { label: "事件表", value: activePlan.events.length, hint: "当前方案中已生成的标准事件" },
        {
          label: "字典候选",
          value: pendingCandidateCount,
          hint: "由整份事件表统一扫描出的待确认字典"
        },
        {
          label: "正式字典",
          value: (activePlan.dictionaries ?? []).filter((dictionary) => dictionary.sourceType !== "CANDIDATE").length,
          hint: "已确认并纳入正式方案包的字典表"
        },
        {
          label: "完成度",
          value: `${Math.round((stepItems.filter((item) => item.status === "completed").length / stepItems.length) * 100)}%`,
          hint: `当前状态：${activePlan.status} / 诊断：${activePlan.diagnosisStatus}`
        }
      ]
    : [];

  return (
    <>
      <div className={styles.toolbar}>
        <select
          className="button-secondary"
          value={activeProjectId ?? ""}
          onChange={(event) => {
            navigate(event.target.value, null, null);
          }}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <button
          className="button-secondary"
          type="button"
          onClick={() => {
            setCreateOpen((current) => !current || currentStep !== "create");
            setCurrentStep("create");
            navigate(activeProjectId, activePlan?.id ?? null, activeEvent?.id ?? null, null, "create");
          }}
        >
          {isCreateOpen ? "收起新建方案" : "新建方案"}
        </button>
        <span className="pill">常用流程：输入需求 → 生成事件方案 → 确认字典候选 → 诊断/导出</span>
      </div>

      {error ? <div className={styles.feedbackError}>{error}</div> : null}
      {message ? <div className={styles.feedbackSuccess}>{message}</div> : null}
      <section className={`panel ${styles.stepShell}`}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionLabel}>步骤引导</p>
            <p className={styles.eventSource}>按步骤完成方案创建、输入生成、结果审查和结构查看。</p>
          </div>
        </div>
        <div className={styles.stepRail}>
          {stepItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`${styles.stepCard} ${item.status === "current" ? styles.stepCardActive : ""}`}
              onClick={() => {
                setCurrentStep(item.key);
                navigate(activeProjectId, activePlan?.id ?? null, activeEvent?.id ?? null, focusField, item.key);
              }}
            >
              <div className={styles.stepTop}>
                <strong>{item.index}</strong>
                <span className={`pill ${styles[`status_${item.status === "current" ? "processing" : item.status === "completed" ? "completed" : "waiting"}`]}`}>
                  {item.status === "current" ? "当前步骤" : item.status === "completed" ? "已完成" : "待处理"}
                </span>
              </div>
              <div className={styles.progressTitle}>{item.title}</div>
              <p className={styles.stepHint}>{item.hint}</p>
            </button>
          ))}
        </div>
      </section>

      <div className={`${styles.layout} ${currentStep === "results" ? "" : styles.layoutWide}`}>
        <section className={`panel ${styles.mainColumn}`}>
          {currentStep === "create" ? (
            <section className={styles.editorCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>01 新建方案</p>
                  <p className={styles.eventSource}>创建方案、查看已有版本和当前方案创建进度。</p>
                </div>
                <HelpButton
                  label="方案列表"
                  active={activeHelp === "plan_list"}
                  onClick={() => setActiveHelp("plan_list")}
                />
              </div>
              {isCreateOpen ? (
                <div className={styles.createCard}>
                  <div className={styles.createGrid}>
                    <input className={`${styles.mockInput} ${styles.toolbarField}`} value={name} onChange={(event) => setName(event.target.value)} placeholder="方案名称" />
                    <input className={`${styles.mockInput} ${styles.toolbarField}`} value={version} onChange={(event) => setVersion(event.target.value)} placeholder="版本号" />
                  </div>
                  <textarea className={`${styles.mockInput} ${styles.textarea}`} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="方案摘要（可选）" />
                  <button
                    className="button-primary"
                    disabled={isPending || !activeProjectId || !name || !version}
                    onClick={() =>
                      startTransition(async () => {
                        setError(null);
                        setMessage(null);
                        const response = await fetch("/api/plans", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ projectId: activeProjectId, name, version, summary })
                        });
                        const data = await response.json();
                        if (!response.ok) {
                          setError(data.error || "创建方案失败。");
                          return;
                        }
                        setMessage("方案已创建。");
                        setName("");
                        setVersion("");
                        setSummary("");
                        setCreateOpen(false);
                        setCurrentStep("generate");
                        navigate(activeProjectId, data.item?.id ?? null, null, null, "generate");
                        router.refresh();
                      })
                    }
                  >
                    创建方案并继续
                  </button>
                </div>
              ) : null}
              <div className={styles.planCardGrid}>
                {plans.length ? plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={`${styles.treeCard} ${activePlan?.id === plan.id ? styles.treeCardActive : ""}`}
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      setSelectedEventId(plan.events[0]?.id ?? null);
                      setMessage(null);
                      setError(null);
                      navigate(activeProjectId, plan.id, plan.events[0]?.id ?? null, null, "create");
                    }}
                  >
                    <h3 className={styles.treeTitle}>{plan.name} <span className="pill">{plan.version}</span></h3>
                    <p className={styles.treeMeta}>{plan.summary || "暂未填写方案摘要。"}</p>
                    <div className={styles.mappingSummary}>
                      <span className="pill">{plan.events.length} 个事件</span>
                      <span className="pill">{plan.status}</span>
                    </div>
                  </button>
                )) : <div className={styles.treeCard}><p className={styles.treeMeta}>当前项目还没有方案，先创建一份新的打点方案。</p></div>}
              </div>
              {activePlan ? (
                <div className={styles.checklistPanel}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p className={styles.sectionLabel}>当前方案进度</p>
                      <p className={styles.eventSource}>先确认当前方案包含哪些表、当前完成度和诊断状态，再进入输入与生成页继续主流程。</p>
                    </div>
                    <button className="button-primary" type="button" onClick={() => navigate(activeProjectId, activePlan.id, activeEvent?.id ?? null, null, "generate")}>
                      继续到输入与生成
                    </button>
                  </div>
                  <div className={styles.mappingSummary}>
                    <span className="pill">{activePlan.name}</span>
                    <span className="pill">{activePlan.version}</span>
                    <span className="pill">{activePlan.status}</span>
                    <span className="pill">{activePlan.events.length} 个事件</span>
                  </div>
                  <div className={styles.statusSummaryGrid}>
                    {activePlanCompletionItems.map((item) => (
                      <div key={item.label} className={styles.statusSummaryCard}>
                        <div className={styles.statusSummaryValue}>{item.value}</div>
                        <div className={styles.statusSummaryLabel}>{item.label}</div>
                        <div className={styles.statusSummaryHint}>{item.hint}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : activePlan ? (
            <PlanEditor
              key={`${activePlan.id}:${activeEvent?.id ?? "draft"}`}
              activePlan={activePlan}
              activeEvent={activeEvent}
              categories={categories}
              currentStep={currentStep}
              isPending={isPending}
              isGenerating={isGenerating}
              onError={setError}
              onMessage={setMessage}
              onSelectEvent={(eventId) => {
                setSelectedPlanId(activePlan.id);
                setSelectedEventId(eventId);
                navigate(activeProjectId, activePlan.id, eventId, null);
              }}
              onRefresh={(planId, eventId, nextFocusField, nextStep) => refreshWithSelection(planId, eventId, nextFocusField, nextStep)}
              onSetHelp={setActiveHelp}
              onResultViewChange={setCurrentResultView}
              onStepChange={(step) => {
                setCurrentStep(step);
                navigate(activeProjectId, activePlan.id, activeEvent?.id ?? null, null, step);
              }}
              initialFocusField={focusField}
              onStartGenerate={() => {
                setIsGenerating(true);
                startProgress();
              }}
              onFinishGenerate={(options) => {
                if (progressTimerRef.current) {
                  window.clearInterval(progressTimerRef.current);
                  progressTimerRef.current = null;
                }

                if (options.ok) {
                  setProgressStages((current) =>
                    current.map((item, index) => ({
                      ...item,
                      status: "completed",
                      message: index === current.length - 1 ? "方案已写回" : "已完成"
                    }))
                  );
                  setProgressMessage("AI 生成完成，可以开始检查事件和字段。");
                } else {
                  setProgressStages((current) =>
                    current.map((item, index) => {
                      if (index < progressIndexRef.current) {
                        return { ...item, status: "completed", message: "已完成" };
                      }
                      if (index === progressIndexRef.current) {
                        return {
                          ...item,
                          status: "failed",
                          message: options.errorMessage || "生成失败"
                        };
                      }
                      return item;
                    })
                  );
                  setProgressMessage(options.errorMessage || "AI 生成失败，请检查输入内容后重试。");
                }

                setIsGenerating(false);
              }}
              startTransition={startTransition}
            />
          ) : (
            <div className={styles.emptyStateBlock}>
              <p className={styles.mutedNote}>当前还没有可编辑的方案。请先创建一份方案草稿。</p>
            </div>
          )}
        </section>

        {currentStep === "results" ? (
        <aside className={styles.rightColumn}>
          <div className={`panel ${styles.sidePanel}`}>
            <div className={styles.sidePanelHeader}>
              <div className={styles.sectionHeader}>
                <h2 className="section-title" style={{ fontSize: 18 }}>
                  方案状态
                </h2>
                <HelpButton
                  label="方案状态"
                  active={activeHelp === "status"}
                  onClick={() => setActiveHelp("status")}
                />
              </div>
              <span className="pill">{isGenerating ? "生成中" : "分阶段进度"}</span>
            </div>
            <p className={styles.sideCopy}>{progressMessage}</p>
            <div className={styles.progressList}>
              {progressStages.map((stage, index) => (
                <div key={stage.key} className={styles.progressItem}>
                  <div className={styles.progressItemTop}>
                    <strong>{`0${index + 1}`}</strong>
                    <span className={`pill ${styles[`status_${stage.status}`] || ""}`}>
                      {stage.status === "waiting"
                        ? "等待中"
                        : stage.status === "processing"
                          ? "处理中"
                          : stage.status === "completed"
                            ? "已完成"
                            : "失败"}
                    </span>
                  </div>
                  <div className={styles.progressTitle}>{stage.label}</div>
                  <p className={styles.progressDetail}>{stage.message ?? stage.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`panel ${styles.sidePanel}`}>
            <div className={styles.sectionHeader}>
              <div className={styles.aiInsightTag}>AI 诊断</div>
              <span className="pill">
                {activePlan?.diagnosisStatus === "COMPLETED"
                  ? "已完成"
                  : activePlan?.diagnosisStatus === "PROCESSING"
                    ? "处理中"
                    : activePlan?.diagnosisStatus === "FAILED"
                      ? "上次失败"
                      : "待执行"}
              </span>
            </div>
            {activePlan?.diagnosis ? (
              <>
                <p className={styles.sideCopy}>{activePlan.diagnosis.summary}</p>
                <div className={styles.diagnosisList}>
                  {activePlan.diagnosis.findings.map((finding, index) => (
                    <div key={`${finding.title}-${index}`} className={styles.diagnosisCard}>
                      <div className={styles.diagnosisTop}>
                        <strong>{finding.title}</strong>
                        <span className={`pill ${styles[`severity_${finding.severity}`] || ""}`}>
                          {getSeverityLabel(finding.severity)}
                        </span>
                      </div>
                      {finding.eventName ? (
                        <div className={styles.diagnosisEvent}>关联事件：{finding.eventName}</div>
                      ) : null}
                      <p className={styles.diagnosisCopy}>{finding.detail}</p>
                      {finding.recommendation ? (
                        <p className={styles.diagnosisRecommendation}>建议：{finding.recommendation}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.sideCopy}>当前还没有诊断结果。建议在完成一轮生成或编辑后执行诊断。</p>
            )}
          </div>

          <div className={`panel ${styles.sidePanel}`}>
            <div className={styles.sectionHeader}>
              <div className={styles.aiInsightTag}>AI Insight</div>
              <span className="pill">
                {latestInputSource ? `最近输入：${formatInputSource(latestInputSource.type)}` : "暂无输入"}
              </span>
            </div>
            <h3 className={styles.sideTitle}>接下来可以做什么</h3>
            <p className={styles.sideCopy}>
              {getInsightCopy({
                activePlan,
                activeEvent,
                isGenerating,
                latestSource: latestInputSource,
                resultView: currentResultView
              })}
            </p>
          </div>

          <div className={`panel ${styles.sidePanel}`}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sideTitle}>{planCenterHelp[activeHelp].title}</h3>
              <span className="pill">帮助说明</span>
            </div>
            <p className={styles.sideCopy}>{planCenterHelp[activeHelp].summary}</p>
            <div className={styles.helpMiniBlock}>
              <div className={styles.helpMiniTitle}>推荐做法</div>
              <ul className={styles.helpMiniList}>
                {planCenterHelp[activeHelp].steps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.helpMiniBlock}>
              <div className={styles.helpMiniTitle}>常见误区</div>
              <ul className={styles.helpMiniList}>
                {planCenterHelp[activeHelp].pitfalls.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {"examples" in planCenterHelp[activeHelp] && planCenterHelp[activeHelp].examples?.length ? (
              <div className={styles.helpMiniBlock}>
                <div className={styles.helpMiniTitle}>示例</div>
                <ul className={styles.helpMiniList}>
                  {planCenterHelp[activeHelp].examples.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </aside>
        ) : null}
      </div>
    </>
  );
}

function PlanEditor({
  activePlan,
  activeEvent,
  categories,
  currentStep,
  isPending,
  isGenerating,
  onError,
  onMessage,
  onSelectEvent,
  onRefresh,
  onSetHelp,
  onResultViewChange,
  onStepChange,
  initialFocusField,
  onStartGenerate,
  onFinishGenerate,
  startTransition
}: {
  activePlan: Plan;
  activeEvent: Plan["events"][number] | null;
  categories: Category[];
  currentStep: PlanStep;
  isPending: boolean;
  isGenerating: boolean;
  onError: (value: string | null) => void;
  onMessage: (value: string | null) => void;
  onSelectEvent: (eventId: string | null) => void;
  onRefresh: (planId?: string | null, eventId?: string | null, focusField?: string | null, step?: PlanStep | null) => void;
  onSetHelp: (value: HelpKey) => void;
  onResultViewChange: (value: "global" | "events" | "candidates" | "dictionaries") => void;
  onStepChange: (step: PlanStep) => void;
  initialFocusField: string | null;
  onStartGenerate: () => void;
  onFinishGenerate: (result: { ok: boolean; errorMessage?: string }) => void;
  startTransition: React.TransitionStartFunction;
}) {
  const [planDraft, setPlanDraft] = useState({
    name: activePlan.name,
    version: activePlan.version,
    summary: activePlan.summary ?? ""
  });
  const [generationMode, setGenerationMode] = useState<GenerationMode>("free_text");
  const [generationPrompt, setGenerationPrompt] = useState(
    activePlan.inputSources?.at(-1)?.content ?? activePlan.summary ?? ""
  );
  const [replaceExisting, setReplaceExisting] = useState(activePlan.events.length === 0);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>(["common"]);
  const [spreadsheetSheets, setSpreadsheetSheets] = useState<SpreadsheetSheet[]>([]);
  const [spreadsheetFileName, setSpreadsheetFileName] = useState("");
  const [activeSheetName, setActiveSheetName] = useState<string | null>(null);
  const [spreadsheetNotice, setSpreadsheetNotice] = useState<string>("尚未上传表格。");
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [sheetActionNotice, setSheetActionNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [sheetActionToast, setSheetActionToast] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const jobPollTimerRef = useRef<number | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const resultHintTimerRef = useRef<number | null>(null);
  const spreadsheetSheetsRef = useRef<SpreadsheetSheet[]>([]);
  const [resultView, setResultView] = useState<"global" | "events" | "candidates" | "dictionaries">("events");
  const [eventResultMode, setEventResultMode] = useState<"cards" | "table" | "summary">("cards");
  const [schemaView, setSchemaView] = useState<"global" | "event_fields" | "dictionaries" | "mappings">("global");
  const [exportVariant, setExportVariant] = useState<ExportVariant>("developer");
  const [candidateModuleFilter, setCandidateModuleFilter] = useState<string>("all");
  const [candidateFieldFilter, setCandidateFieldFilter] = useState<string>("all");
  const [highlightedDictionaryName, setHighlightedDictionaryName] = useState<string | null>(null);
  const [resultNavigationHint, setResultNavigationHint] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [globalDraft, setGlobalDraft] = useState<EditableGlobalProperty[]>(createGlobalPropertyDraft(activePlan));
  const [dictionaryDraft, setDictionaryDraft] = useState<EditableDictionary[]>(createDictionaryDraft(activePlan));
  const [mappingDraft, setMappingDraft] = useState<EditableDictionaryMapping[]>(createMappingDraft(activePlan));
  const [eventDraft, setEventDraft] = useState<EditableEvent | null>(
    createDraftFromEvent(activeEvent, categories)
  );
  const eventEditorRef = useRef<HTMLElement | null>(null);
  const fieldListRef = useRef<HTMLElement | null>(null);
  const fieldRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightedField, setHighlightedField] = useState<string | null>(initialFocusField);
  const activeSpreadsheetSheet =
    spreadsheetSheets.find((sheet) => sheet.name === activeSheetName) ??
    spreadsheetSheets[0] ??
    null;
  const spreadsheetRows = activeSpreadsheetSheet?.rows ?? [];
  const spreadsheetHeaders = activeSpreadsheetSheet?.headers ?? [];
  const spreadsheetMappings = activeSpreadsheetSheet?.mappings ?? [];
  const activeSheetRole = activeSpreadsheetSheet?.role ?? "event_table";
  const isSpreadsheetConfirmed = isSpreadsheetFullyConfirmed(spreadsheetSheets);
  const confirmedSheetCount = spreadsheetSheets.filter((sheet) => sheet.confirmed).length;
  const mappingTargetCounts = spreadsheetMappings.reduce<Record<string, number>>((acc, item) => {
    if (item.target !== "ignore") {
      acc[item.target] = (acc[item.target] ?? 0) + 1;
    }
    return acc;
  }, {});
  const spreadsheetActionLabel =
    generationMode === "spreadsheet" ? "确认映射后生成事件方案" : "生成事件方案";

  const candidateDictionaryDraft = dictionaryDraft.filter((dictionary) => dictionary.sourceType === "CANDIDATE");
  const confirmedDictionaryDraft = dictionaryDraft.filter((dictionary) => dictionary.sourceType !== "CANDIDATE");
  const candidateDictionaryNames = new Set(candidateDictionaryDraft.map((dictionary) => dictionary.name));
  const confirmedDictionaryNames = new Set(confirmedDictionaryDraft.map((dictionary) => dictionary.name));
  const candidateMappingDraft = mappingDraft.filter((mapping) => candidateDictionaryNames.has(mapping.dictionaryName));
  const confirmedMappingDraft = mappingDraft.filter((mapping) => confirmedDictionaryNames.has(mapping.dictionaryName));
  const candidateGroups = candidateDictionaryDraft.reduce<
    Array<{
      key: string;
      label: string;
      dictionaries: EditableDictionary[];
      mappings: EditableDictionaryMapping[];
    }>
  >((acc, dictionary) => {
    const triggerFields = dictionary.paramNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    const key = [...triggerFields].sort().join("|") || dictionary.relatedModule || "misc";
    const label = triggerFields.length ? triggerFields.join(" / ") : dictionary.relatedModule || "未分类来源";
    const group =
      acc.find((item) => item.key === key) ??
      (() => {
        const created = { key, label, dictionaries: [], mappings: [] as EditableDictionaryMapping[] };
        acc.push(created);
        return created;
      })();
    group.dictionaries.push(dictionary);
    return acc;
  }, []);

  candidateGroups.forEach((group) => {
    const dictionaryNames = new Set(group.dictionaries.map((dictionary) => dictionary.name));
    group.mappings = candidateMappingDraft.filter((mapping) => dictionaryNames.has(mapping.dictionaryName));
  });
  const candidateModuleOptions = Array.from(
    new Set(candidateDictionaryDraft.map((dictionary) => dictionary.relatedModule).filter(Boolean))
  );
  const candidateFieldOptions = Array.from(
    new Set(
      candidateDictionaryDraft.flatMap((dictionary) =>
        dictionary.paramNames
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
      )
    )
  );
  const filteredCandidateGroups = candidateGroups.filter((group) =>
    candidateModuleFilter === "all"
      ? true
      : group.dictionaries.some((dictionary) => dictionary.relatedModule === candidateModuleFilter)
  ).filter((group) =>
    candidateFieldFilter === "all"
      ? true
      : group.dictionaries.some((dictionary) =>
          dictionary.paramNames
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean)
            .includes(candidateFieldFilter)
        )
  );

  function commitSpreadsheetSheets(nextSheets: SpreadsheetSheet[]) {
    spreadsheetSheetsRef.current = nextSheets;
    setSpreadsheetSheets(nextSheets);
  }

  function showSheetActionNotice(type: "success" | "error" | "info", text: string) {
    setSheetActionNotice({ type, text });
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setSheetActionNotice(null);
    }, 2600);

    setSheetActionToast({ type, text });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setSheetActionToast(null);
    }, 2600);
  }

  function showResultNavigationHint(text: string) {
    setResultNavigationHint(text);
    if (resultHintTimerRef.current) {
      window.clearTimeout(resultHintTimerRef.current);
    }
    resultHintTimerRef.current = window.setTimeout(() => {
      setResultNavigationHint(null);
    }, 3200);
  }

  function getCurrentSpreadsheetSheet(sheetName: string) {
    return spreadsheetSheetsRef.current.find((sheet) => sheet.name === sheetName) ?? null;
  }

  function updateProperty(index: number, patch: Partial<EditableProperty>) {
    setEventDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        properties: current.properties.map((property, propertyIndex) =>
          propertyIndex === index ? { ...property, ...patch } : property
        )
      };
    });
  }

  function removeProperty(index: number) {
    setEventDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        properties: current.properties.filter((_, propertyIndex) => propertyIndex !== index)
      };
    });
  }

  async function handleSpreadsheetUpload(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const parsedSheets = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(sheet, {
          defval: "",
          raw: false
        });
        const roleGuess = guessSheetRole(sheetName, Object.keys(rows[0] ?? {}));
        return {
          name: sheetName,
          headers: Object.keys(rows[0] ?? {}),
          rowCount: rows.length,
          previewRows: rows.slice(0, 5),
          rows,
          role: roleGuess.role,
          roleConfidence: roleGuess.confidence,
          roleReason: roleGuess.reason,
          mappings: Object.keys(rows[0] ?? {}).map((header) => ({
            source: header,
            ...suggestMapping(header, roleGuess.role)
          })),
          confirmed: false
        };
      });
      const primarySheet = parsedSheets.find((sheet) => sheet.rows.length > 0) ?? parsedSheets[0];
      setActiveSheetName(primarySheet?.name ?? null);
      commitSpreadsheetSheets(parsedSheets);
      setSpreadsheetFileName(file.name);
      setSpreadsheetNotice(
        primarySheet?.rows.length
          ? `已识别 ${parsedSheets.length} 个工作表，当前主表为 ${primarySheet?.name ?? "Sheet1"}，请逐张确认角色与映射后再执行 AI 生成。`
          : "文件已读取，但没有识别到有效数据行。"
      );
      onMessage("表格已上传，可先检查预览，再执行 AI 生成。");
      onError(null);
    } catch {
      setSpreadsheetSheets([]);
      setActiveSheetName(null);
      setSpreadsheetFileName("");
      setSpreadsheetNotice("表格解析失败，请确认文件为 csv 或 xlsx。");
      onError("表格解析失败，请确认文件为 csv 或 xlsx。");
    }
  }

  function updateSpreadsheetSheetRole(sheetName: string, role: SpreadsheetSheetRole) {
    const nextSheets = spreadsheetSheetsRef.current.map((sheet) =>
      sheet.name === sheetName
        ? {
            ...sheet,
            role,
            confirmed: false,
            mappings: sheet.headers.map((header) => ({
              source: header,
              ...suggestMapping(header, role)
            }))
          }
        : sheet
    );
    commitSpreadsheetSheets(nextSheets);
    showSheetActionNotice("info", "工作表角色已变更，请重新确认当前工作表后再保存。");
  }

  function updateSpreadsheetMapping(sheetName: string, index: number, target: string) {
    const nextSheets = spreadsheetSheetsRef.current.map((sheet) =>
      sheet.name === sheetName
        ? {
            ...sheet,
            confirmed: false,
            mappings: sheet.mappings.map((item, itemIndex) =>
              itemIndex === index
                ? { ...item, target, confidence: "low" as const, reason: "已由人工调整映射。" }
                : item
            )
          }
        : sheet
    );
    commitSpreadsheetSheets(nextSheets);
    showSheetActionNotice("info", "字段映射已修改，请重新确认当前工作表。");
  }

  function confirmSpreadsheetSheet(sheetName: string) {
    const currentSheet = getCurrentSpreadsheetSheet(sheetName);
    if (!currentSheet) {
      showSheetActionNotice("error", "当前工作表不存在，请重新选择。");
      return false;
    }

    const effectiveMappingCount = countEffectiveMappings(currentSheet);

    if (effectiveMappingCount === 0) {
      showSheetActionNotice("error", "请至少保留一个有效字段映射，不能全部忽略。");
      return false;
    }

    const nextSheets = spreadsheetSheetsRef.current.map((sheet) => {
      if (sheet.name !== sheetName) {
        return sheet;
      }
      return { ...sheet, confirmed: true };
    });
    commitSpreadsheetSheets(nextSheets);
    showSheetActionNotice("success", `已确认工作表：${sheetName}（${effectiveMappingCount} 列有效映射）`);
    return true;
  }

  function saveCurrentSpreadsheetSheet() {
    const currentSheet = activeSheetName ? getCurrentSpreadsheetSheet(activeSheetName) : null;

    if (!currentSheet) {
      onError("请先选择一个工作表。");
      showSheetActionNotice("error", "请先选择一个工作表。");
      return;
    }
    if (!currentSheet.confirmed) {
      onError("请先确认当前工作表映射，再执行保存。");
      showSheetActionNotice("error", "请先确认当前工作表映射，再执行保存。");
      return;
    }

    startTransition(async () => {
      onError(null);
      onMessage(null);
      const snapshotSheets = spreadsheetSheetsRef.current;
      const response = await fetch(`/api/plans/${activePlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appendInputSource: {
            type: "FILE",
            label: `参考工作表：${currentSheet.name}`,
            content: serializeSpreadsheetInputSource(
              snapshotSheets,
              spreadsheetFileName || "spreadsheet.xlsx",
              currentSheet.name
            ),
            fileName: spreadsheetFileName || null,
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }
        })
      });
      const data = await response.json();
      if (!response.ok) {
        onError(data.error || "保存当前工作表失败。");
        showSheetActionNotice("error", data.error || "保存当前工作表失败。");
        return;
      }
      onMessage(`已暂存工作表：${currentSheet.name}`);
      showSheetActionNotice("success", `已暂存工作表：${currentSheet.name}，下次可继续恢复。`);
      onRefresh(activePlan.id, activeEvent?.id ?? null, null, "generate");
    });
  }

  function updateGlobalProperty(index: number, patch: Partial<EditableGlobalProperty>) {
    setGlobalDraft((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  function updateDictionary(index: number, patch: Partial<EditableDictionary>) {
    setDictionaryDraft((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  function updateMapping(index: number, patch: Partial<EditableDictionaryMapping>) {
    setMappingDraft((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  async function persistPackageSection(
    nextDictionaries: EditableDictionary[] = dictionaryDraft,
    nextMappings: EditableDictionaryMapping[] = mappingDraft,
    successMessage = "公共属性、正式字典和映射关系已保存。"
  ) {
    onError(null);
    onMessage(null);

    const payload = {
      globalProperties: globalDraft
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          type: item.type.trim() || "string",
          isRequired: item.isRequired,
          sampleValue: item.sampleValue.trim() || null,
          description: item.description.trim() || null,
          category: item.category.trim() || null
        })),
      dictionaries: nextDictionaries
        .filter((item) => item.name.trim() && item.configName.trim())
        .map((item) => ({
          name: item.name.trim(),
          configName: item.configName.trim(),
          relatedModule: item.relatedModule.trim() || "未分类模块",
          paramNames: item.paramNames
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          purpose: item.purpose.trim() || "待补充用途说明",
          handoffRule: item.handoffRule.trim() || "待补充研发约定",
          sourceType: item.sourceType.trim() || "MANUAL"
        })),
      dictionaryMappings: nextMappings
        .filter((item) => item.propertyName.trim() && item.dictionaryName.trim())
        .map((item) => ({
          eventName: item.eventName.trim() || null,
          propertyName: item.propertyName.trim(),
          dictionaryName: item.dictionaryName.trim(),
          isRequiredMapping: item.isRequiredMapping,
          mappingNote: item.mappingNote.trim() || null
        }))
    };

    const response = await fetch(`/api/plans/${activePlan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "保存方案包失败。");
    }
    onMessage(successMessage);
    onRefresh(activePlan.id, activeEvent?.id ?? null, null, "results");
  }

  function savePackageSection() {
    startTransition(async () => {
      try {
        await persistPackageSection();
      } catch (error) {
        onError(error instanceof Error ? error.message : "保存方案包失败。");
      }
    });
  }

  function confirmDictionaryCandidate(dictionaryName: string) {
    startTransition(async () => {
      const nextDictionaries = dictionaryDraft.map((dictionary) =>
        dictionary.name === dictionaryName ? { ...dictionary, sourceType: "AI_GENERATED" } : dictionary
      );
      setDictionaryDraft(nextDictionaries);
      setHighlightedDictionaryName(dictionaryName);
      setResultView("dictionaries");
      onResultViewChange("dictionaries");
      try {
        await persistPackageSection(nextDictionaries, mappingDraft, `已确认字典候选：${dictionaryName}`);
      } catch (error) {
        onError(error instanceof Error ? error.message : "确认字典候选失败。");
      }
    });
  }

  function ignoreDictionaryCandidate(dictionaryName: string) {
    startTransition(async () => {
      const nextDictionaries = dictionaryDraft.filter((dictionary) => dictionary.name !== dictionaryName);
      const nextMappings = mappingDraft.filter((mapping) => mapping.dictionaryName !== dictionaryName);
      setDictionaryDraft(nextDictionaries);
      setMappingDraft(nextMappings);
      try {
        await persistPackageSection(nextDictionaries, nextMappings, `已忽略字典候选：${dictionaryName}`);
      } catch (error) {
        onError(error instanceof Error ? error.message : "忽略字典候选失败。");
      }
    });
  }

  function revertDictionaryToCandidate(dictionaryName: string) {
    startTransition(async () => {
      const nextDictionaries = dictionaryDraft.map((dictionary) =>
        dictionary.name === dictionaryName ? { ...dictionary, sourceType: "CANDIDATE" } : dictionary
      );
      setDictionaryDraft(nextDictionaries);
      setHighlightedDictionaryName(dictionaryName);
      setResultView("candidates");
      onResultViewChange("candidates");
      try {
        await persistPackageSection(nextDictionaries, mappingDraft, `已将正式字典退回候选：${dictionaryName}`);
      } catch (error) {
        onError(error instanceof Error ? error.message : "退回字典候选失败。");
      }
    });
  }

  function confirmAllDictionaryCandidates() {
    startTransition(async () => {
      const nextDictionaries = dictionaryDraft.map((dictionary) =>
        dictionary.sourceType === "CANDIDATE" ? { ...dictionary, sourceType: "AI_GENERATED" } : dictionary
      );
      setDictionaryDraft(nextDictionaries);
      setHighlightedDictionaryName(nextDictionaries.find((dictionary) => dictionary.sourceType !== "CANDIDATE")?.name ?? null);
      setResultView("dictionaries");
      onResultViewChange("dictionaries");
      try {
        await persistPackageSection(nextDictionaries, mappingDraft, `已确认 ${candidateDictionaryDraft.length} 个字典候选。`);
      } catch (error) {
        onError(error instanceof Error ? error.message : "批量确认字典候选失败。");
      }
    });
  }

  function ignoreAllDictionaryCandidates() {
    startTransition(async () => {
      const nextDictionaries = dictionaryDraft.filter((dictionary) => dictionary.sourceType !== "CANDIDATE");
      const nextMappings = mappingDraft.filter((mapping) => !candidateDictionaryNames.has(mapping.dictionaryName));
      setDictionaryDraft(nextDictionaries);
      setMappingDraft(nextMappings);
      try {
        await persistPackageSection(nextDictionaries, nextMappings, `已忽略 ${candidateDictionaryDraft.length} 个字典候选。`);
      } catch (error) {
        onError(error instanceof Error ? error.message : "批量忽略字典候选失败。");
      }
    });
  }

  const canSaveEvent =
    !!eventDraft &&
    !!eventDraft.eventName.trim() &&
    !!eventDraft.categoryId &&
    eventDraft.properties.every((property) => property.name.trim() && property.type.trim());

  const canGenerate =
    generationMode === "free_text"
      ? generationPrompt.trim().length >= 10
      : generationMode === "template"
        ? selectedTemplates.length > 0
        : spreadsheetSheets.some((sheet) => sheet.rowCount > 0 && sheet.role !== "ignore") && isSpreadsheetConfirmed;

  const latestSource = activePlan.inputSources?.at(-1);
  const currentEventMappings = confirmedMappingDraft.filter(
    (mapping) => mapping.eventName === eventDraft?.eventName
  );
  const eventGroups = activePlan.events.reduce<Record<string, Plan["events"]>>((acc, event) => {
    const key = event.category?.name ?? "未分类";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(event);
    return acc;
  }, {});
  const selectedEventCategoryName =
    categories.find((category) => category.id === eventDraft?.categoryId)?.name ?? activeEvent?.category?.name ?? "";
  const selectedEventIsCommon = isCommonCategory(selectedEventCategoryName);
  const sharedGlobalPreview = globalDraft.slice(0, 4).map((property) => property.name).filter(Boolean);
  const deliveryRows = activePlan.events.flatMap((event) =>
    event.properties.map((property) => {
      const mapping = confirmedMappingDraft.find(
        (item) => item.eventName === event.eventName && item.propertyName === property.name
      );

      return {
        module: event.category?.name ?? "未分类",
        eventName: event.eventName,
        propertyName: property.name,
        type: property.type,
        required: property.isRequired ? "必填" : "可选",
        sampleValue: property.sampleValue ?? "",
        isGlobal: "否",
        isDictionary: mapping ? "是" : "否",
        dictionaryName: mapping?.dictionaryName ?? ""
      };
    })
  );
  const globalDeliveryRows = globalDraft.map((property) => ({
    module: "公共属性",
    eventName: "*",
    propertyName: property.name,
    type: property.type,
    required: property.isRequired ? "必填" : "可选",
    sampleValue: property.sampleValue,
    isGlobal: "是",
    isDictionary: "否",
    dictionaryName: ""
  }));
  const mappingStructureRows = confirmedMappingDraft.map((mapping) => ({
    module:
      activePlan.events.find((event) => event.eventName === mapping.eventName)?.category?.name ??
      "全局映射",
    eventName: mapping.eventName || "*",
    propertyName: mapping.propertyName,
    type: mapping.isRequiredMapping ? "required_mapping" : "mapping",
    required: mapping.isRequiredMapping ? "是" : "否",
    sampleValue: mapping.dictionaryName,
    description: mapping.mappingNote || "",
    rowType: "dictionary_mapping" as const
  }));
  const dictionaryStructureRows = confirmedDictionaryDraft.map((dictionary) => ({
    module: dictionary.relatedModule || "未分类模块",
    eventName: dictionary.configName || dictionary.name,
    propertyName: dictionary.paramNames || "-",
    type: dictionary.sourceType || "MANUAL",
    required: "查表",
    sampleValue: dictionary.name,
    description: dictionary.purpose || dictionary.handoffRule || "",
    rowType: "dictionary" as const
  }));
  const schemaTables = [
    {
      key: "global" as const,
      label: "公共属性表",
      count: globalDraft.length,
      hint: "所有事件共享底座字段"
    },
    {
      key: "event_fields" as const,
      label: "事件字段表",
      count: deliveryRows.length,
      hint: "事件与字段的统一结构"
    },
    {
      key: "dictionaries" as const,
      label: "字典表",
      count: confirmedDictionaryDraft.length,
      hint: "已确认并进入正式方案包的字典表"
    },
    {
      key: "mappings" as const,
      label: "映射关系表",
      count: confirmedMappingDraft.length,
      hint: "已确认字段与字典的正式绑定关系"
    }
  ];
  const moduleSummaryRows = Object.entries(eventGroups).map(([groupName, events]) => {
    const totalFields = events.reduce((sum, event) => sum + event.properties.length, 0);
    const totalMappings = events.reduce(
      (sum, event) =>
        sum +
        confirmedMappingDraft.filter((mapping) => mapping.eventName === event.eventName).length,
      0
    );
    const expectedEvents = getExpectedEventsForGroup(groupName);
    const existingEventNames = events.map((event) => event.eventName);
    const missingEvents = expectedEvents.filter((eventName) => !existingEventNames.includes(eventName));
    return { groupName, eventCount: events.length, totalFields, totalMappings, missingEvents };
  });

  useEffect(() => {
    setPlanDraft({
      name: activePlan.name,
      version: activePlan.version,
      summary: activePlan.summary ?? ""
    });
    setGlobalDraft(createGlobalPropertyDraft(activePlan));
    setDictionaryDraft(createDictionaryDraft(activePlan));
    setMappingDraft(createMappingDraft(activePlan));
    setEventDraft(createDraftFromEvent(activeEvent, categories));
    setReplaceExisting(activePlan.events.length === 0);

    const latestInput = activePlan.inputSources?.at(-1);
    if (latestInput?.type === "FILE") {
      setGenerationMode("spreadsheet");
      setSelectedTemplates(["common"]);
      setGenerationPrompt(activePlan.summary ?? "");
      const restored = parseSpreadsheetInputSource(latestInput.content);
      if (restored) {
        commitSpreadsheetSheets(restored.sheets);
        setSpreadsheetFileName(latestInput.fileName ?? restored.fileName ?? "");
        setActiveSheetName(restored.activeSheetName);
        setSpreadsheetNotice(
          restored.sheets[0]?.headers.length
            ? `已恢复最近保存的参考表格输入：共 ${restored.sheets.length} 张工作表，当前定位到 ${restored.activeSheetName ?? restored.sheets[0]?.name ?? "工作表"}。`
            : "已恢复最近保存的参考工作表记录；由于这是旧版保存内容，若要继续调整映射，请重新上传原文件。"
        );
      } else {
        commitSpreadsheetSheets([]);
        setSpreadsheetFileName(latestInput.fileName ?? "");
        setActiveSheetName(null);
        setSpreadsheetNotice("最近一次输入来自参考表格，但没有可恢复的工作表结构，请重新上传文件。");
      }
      return;
    }

    commitSpreadsheetSheets([]);
    setSpreadsheetFileName("");
    setActiveSheetName(null);
    setSpreadsheetNotice("尚未上传表格。");

    if (latestInput?.type === "FORM") {
      setGenerationMode("template");
      const restoredTemplate = parseTemplateInputSource(latestInput.content);
      setSelectedTemplates(restoredTemplate?.templateKeys?.length ? restoredTemplate.templateKeys : ["common"]);
      setGenerationPrompt(activePlan.summary ?? "");
      return;
    }

    setGenerationMode("free_text");
    setSelectedTemplates(["common"]);
    setGenerationPrompt(latestInput?.content ?? activePlan.summary ?? "");
  }, [activePlan, activeEvent, categories]);

  useEffect(() => {
    spreadsheetSheetsRef.current = spreadsheetSheets;
  }, [spreadsheetSheets]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!highlightedDictionaryName) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setHighlightedDictionaryName(null);
    }, 2600);
    return () => window.clearTimeout(timeoutId);
  }, [highlightedDictionaryName]);

  useEffect(() => {
    if (!initialFocusField) {
      return;
    }

    setHighlightedField(initialFocusField);

    const targetRow = fieldRowRefs.current[initialFocusField];
    if (targetRow) {
      fieldListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
      const timeoutId = window.setTimeout(() => setHighlightedField(null), 2200);
      return () => window.clearTimeout(timeoutId);
    }

    eventEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const timeoutId = window.setTimeout(() => setHighlightedField(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [activeEvent?.id, initialFocusField]);

  function switchResultView(nextView: "global" | "events" | "candidates" | "dictionaries") {
    setResultView(nextView);
    onResultViewChange(nextView);
  }

  function navigateToGlobalResults() {
    switchResultView("global");
    onStepChange("results");
    showResultNavigationHint("当前位置：方案结果区 / 公共属性");
  }

  function navigateToEventResult(eventName: string, propertyName?: string | null) {
    const targetEvent = activePlan.events.find((event) => event.eventName === eventName);
    if (!targetEvent) {
      return;
    }

    onSelectEvent(targetEvent.id);
    onRefresh(activePlan.id, targetEvent.id, propertyName ?? null, "results");
    showResultNavigationHint(
      `当前位置：方案结果区 / 事件表 / ${eventName}${propertyName ? ` / ${propertyName}` : ""}`
    );
  }

  function navigateToDictionaryResult(dictionaryName: string) {
    setHighlightedDictionaryName(dictionaryName);
    switchResultView("dictionaries");
    onStepChange("results");
    showResultNavigationHint(`当前位置：方案结果区 / 已确认字典 / ${dictionaryName}`);
  }

  function navigateToMappingResult(mapping: { eventName?: string | null; propertyName: string; dictionaryName?: string | null }) {
    if (mapping.dictionaryName) {
      setHighlightedDictionaryName(mapping.dictionaryName);
    }

    if (mapping.eventName && mapping.eventName !== "*") {
      const targetEvent = activePlan.events.find((event) => event.eventName === mapping.eventName);
      if (targetEvent) {
        onSelectEvent(targetEvent.id);
        onRefresh(activePlan.id, targetEvent.id, mapping.propertyName, "results");
        showResultNavigationHint(
          `当前位置：方案结果区 / 事件表 / ${mapping.eventName} / ${mapping.propertyName}`
        );
        return;
      }
    }

    switchResultView("dictionaries");
    onStepChange("results");
    showResultNavigationHint(
      `当前位置：方案结果区 / 已确认字典${mapping.dictionaryName ? ` / ${mapping.dictionaryName}` : ""}`
    );
  }

  function stopStream() {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }

  function startStream(mode: GenerationMode) {
    stopStream();
    const sequence =
      mode === "free_text"
        ? [
            "正在理解你的自由描述...",
            "正在提取关键玩法、目标漏斗和商业化目标...",
            "正在拆解事件表结构...",
            "正在补公共属性并统一扫描字典候选..."
          ]
        : mode === "template"
          ? [
              "正在读取所选标准模板...",
              "正在组合标准事件骨架...",
              "正在补齐字段并统一扫描字典候选...",
              "正在生成事件方案..."
            ]
          : [
              "正在读取参考表格...",
              "正在理解工作表角色和字段映射...",
              "正在按映射重建事件与字段结构...",
              "正在生成事件方案..."
            ];

    setStreamLines([sequence[0]]);
    let cursor = 1;
    streamTimerRef.current = window.setInterval(() => {
      setStreamLines((current) => {
        if (cursor >= sequence.length) {
          return current;
        }
        const next = [...current, sequence[cursor]];
        cursor += 1;
        return next;
      });
    }, 800);
  }

  async function pollJob(
    jobId: string,
    type: "GENERATE" | "DIAGNOSE",
    fallbackEventId?: string | null
  ) {
    if (jobPollTimerRef.current) {
      window.clearInterval(jobPollTimerRef.current);
      jobPollTimerRef.current = null;
    }

    jobPollTimerRef.current = window.setInterval(async () => {
      const response = await fetch(`/api/plans/${activePlan.id}/jobs/${jobId}`);
      const data = await response.json();
      const job = data.item as PlanJob | undefined;
      if (!job) {
        return;
      }

      if (job.status === "COMPLETED") {
        if (jobPollTimerRef.current) {
          window.clearInterval(jobPollTimerRef.current);
          jobPollTimerRef.current = null;
        }

        if (type === "GENERATE") {
          const generatedCount = Number(job.result?.generatedCount ?? 0);
          const candidateCount = Number(job.result?.candidateCount ?? 0);
          const nextPlan = job.result?.plan as { events?: Array<{ id: string }> } | undefined;
          const nextEventId = nextPlan?.events?.[0]?.id ?? fallbackEventId ?? null;
          stopStream();
          setStreamLines((current) => [...current, `生成完成：已产出 ${generatedCount} 个事件，并识别出 ${candidateCount} 个字典候选。`]);
          onMessage(`Gemini 已生成 ${generatedCount} 个事件，并识别出 ${candidateCount} 个字典候选。`);
          if (nextEventId) {
            onSelectEvent(nextEventId);
          }
          onFinishGenerate({ ok: true });
          onRefresh(activePlan.id, nextEventId, null, "results");
        } else {
          onMessage("AI 诊断已完成，请在右侧查看结果。");
          setIsDiagnosing(false);
          onRefresh(activePlan.id, activeEvent?.id ?? null, null);
        }
        return;
      }

      if (job.status === "FAILED") {
        if (jobPollTimerRef.current) {
          window.clearInterval(jobPollTimerRef.current);
          jobPollTimerRef.current = null;
        }

        if (type === "GENERATE") {
          stopStream();
          setStreamLines((current) => [...current, job.error || job.message || "AI 生成失败。"]);
          onFinishGenerate({ ok: false, errorMessage: job.error || job.message });
          onError(job.error || job.message || "AI 生成失败。");
        } else {
          setIsDiagnosing(false);
          onError(job.error || job.message || "AI 方案诊断失败。");
        }
      }
    }, 1000);
  }

  async function handleGenerate() {
    onError(null);
    onMessage(null);

    if (activePlan.events.length > 0 && !replaceExisting) {
      onError("当前方案已经有事件。若要重新生成，请先勾选“覆盖当前方案里已有的事件和字段”。");
      return;
    }

    onStartGenerate();
    startStream(generationMode);

    const payload =
      generationMode === "free_text"
        ? {
            mode: generationMode,
            prompt: generationPrompt,
            replaceExisting
          }
        : generationMode === "template"
          ? {
              mode: generationMode,
              templateKeys: selectedTemplates,
              replaceExisting
            }
          : {
              mode: generationMode,
              spreadsheetRows: spreadsheetSheets.flatMap((sheet) =>
                sheet.confirmed ? buildMappedRows(sheet.rows, sheet.mappings) : []
              ),
              spreadsheetSheets: spreadsheetSheets.map((sheet) => ({
                name: sheet.name,
                headers: sheet.headers,
                rowCount: sheet.rowCount,
                previewRows: sheet.previewRows
              })),
              spreadsheetPurpose:
                spreadsheetSheets.some((sheet) => sheet.role === "event_table" || sheet.role === "global_properties")
                  ? "event_table"
                  : "dictionary_table",
              spreadsheetMappings: spreadsheetSheets.flatMap((sheet) =>
                sheet.confirmed ? sheet.mappings : []
              ),
              spreadsheetFileName,
              replaceExisting
            };

    try {
      const response = await fetch(`/api/plans/${activePlan.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        stopStream();
        setStreamLines((current) => [...current, data.error || "AI 生成失败。"]);
        onFinishGenerate({ ok: false, errorMessage: data.error || "AI 生成失败。" });
        onError(data.error || "AI 生成失败。");
        return;
      }
      onMessage("AI 任务已创建，正在后台生成方案。");
      await pollJob(data.item?.id, "GENERATE", activeEvent?.id ?? null);
    } catch {
      stopStream();
      setStreamLines((current) => [...current, "网络异常，AI 生成未完成。"]);
      onFinishGenerate({ ok: false, errorMessage: "网络异常，AI 生成未完成。" });
      onError("网络异常，AI 生成未完成。");
    }
  }

  function findCategoryIdForGroup(groupName: string) {
    return (
      activePlan.events.find((event) => (event.category?.name ?? "未分类") === groupName)?.category?.id ??
      categories.find((category) => category.name === groupName)?.id ??
      categories[0]?.id ??
      ""
    );
  }

  function addSuggestedEvent(eventName: string, groupName: string) {
    const categoryId = findCategoryIdForGroup(groupName);
    const payload = createSuggestedEvent(eventName, categoryId);

    startTransition(async () => {
      onError(null);
      onMessage(null);

      const response = await fetch(`/api/plans/${activePlan.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        onError(data.error || "补齐标准事件失败。");
        return;
      }

      const nextEventId = data.item?.id ?? null;
      onMessage(`已补齐标准事件：${eventName}`);
      if (nextEventId) {
        onSelectEvent(nextEventId);
      }
      onRefresh(activePlan.id, nextEventId);
    });
  }

  return (
    <div className={styles.editorStack}>
      {currentStep === "generate" ? (
      <section className={styles.editorCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionLabel}>输入与生成</p>
            <h2 className="section-title" style={{ fontSize: 20 }}>
              {planDraft.name}
            </h2>
            <p className={styles.eventSource}>
              选择最适合当前信息形态的输入方式，让 Gemini 先生成公共属性和事件表，再基于整份事件表统一扫描字典候选。
            </p>
          </div>
          <div className={styles.sectionHeaderRight}>
            {latestSource ? <span className="pill">最近输入：{formatInputSource(latestSource.type)}</span> : null}
            <span className={styles.statusBadge}>{activePlan.status}</span>
            <span className="pill">{activePlan.events.length} 个现有事件</span>
            <HelpButton
              label="AI 生成输入"
              active={false}
              onClick={() => onSetHelp("ai_input")}
            />
          </div>
        </div>

        <div className={styles.generateMainGrid}>
          <div className={styles.generateMainColumn}>
            <div className={styles.modeTabs}>
              <button
                type="button"
                className={`${styles.modeTab} ${generationMode === "free_text" ? styles.modeTabActive : ""}`}
                onClick={() => setGenerationMode("free_text")}
              >
                自由描述
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${generationMode === "template" ? styles.modeTabActive : ""}`}
                onClick={() => setGenerationMode("template")}
              >
                标准模板
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${generationMode === "spreadsheet" ? styles.modeTabActive : ""}`}
                onClick={() => setGenerationMode("spreadsheet")}
              >
                参考表格
              </button>
            </div>

            {generationMode === "free_text" ? (
              <div className={styles.modePanel}>
                <div className={styles.modeHint}>
                  推荐写法：说明玩法流程、关键步骤、目标漏斗、商业化目标，并指出哪些参数应强制走配置表或枚举表。
                </div>
                <textarea
                  className={`${styles.mockInput} ${styles.textarea} ${styles.aiPrompt}`}
                  value={generationPrompt}
                  onChange={(event) => setGenerationPrompt(event.target.value)}
                  placeholder="例如：新手引导包含 5 步，重点看第 2 步和第 4 步流失；关卡以 level_start / level_fail / level_complete 为核心；商业化重点跟踪广告触发、广告完成、首充转化。"
                />
              </div>
            ) : null}

            {generationMode === "template" ? (
              <div className={styles.modePanel}>
                <div className={styles.templateGrid}>
                  {planInputTemplates.map((template) => {
                    const checked = selectedTemplates.includes(template.key);
                    return (
                      <button
                        key={template.key}
                        type="button"
                        className={`${styles.templateCard} ${checked ? styles.templateCardActive : ""}`}
                        onClick={() =>
                          setSelectedTemplates((current) =>
                            current.includes(template.key)
                              ? current.filter((item) => item !== template.key)
                              : [...current, template.key]
                          )
                        }
                      >
                        <div className={styles.templateTitleRow}>
                          <strong>{template.label}</strong>
                          <span className="pill">{checked ? "已选中" : "可选"}</span>
                        </div>
                        <p className={styles.templateSummary}>{template.summary}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {generationMode === "spreadsheet" ? (
              <div className={styles.modePanel}>
          <label className={styles.uploadBox}>
              <input
                type="file"
                className={styles.hiddenInput}
                accept=".csv,.xlsx"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleSpreadsheetUpload(file);
                  }
                }}
              />
              <strong>上传参考事件表 / 配置表</strong>
              <span>支持 `.csv` 和 `.xlsx`，系统会按工作表逐张识别角色并确认映射，不会直接导入成当前方案。</span>
            </label>
            <div className={styles.modeHint}>{spreadsheetNotice}</div>
            {spreadsheetSheets.length ? (
              <>
                <div className={styles.mappingSummary}>
                  <span className="pill">文件：{spreadsheetFileName}</span>
                  <span className="pill">工作表：{spreadsheetSheets.length}</span>
                  <span className="pill">已确认：{confirmedSheetCount} / {spreadsheetSheets.filter((sheet) => sheet.rowCount > 0 && sheet.role !== "ignore").length}</span>
                  <span className="pill">{isSpreadsheetConfirmed ? "全部映射已确认" : "待确认映射"}</span>
                </div>
                {isSpreadsheetConfirmed ? (
                  <div className={styles.feedbackSuccess}>
                    全部可用工作表都已确认完成。现在可以直接点击“确认映射后生成事件方案”。
                  </div>
                ) : null}
                <div className={styles.sheetList}>
                  {spreadsheetSheets.map((sheet) => (
                    <button
                      key={sheet.name}
                      type="button"
                      className={`${styles.sheetCard} ${activeSheetName === sheet.name ? styles.sheetCardActive : ""}`}
                      onClick={() => setActiveSheetName(sheet.name)}
                    >
                      <div className={styles.resultEventTop}>
                        <strong>{sheet.name}</strong>
                        <span className="pill">{sheet.rowCount} 行</span>
                      </div>
                      <div className={styles.mappingSummary}>
                        <span className="pill">{getSheetRoleLabel(sheet.role)}</span>
                        <span className={`pill ${styles[`confidence_${sheet.roleConfidence}`] || ""}`}>
                          {getConfidenceLabel(sheet.roleConfidence)}
                        </span>
                        <span className="pill">{sheet.confirmed ? "已确认" : "待确认"}</span>
                      </div>
                      <p className={styles.treeMeta}>{sheet.roleReason}</p>
                      <p className={styles.treeMeta}>列头：{sheet.headers.join(" / ") || "无"}</p>
                    </button>
                  ))}
                </div>
                <div className={styles.mappingPanel}>
                  <div className={styles.mappingPanelHeader}>
                    <div>
                      <strong>字段映射确认</strong>
                      <p className={styles.mappingCopy}>
                        {activeSpreadsheetSheet
                          ? `当前正在确认「${activeSpreadsheetSheet.name}」，请先确认它属于哪一类工作表，再逐列映射。`
                          : "请先选择一个工作表。"}
                      </p>
                    </div>
                    {activeSpreadsheetSheet ? (
                      <div className={styles.mappingSummary}>
                        <select
                          className={styles.mockInput}
                          value={activeSpreadsheetSheet.role}
                          onChange={(event) =>
                            updateSpreadsheetSheetRole(
                              activeSpreadsheetSheet.name,
                              event.target.value as SpreadsheetSheetRole
                            )
                          }
                        >
                          <option value="global_properties">公共属性表</option>
                          <option value="event_table">事件表</option>
                          <option value="dictionary_reference">字典表参考</option>
                          <option value="ignore">忽略该表</option>
                        </select>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => {
                            const confirmed = confirmSpreadsheetSheet(activeSpreadsheetSheet.name);
                            if (!confirmed) {
                              onError("请至少保留一个有效字段映射，不能全部忽略。");
                              return;
                            }
                            onError(null);
                            onMessage(`已确认工作表：${activeSpreadsheetSheet.name}`);
                          }}
                        >
                          确认当前工作表
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          disabled={!activeSpreadsheetSheet.confirmed || isPending}
                          onClick={() => saveCurrentSpreadsheetSheet()}
                        >
                          {isPending ? "保存中..." : "暂存当前工作表"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {sheetActionNotice ? (
                    <div
                      className={
                        sheetActionNotice.type === "success"
                          ? styles.feedbackSuccess
                          : sheetActionNotice.type === "error"
                            ? styles.feedbackError
                            : styles.feedbackInfo
                      }
                    >
                      {sheetActionNotice.text}
                    </div>
                  ) : null}
                  {activeSpreadsheetSheet ? (
                    <div className={styles.modeHint}>
                      当前角色：{getSheetRoleLabel(activeSpreadsheetSheet.role)}
                      {" · "}
                      只显示适合该工作表的字段候选，避免把公共属性列误映射到广告位、SKU 这类无关目标。
                    </div>
                  ) : null}
                  <div className={styles.mappingRows}>
                    {spreadsheetMappings.map((mapping, index) => (
                      <div
                        key={mapping.source}
                        className={`${styles.mappingRow} ${
                          mapping.target !== "ignore" && mappingTargetCounts[mapping.target] > 1
                            ? styles.mappingRowConflict
                            : ""
                        }`}
                      >
                        <div className={styles.mappingSourceBlock}>
                          <div className={styles.mappingSourceTop}>
                            <div className={styles.mappingSource}>{mapping.source}</div>
                            <span
                              className={`${styles.confidenceBadge} ${styles[`confidence_${mapping.confidence}`]}`}
                            >
                              {getConfidenceLabel(mapping.confidence)}
                            </span>
                          </div>
                          <p className={styles.mappingReason}>{mapping.reason}</p>
                        </div>
                        <div className={styles.mappingTargetBlock}>
                          <select
                            className={styles.mockInput}
                            value={mapping.target}
                            onChange={(event) => {
                              const target = event.target.value;
                              if (!activeSpreadsheetSheet) {
                                return;
                              }
                              updateSpreadsheetMapping(activeSpreadsheetSheet.name, index, target);
                            }}
                          >
                            {getMappingGroupsForRole(activeSheetRole).map((group) => (
                              <optgroup key={group.label} label={group.label}>
                                {group.options.map((item) => (
                                  <option key={item.key} value={item.key}>
                                    {item.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <div className={styles.mappingTargetMeta}>
                            <div className={styles.mappingTargetDescription}>
                              {getTargetPresentation(mapping.target, activeSheetRole).description}
                            </div>
                            <div className={styles.mappingTargetExample}>
                              示例：
                              {" "}
                              {getTargetPresentation(mapping.target, activeSheetRole).example}
                            </div>
                            {mapping.target !== "ignore" && mappingTargetCounts[mapping.target] > 1 ? (
                              <div className={styles.mappingWarning}>
                                当前有多列映射到了同一个目标字段，AI 可能无法准确理解，请保留最关键的一列。
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.previewTableWrap}>
                  <div className={styles.previewTable}>
                    <div className={styles.previewHeader}>
                      {spreadsheetHeaders.map((header) => (
                        <div key={header}>{header}</div>
                      ))}
                    </div>
                    {spreadsheetRows.slice(0, 5).map((row, index) => (
                      <div key={`${spreadsheetFileName}-${index}`} className={styles.previewRow}>
                        {spreadsheetHeaders.map((header) => (
                          <div key={header}>{String(row[header] ?? "")}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
              </div>
            ) : null}

            <div className={styles.inputMetaRow}>
              <span className="pill">
                当前输入来源：{generationMode === "free_text" ? "自由描述" : generationMode === "template" ? "标准模板" : "参考表格"}
              </span>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(event) => setReplaceExisting(event.target.checked)}
                />
                <span>覆盖当前方案里已有的事件和字段</span>
              </label>
            </div>
            <div className={styles.editorActions}>
              <button
                className="button-primary"
                type="button"
                disabled={isGenerating || isPending || !canGenerate}
                onClick={() => void handleGenerate()}
              >
                {isGenerating ? "AI 正在生成..." : spreadsheetActionLabel}
              </button>
              <button
                className="button-secondary"
                type="button"
                disabled={!activePlan.events.length}
                onClick={() => onStepChange("results")}
              >
                查看方案结果
              </button>
            </div>
          </div>

          <aside className={styles.generateSideColumn}>
            <div className={styles.stepFocusCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>当前步骤说明</p>
                  <p className={styles.eventSource}>本页只负责输入、识别、映射和生成，不在这里做结果审查和结构编辑。</p>
                </div>
              </div>
              <div className={styles.sideKeyList}>
                <div className={styles.sideKeyRow}><span>生成内容</span><strong>公共属性</strong></div>
                <div className={styles.sideKeyRow}><span>生成内容</span><strong>事件表</strong></div>
                <div className={styles.sideKeyRow}><span>生成内容</span><strong>字典候选</strong></div>
                <div className={styles.sideKeyRow}><span>生成内容</span><strong>映射关系</strong></div>
              </div>
              <p className={styles.sideCopy}>
                当前方案：{activePlan.name} · {activePlan.version}
              </p>
              <div className={styles.sideStatList}>
                <div className={styles.sideStatCard}><strong>{activePlan.events.length}</strong><span>个事件</span></div>
                <div className={styles.sideStatCard}><strong>{activePlan.globalProperties?.length ?? 0}</strong><span>个公共属性</span></div>
                <div className={styles.sideStatCard}><strong>{candidateDictionaryDraft.length}</strong><span>个字典候选</span></div>
              </div>
            </div>
            <div className={styles.stepFocusCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>生成前检查</p>
                  <p className={styles.eventSource}>这一页只保留最关键的两个判断。</p>
                </div>
              </div>
              <div className={styles.sideChecklist}>
                <div className={styles.sideChecklistRow}>
                  <span>方案基础</span>
                  <strong className={activePlan.events.length > 0 ? styles.status_completed : styles.status_waiting}>
                    {activePlan.events.length > 0 ? "已有方案基础" : "等待首轮生成"}
                  </strong>
                </div>
                <div className={styles.sideChecklistRow}>
                  <span>输入状态</span>
                  <strong className={canGenerate ? styles.status_completed : styles.status_waiting}>
                    {canGenerate ? "输入可生成" : "输入未完成"}
                  </strong>
                </div>
                {generationMode === "spreadsheet" ? (
                  <div className={styles.sideChecklistRow}>
                    <span>映射状态</span>
                    <strong className={isSpreadsheetConfirmed ? styles.status_completed : styles.status_waiting}>
                      {isSpreadsheetConfirmed ? "映射已确认" : "映射待确认"}
                    </strong>
                  </div>
                ) : null}
              </div>
              <p className={styles.sideCopy}>
                {generationMode === "spreadsheet"
                  ? "上传和确认工作表只是保存参考输入。暂存仅用于断点续传；仍需点击“确认映射后生成事件方案”，系统才会基于参考表生成事件表、公共属性并扫描字典候选。"
                  : "完成生成后，下一步去第 3 步查看公共属性、事件表和字典候选，再确认哪些候选需要生成正式字典表。"}
              </p>
            </div>
            <div className={styles.stepFocusCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>生成进度</p>
                  <p className={styles.eventSource}>点击 `生成事件方案` 后，会按阶段流式显示当前进展。</p>
                </div>
              </div>
              <div className={styles.streamPanel}>
                {streamLines.length ? (
                  streamLines.map((line, index) => (
                    <div key={`${line}-${index}`} className={styles.streamLine}>
                      <span className={styles.streamDot} />
                      <span>{line}</span>
                    </div>
                  ))
                ) : (
                  <p className={styles.sideCopy}>还没有开始生成。输入完成后点击 `生成事件方案` 查看实时进度。</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
      ) : null}

      {sheetActionToast ? (
        <div
          className={
            sheetActionToast.type === "success"
              ? styles.toastSuccess
              : sheetActionToast.type === "error"
                ? styles.toastError
                : styles.toastInfo
          }
        >
          {sheetActionToast.text}
        </div>
      ) : null}

      {currentStep === "results" ? (
      <section className={styles.editorCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionLabel}>方案结果区</p>
            <p className={styles.eventSource}>先看生成出的公共属性与事件表，再基于整份事件表统一确认字典候选，最后形成正式字典表。</p>
          </div>
          <div className={styles.modeTabs}>
            <button
              type="button"
              className={`${styles.modeTab} ${resultView === "global" ? styles.modeTabActive : ""}`}
              onClick={() => switchResultView("global")}
            >
              公共属性
            </button>
            <button
              type="button"
              className={`${styles.modeTab} ${resultView === "events" ? styles.modeTabActive : ""}`}
              onClick={() => switchResultView("events")}
            >
              事件表
            </button>
            <button
              type="button"
              className={`${styles.modeTab} ${resultView === "candidates" ? styles.modeTabActive : ""}`}
              onClick={() => switchResultView("candidates")}
            >
              字典候选
            </button>
            <button
              type="button"
              className={`${styles.modeTab} ${resultView === "dictionaries" ? styles.modeTabActive : ""}`}
              onClick={() => switchResultView("dictionaries")}
            >
              已确认字典
            </button>
          </div>
        </div>

        <div className={styles.resultViewHint}>
          {resultView === "global"
            ? "公共属性是所有事件共享的底座字段，用于后续所有图表的切片分析。"
            : resultView === "events"
              ? "事件表按模块分组展示，每张卡片会同时告诉你共享公共属性、事件字段和字典字段。"
              : resultView === "candidates"
                ? "字典候选来自对整份事件表的统一扫描。请先确认哪些字段必须查表，再生成正式字典表和映射关系。"
                : "这里展示的是已确认字典和正式映射关系，第 4 步字段结构查看只会读取这些正式结果。"}
        </div>
        {resultNavigationHint ? <div className={styles.feedbackInfo}>{resultNavigationHint}</div> : null}

        <div className={styles.packageSummaryGrid}>
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>公共属性</span>
            <strong>{globalDraft.length}</strong>
            <span className={styles.summaryCopy}>默认挂到所有事件</span>
          </div>
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>事件数量</span>
            <strong>{activePlan.events.length}</strong>
            <span className={styles.summaryCopy}>按模块分组查看</span>
          </div>
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>字典候选</span>
            <strong>{candidateDictionaryDraft.length}</strong>
            <span className={styles.summaryCopy}>等待用户确认生成</span>
          </div>
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>正式字典</span>
            <strong>{confirmedDictionaryDraft.length}</strong>
            <span className={styles.summaryCopy}>已确认进入方案包</span>
          </div>
        </div>

        {resultView === "global" ? (
          <div className={styles.packagePanel}>
            <div className={styles.packageSummaryRow}>
              <span className="pill">{globalDraft.length} 个公共属性</span>
              <span className="pill">导出时默认挂接到全部事件</span>
              <span className="pill">适合放等级、金币、设备、版本、国家地区等底座字段</span>
            </div>
            {globalDraft.length ? (
              <div className={styles.dictionaryTableWrap}>
                <div className={styles.dictionaryTable}>
                  <div className={styles.dictionaryHeader}>
                    <div>字段名</div>
                    <div>类型</div>
                    <div>必填</div>
                    <div>分类</div>
                    <div>示例值</div>
                    <div>说明</div>
                  </div>
                  {globalDraft.map((property, index) => (
                    <div key={`${property.name}-${index}`} className={styles.dictionaryRow}>
                      <input
                        className={styles.mockInput}
                        value={property.name}
                        onChange={(event) => updateGlobalProperty(index, { name: event.target.value })}
                      />
                      <input
                        className={styles.mockInput}
                        value={property.type}
                        onChange={(event) => updateGlobalProperty(index, { type: event.target.value })}
                      />
                      <select
                        className={styles.mockInput}
                        value={property.isRequired ? "required" : "optional"}
                        onChange={(event) =>
                          updateGlobalProperty(index, { isRequired: event.target.value === "required" })
                        }
                      >
                        <option value="required">必填</option>
                        <option value="optional">可选</option>
                      </select>
                      <input
                        className={styles.mockInput}
                        value={property.category}
                        onChange={(event) => updateGlobalProperty(index, { category: event.target.value })}
                      />
                      <input
                        className={styles.mockInput}
                        value={property.sampleValue}
                        onChange={(event) => updateGlobalProperty(index, { sampleValue: event.target.value })}
                      />
                      <input
                        className={styles.mockInput}
                        value={property.description}
                        onChange={(event) => updateGlobalProperty(index, { description: event.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.emptyList}>当前还没有独立公共属性，下一轮 AI 生成会自动补全。</div>
            )}
            <div className={styles.editorActions}>
              <button
                className="button-secondary"
                type="button"
                onClick={() =>
                  setGlobalDraft((current) => [
                    ...current,
                    {
                      name: "",
                      type: "string",
                      isRequired: true,
                      sampleValue: "",
                      description: "",
                      category: ""
                    }
                  ])
                }
              >
                新增公共属性
              </button>
              <button className="button-primary" type="button" onClick={savePackageSection}>
                保存公共属性
              </button>
            </div>
          </div>
        ) : null}

        {resultView === "events" ? (
          <div className={styles.packagePanel}>
            <div className={styles.packageSummaryRow}>
              <span className="pill">{activePlan.events.length} 个事件</span>
              <span className="pill">{confirmedMappingDraft.length} 条正式字典映射</span>
              <span className="pill">{globalDraft.length} 个共享公共属性</span>
            </div>
            <div className={styles.subViewTabs}>
              <button
                type="button"
                className={`${styles.modeTab} ${eventResultMode === "cards" ? styles.modeTabActive : ""}`}
                onClick={() => setEventResultMode("cards")}
              >
                卡片视图
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${eventResultMode === "table" ? styles.modeTabActive : ""}`}
                onClick={() => setEventResultMode("table")}
              >
                交付表视图
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${eventResultMode === "summary" ? styles.modeTabActive : ""}`}
                onClick={() => setEventResultMode("summary")}
              >
                模块汇总视图
              </button>
            </div>
            {eventResultMode === "cards"
              ? Object.entries(eventGroups).map(([groupName, events]) => (
              <section key={groupName} className={styles.resultGroup}>
                {(() => {
                  const expectedEvents = getExpectedEventsForGroup(groupName);
                  const existingEventNames = events.map((event) => event.eventName);
                  const missingEvents = expectedEvents.filter((eventName) => !existingEventNames.includes(eventName));
                  const totalFields = events.reduce((sum, event) => sum + event.properties.length, 0);
                  const totalMappings = events.reduce(
                    (sum, event) =>
                      sum +
                      confirmedMappingDraft.filter((mapping) => mapping.eventName === event.eventName).length,
                    0
                  );

                  return (
                    <>
                <button
                  type="button"
                  className={styles.groupToggle}
                  onClick={() =>
                    setCollapsedGroups((current) => ({
                      ...current,
                      [groupName]: !current[groupName]
                    }))
                  }
                >
                  <div className={styles.resultGroupHeader}>
                    <div>
                      <strong>{groupName}</strong>
                      <p className={styles.eventSource}>
                        {isCommonCategory(groupName)
                          ? "这一组通常是通用事件本身，另外所有事件还会共享上面的公共属性。"
                          : "点击事件卡片可继续在下方编辑事件说明和字段。"}
                      </p>
                    </div>
                    <div className={styles.groupMeta}>
                      <div className={styles.mappingSummary}>
                        <span className="pill">{events.length} 个事件</span>
                        <span className="pill">{totalFields} 个字段</span>
                        {totalMappings ? <span className="pill">{totalMappings} 个字典字段</span> : null}
                        {isCommonCategory(groupName) ? <span className="pill">共享 {globalDraft.length} 个公共属性</span> : null}
                      </div>
                      <span className="pill">{collapsedGroups[groupName] ? "展开" : "收起"}</span>
                    </div>
                  </div>
                </button>
                {missingEvents.length ? (
                  <div className={styles.missingBanner}>
                    <span className={styles.previewLabel}>结构缺口提示</span>
                    <div className={styles.missingActionList}>
                      {missingEvents.map((eventName) => (
                        <button
                          key={`${groupName}-${eventName}`}
                          type="button"
                          className={styles.missingAction}
                          onClick={() => addSuggestedEvent(eventName, groupName)}
                        >
                          <span className={styles.missingTag}>缺少 {eventName}</span>
                          <span className={styles.missingActionCopy}>一键补齐</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {!collapsedGroups[groupName] ? (
                  <div className={styles.resultEventList}>
                    {events.map((event) => {
                      const mappings = confirmedMappingDraft.filter(
                        (mapping) => mapping.eventName === event.eventName
                      );
                      const previewFields = getEventPreviewFields(event);
                      return (
                        <button
                          key={event.id}
                          type="button"
                          className={`${styles.resultEventCard} ${activeEvent?.id === event.id ? styles.resultEventCardActive : ""}`}
                          onClick={() => {
                            onSelectEvent(event.id);
                            onRefresh(activePlan.id, event.id);
                          }}
                        >
                          <div className={styles.resultEventTop}>
                            <strong>{event.eventName}</strong>
                            <span className="pill">{event.category?.name ?? "未分类"}</span>
                          </div>
                          <p className={styles.resultEventName}>{event.displayName ?? "未设置显示名"}</p>
                          <p className={styles.treeMeta}>
                            {event.triggerDescription ?? event.businessGoal ?? "暂未补充触发说明"}
                          </p>
                          <div className={styles.mappingSummary}>
                            <span className="pill">{event.properties.length} 个事件字段</span>
                            {isCommonCategory(groupName) && globalDraft.length ? (
                              <span className="pill">另带 {globalDraft.length} 个公共属性</span>
                            ) : null}
                            {mappings.length ? <span className="pill">{mappings.length} 个字典映射</span> : null}
                          </div>
                          {sharedGlobalPreview.length ? (
                            <div className={styles.previewBlock}>
                              <span className={styles.previewLabel}>共享公共属性</span>
                              <div className={styles.fieldPreviewList}>
                                {sharedGlobalPreview.map((field) => (
                                  <span key={`${event.id}-global-${field}`} className={styles.fieldPreviewTag}>
                                    {field}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {previewFields.length ? (
                            <div className={styles.previewBlock}>
                              <span className={styles.previewLabel}>事件字段</span>
                              <div className={styles.fieldPreviewList}>
                                {previewFields.map((field) => (
                                  <span key={`${event.id}-${field}`} className={styles.fieldPreviewTag}>
                                    {field}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {mappings.length ? (
                            <div className={styles.previewBlock}>
                              <span className={styles.previewLabel}>字典字段</span>
                              <div className={styles.fieldPreviewList}>
                                {mappings.map((mapping) => (
                                  <span
                                    key={`${event.id}-${mapping.propertyName}-${mapping.dictionaryName ?? "dict"}`}
                                    className={styles.mappingPreviewTag}
                                  >
                                    {mapping.propertyName}
                                    {" -> "}
                                    {mapping.dictionaryName ?? "未绑定"}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                    </>
                  );
                })()}
              </section>
              ))
              : (
                eventResultMode === "table" ? (
                <div className={styles.deliveryTableWrap}>
                  <div className={styles.deliveryTable}>
                    <div className={styles.deliveryTableHeader}>
                      <div>模块</div>
                      <div>事件名</div>
                      <div>参数名</div>
                      <div>类型</div>
                      <div>必填</div>
                      <div>示例值</div>
                      <div>公共属性</div>
                      <div>字典字段</div>
                      <div>字典表</div>
                    </div>
                    {[...globalDeliveryRows, ...deliveryRows].map((row, index) => (
                      <button
                        type="button"
                        key={`${row.eventName}-${row.propertyName}-${index}`}
                        className={styles.deliveryTableRow}
                        onClick={() => {
                          if (row.eventName === "*") {
                            switchResultView("global");
                            return;
                          }
                          const targetEvent = activePlan.events.find((event) => event.eventName === row.eventName);
                          if (!targetEvent) {
                            return;
                          }
                          onSelectEvent(targetEvent.id);
                          onRefresh(activePlan.id, targetEvent.id, row.propertyName);
                        }}
                      >
                        <div>{row.module}</div>
                        <div>{row.eventName}</div>
                        <div>{row.propertyName}</div>
                        <div>{row.type}</div>
                        <div>{row.required}</div>
                        <div>{row.sampleValue || "-"}</div>
                        <div>{row.isGlobal}</div>
                        <div>{row.isDictionary}</div>
                        <div>{row.dictionaryName || "-"}</div>
                      </button>
                    ))}
                  </div>
                </div>
                ) : (
                  <div className={styles.summaryGrid}>
                    {moduleSummaryRows.map((row) => (
                      <div key={row.groupName} className={styles.summaryModuleCard}>
                        <div className={styles.resultEventTop}>
                          <strong>{row.groupName}</strong>
                          <span className="pill">{row.eventCount} 个事件</span>
                        </div>
                        <div className={styles.mappingSummary}>
                          <span className="pill">{row.totalFields} 个字段</span>
                          <span className="pill">{row.totalMappings} 个字典字段</span>
                          {isCommonCategory(row.groupName) ? <span className="pill">共享 {globalDraft.length} 个公共属性</span> : null}
                        </div>
                        {row.missingEvents.length ? (
                          <div className={styles.previewBlock}>
                            <span className={styles.previewLabel}>缺失标准事件</span>
                            <div className={styles.fieldPreviewList}>
                              {row.missingEvents.map((eventName) => (
                                <span key={`${row.groupName}-${eventName}`} className={styles.missingTag}>
                                  {eventName}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className={styles.treeMeta}>当前模块的基础标准事件已基本齐全。</p>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
          </div>
        ) : null}

        {resultView === "candidates" ? (
          <div className={styles.packagePanel}>
            <div className={styles.packageSummaryRow}>
              <span className="pill">{candidateDictionaryDraft.length} 个字典候选</span>
              <span className="pill">{candidateMappingDraft.length} 条候选映射</span>
              <span className="pill">基于整份事件表统一扫描</span>
            </div>
            {candidateDictionaryDraft.length ? (
              <div className={styles.editorActions}>
                <select
                  className={styles.mockInput}
                  value={candidateModuleFilter}
                  onChange={(event) => setCandidateModuleFilter(event.target.value)}
                >
                  <option value="all">全部模块</option>
                  {candidateModuleOptions.map((moduleName) => (
                    <option key={moduleName} value={moduleName}>
                      {moduleName}
                    </option>
                  ))}
                </select>
                <select
                  className={styles.mockInput}
                  value={candidateFieldFilter}
                  onChange={(event) => setCandidateFieldFilter(event.target.value)}
                >
                  <option value="all">全部字段</option>
                  {candidateFieldOptions.map((fieldName) => (
                    <option key={fieldName} value={fieldName}>
                      {fieldName}
                    </option>
                  ))}
                </select>
                <button className="button-secondary" type="button" onClick={ignoreAllDictionaryCandidates}>
                  全部忽略候选
                </button>
                <button className="button-primary" type="button" onClick={confirmAllDictionaryCandidates}>
                  全部确认生成字典
                </button>
              </div>
            ) : null}
            {candidateDictionaryDraft.length ? (
              <div className={styles.candidateGroupList}>
                {filteredCandidateGroups.map((group) => (
                  <section key={group.key} className={styles.candidateGroup}>
                    <div className={styles.mappingPanelHeader}>
                      <div>
                        <p className={styles.sectionLabel}>来源字段组</p>
                        <p className={styles.mappingCopy}>{group.label}</p>
                      </div>
                      <div className={styles.mappingSummary}>
                        <span className="pill">{group.dictionaries.length} 个候选</span>
                        <span className="pill">{group.mappings.length} 条映射</span>
                      </div>
                    </div>
                    <div className={styles.dictionaryCardGrid}>
                      {group.dictionaries.map((dictionary, index) => {
                        const mappings = group.mappings.filter((mapping) => mapping.dictionaryName === dictionary.name);
                        const impactedModules = Array.from(
                          new Set(
                            mappings.map((mapping) => {
                              const targetEvent = activePlan.events.find((event) => event.eventName === mapping.eventName);
                              return targetEvent?.category?.name ?? dictionary.relatedModule ?? "未分类模块";
                            })
                          )
                        );
                        return (
                          <div key={`${dictionary.name}-${index}`} className={styles.dictionaryCard}>
                            <div className={styles.resultEventTop}>
                              <strong>{dictionary.name}</strong>
                              <span className="pill">待确认</span>
                            </div>
                            <div className={styles.mappingSummary}>
                              <span className="pill">{dictionary.configName}</span>
                              <span className="pill">{dictionary.relatedModule}</span>
                            </div>
                            <p className={styles.treeMeta}>{dictionary.purpose}</p>
                            <div className={styles.previewBlock}>
                              <span className={styles.previewLabel}>触发字段</span>
                              <div className={styles.fieldPreviewList}>
                                {dictionary.paramNames
                                  .split(",")
                                  .map((name) => name.trim())
                                  .filter(Boolean)
                                  .map((name) => (
                                    <span key={`${dictionary.name}-${name}`} className={styles.mappingPreviewTag}>
                                      {name}
                                    </span>
                                  ))}
                              </div>
                            </div>
                            <div className={styles.previewBlock}>
                              <span className={styles.previewLabel}>来源模块</span>
                              <div className={styles.fieldPreviewList}>
                                {impactedModules.map((moduleName) => (
                                  <span key={`${dictionary.name}-${moduleName}`} className={styles.fieldPreviewTag}>
                                    {moduleName}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className={styles.previewBlock}>
                              <span className={styles.previewLabel}>影响事件参数</span>
                              <div className={styles.fieldPreviewList}>
                                {mappings.map((mapping) => (
                                  <span key={`${dictionary.name}-${mapping.eventName}-${mapping.propertyName}`} className={styles.fieldPreviewTag}>
                                    {(mapping.eventName ?? "全局") + "." + mapping.propertyName}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <p className={styles.treeMeta}>{dictionary.handoffRule}</p>
                            <div className={styles.editorActions}>
                              <button className="button-secondary" type="button" onClick={() => ignoreDictionaryCandidate(dictionary.name)}>
                                忽略候选
                              </button>
                              <button className="button-primary" type="button" onClick={() => confirmDictionaryCandidate(dictionary.name)}>
                                确认生成字典
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className={styles.emptyList}>
                {candidateModuleFilter === "all" && candidateFieldFilter === "all"
                  ? "当前没有待确认的字典候选。若事件表中包含配置型字段，下一轮生成会自动扫描出来。"
                  : "当前筛选条件下没有待确认的字典候选。你可以切回“全部模块 / 全部字段”继续查看。"}
              </div>
            )}
          </div>
        ) : null}

        {resultView === "dictionaries" ? (
          <div className={styles.packagePanel}>
            <div className={styles.packageSummaryRow}>
              <span className="pill">{confirmedDictionaryDraft.length} 个正式字典表</span>
              <span className="pill">{confirmedMappingDraft.length} 条正式映射</span>
              <span className="pill">这些内容会进入第 4 步字段结构查看</span>
            </div>
            {confirmedDictionaryDraft.length ? (
              <div className={styles.dictionaryCardGrid}>
                {confirmedDictionaryDraft.map((dictionary) => {
                  const draftIndex = dictionaryDraft.findIndex(
                    (item) => item.name === dictionary.name && item.configName === dictionary.configName
                  );
                  const mappings = confirmedMappingDraft.filter(
                    (mapping) => mapping.dictionaryName === dictionary.name
                  );
                  return (
                    <div
                      key={`${dictionary.name}-${dictionary.configName}`}
                      className={`${styles.dictionaryCard} ${highlightedDictionaryName === dictionary.name ? styles.resultEventCardActive : ""}`}
                    >
                      <div className={styles.resultEventTop}>
                        <input
                          className={styles.mockInput}
                          value={dictionary.name}
                          onChange={(event) => updateDictionary(draftIndex, { name: event.target.value })}
                        />
                        <input
                          className={styles.mockInput}
                          value={dictionary.configName}
                          onChange={(event) => updateDictionary(draftIndex, { configName: event.target.value })}
                        />
                      </div>
                      <input
                        className={styles.mockInput}
                        value={dictionary.relatedModule}
                        onChange={(event) => updateDictionary(draftIndex, { relatedModule: event.target.value })}
                        placeholder="关联模块"
                      />
                      <input
                        className={styles.mockInput}
                        value={dictionary.paramNames}
                        onChange={(event) => updateDictionary(draftIndex, { paramNames: event.target.value })}
                        placeholder="关联参数，逗号分隔"
                      />
                      <textarea
                        className={`${styles.mockInput} ${styles.textarea}`}
                        value={dictionary.purpose}
                        onChange={(event) => updateDictionary(draftIndex, { purpose: event.target.value })}
                        placeholder="用途说明"
                      />
                      <textarea
                        className={`${styles.mockInput} ${styles.textarea}`}
                        value={dictionary.handoffRule}
                        onChange={(event) => updateDictionary(draftIndex, { handoffRule: event.target.value })}
                        placeholder="规范约定"
                      />
                      <div className={styles.editorActions}>
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => revertDictionaryToCandidate(dictionary.name)}
                        >
                          退回候选
                        </button>
                      </div>
                      <div className={styles.mappingSummary}>
                        {mappings.map((mapping) => (
                          <span key={`${dictionary.name}-${mapping.propertyName}-${mapping.eventName}`} className="pill">
                            {(mapping.eventName ?? "全局") + "." + mapping.propertyName}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyList}>当前还没有已确认的正式字典表。请先在“字典候选”里确认需要查表的候选。</div>
            )}
            <section className={styles.mappingEditor}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>映射关系</p>
                  <p className={styles.eventSource}>这里展示的是正式映射关系。只有已确认字典才会出现在第 4 步结构表里。</p>
                </div>
                <span className="pill">{confirmedMappingDraft.length} 条映射</span>
              </div>
              <div className={styles.mappingTableWrap}>
                <div className={styles.mappingTable}>
                  <div className={styles.mappingTableHeader}>
                    <div>事件名</div>
                    <div>参数名</div>
                    <div>字典名</div>
                    <div>强制查表</div>
                    <div>说明</div>
                  </div>
                  {confirmedMappingDraft.map((mapping) => {
                    const draftIndex = mappingDraft.findIndex(
                      (item) =>
                        item.eventName === mapping.eventName &&
                        item.propertyName === mapping.propertyName &&
                        item.dictionaryName === mapping.dictionaryName
                    );
                    return (
                    <div key={`${mapping.eventName}-${mapping.propertyName}-${mapping.dictionaryName}`} className={styles.mappingTableRow}>
                      <input
                        className={styles.mockInput}
                        value={mapping.eventName}
                        onChange={(event) => updateMapping(draftIndex, { eventName: event.target.value })}
                        placeholder="可留空表示全局"
                      />
                      <input
                        className={styles.mockInput}
                        value={mapping.propertyName}
                        onChange={(event) => updateMapping(draftIndex, { propertyName: event.target.value })}
                      />
                      <input
                        className={styles.mockInput}
                        value={mapping.dictionaryName}
                        onChange={(event) => updateMapping(draftIndex, { dictionaryName: event.target.value })}
                      />
                      <select
                        className={styles.mockInput}
                        value={mapping.isRequiredMapping ? "required" : "optional"}
                        onChange={(event) =>
                          updateMapping(draftIndex, { isRequiredMapping: event.target.value === "required" })
                        }
                      >
                        <option value="required">是</option>
                        <option value="optional">否</option>
                      </select>
                      <input
                        className={styles.mockInput}
                        value={mapping.mappingNote}
                        onChange={(event) => updateMapping(draftIndex, { mappingNote: event.target.value })}
                      />
                    </div>
                  )})}
                </div>
              </div>
            </section>
            <div className={styles.editorActions}>
              <button
                className="button-secondary"
                type="button"
                onClick={() =>
                  setDictionaryDraft((current) => [
                    ...current,
                    {
                      name: "",
                      configName: "",
                      relatedModule: "",
                      paramNames: "",
                      purpose: "",
                      handoffRule: "",
                      sourceType: "MANUAL"
                    }
                  ])
                }
              >
                新增正式字典
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={() =>
                  setMappingDraft((current) => [
                    ...current,
                    {
                      eventName: "",
                      propertyName: "",
                      dictionaryName: "",
                      isRequiredMapping: true,
                      mappingNote: ""
                    }
                  ])
                }
              >
                新增映射
              </button>
              <button className="button-primary" type="button" onClick={savePackageSection}>
                保存正式字典与映射
              </button>
            </div>
          </div>
        ) : null}
        <div className={styles.editorActions}>
          <button
            className="button-secondary"
            type="button"
            disabled={isDiagnosing || isGenerating || !activePlan.events.length || candidateDictionaryDraft.length > 0}
            onClick={() =>
              startTransition(async () => {
                setIsDiagnosing(true);
                onError(null);
                onMessage(null);
                try {
                  const response = await fetch(`/api/plans/${activePlan.id}/diagnose`, {
                    method: "POST"
                  });
                  const data = await response.json();
                  if (!response.ok) {
                    onError(data.error || "AI 方案诊断失败。");
                    setIsDiagnosing(false);
                    return;
                  }
                  onMessage("AI 诊断任务已创建，正在后台分析。");
                  await pollJob(data.item?.id, "DIAGNOSE", activeEvent?.id ?? null);
                } catch {
                  onError("网络异常，AI 方案诊断未完成。");
                } finally {
                  if (jobPollTimerRef.current === null) {
                    setIsDiagnosing(false);
                  }
                }
              })
            }
          >
            {isDiagnosing ? "AI 正在诊断..." : "AI 诊断方案"}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() => onStepChange("schema")}
          >
            查看字段结构
          </button>
          <button
            className="button-primary"
            type="button"
            disabled={
              isPending ||
              isGenerating ||
              activePlan.diagnosisStatus !== "COMPLETED" ||
              activePlan.status === "CONFIRMED" ||
              candidateDictionaryDraft.length > 0
            }
            onClick={() =>
              startTransition(async () => {
                onError(null);
                onMessage(null);
                const response = await fetch(`/api/plans/${activePlan.id}/confirm`, {
                  method: "POST"
                });
                const data = await response.json();
                if (!response.ok) {
                  onError(data.error || "确认方案失败。");
                  return;
                }
                onMessage("方案已确认，可用于正式导出。");
                onRefresh(activePlan.id, activeEvent?.id ?? null, null, "results");
              })
            }
          >
            {activePlan.status === "CONFIRMED" ? "已确认" : "确认方案"}
          </button>
        </div>
        {candidateDictionaryDraft.length ? (
          <p className={styles.mutedNote}>当前还有 {candidateDictionaryDraft.length} 个字典候选待确认。请先确认或忽略候选，再执行 AI 诊断与方案确认。</p>
        ) : null}
      </section>
      ) : null}

      {currentStep === "schema" ? (
        <>
          <section className={styles.editorCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>04 字段结构查看</p>
                <p className={styles.eventSource}>先看四张逻辑表，再进入对应表的字段明细，体验接近数据库结构浏览。</p>
              </div>
            </div>
            <div className={styles.schemaOverviewGrid}>
              {schemaTables.map((table) => (
                <button
                  key={table.key}
                  type="button"
                  className={`${styles.schemaOverviewCard} ${schemaView === table.key ? styles.schemaOverviewCardActive : ""}`}
                  onClick={() => setSchemaView(table.key)}
                >
                  <span className={styles.summaryLabel}>{table.label}</span>
                  <strong>{table.count}</strong>
                  <span className={styles.summaryCopy}>{table.hint}</span>
                </button>
              ))}
            </div>
            <div className={styles.modeTabs}>
              <button type="button" className={`${styles.modeTab} ${schemaView === "global" ? styles.modeTabActive : ""}`} onClick={() => setSchemaView("global")}>公共属性结构</button>
              <button type="button" className={`${styles.modeTab} ${schemaView === "event_fields" ? styles.modeTabActive : ""}`} onClick={() => setSchemaView("event_fields")}>事件字段结构</button>
              <button type="button" className={`${styles.modeTab} ${schemaView === "dictionaries" ? styles.modeTabActive : ""}`} onClick={() => setSchemaView("dictionaries")}>字典表结构</button>
              <button type="button" className={`${styles.modeTab} ${schemaView === "mappings" ? styles.modeTabActive : ""}`} onClick={() => setSchemaView("mappings")}>映射关系结构</button>
            </div>
            {schemaView === "global" ? (
              <div className={styles.deliveryTableWrap}>
                <div className={styles.schemaTableMeta}>
                  <span className="pill">表：GlobalProperties</span>
                  <span className="pill">{globalDeliveryRows.length} 行</span>
                </div>
                <div className={styles.deliveryTable}>
                  <div className={styles.deliveryTableHeader}>
                    <div>模块</div><div>事件名</div><div>字段名</div><div>类型</div><div>必填</div><div>示例值</div><div>公共属性</div><div>字典字段</div><div>字典表</div>
                  </div>
                  {globalDeliveryRows.map((row, index) => (
                    <button type="button" key={`${row.propertyName}-${index}`} className={styles.deliveryTableRow} onClick={() => navigateToGlobalResults()}>
                      <div>{row.module}</div><div>{row.eventName}</div><div>{row.propertyName}</div><div>{row.type}</div><div>{row.required}</div><div>{row.sampleValue || "-"}</div><div>{row.isGlobal}</div><div>{row.isDictionary}</div><div>{row.dictionaryName || "-"}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {schemaView === "event_fields" ? (
              <div className={styles.deliveryTableWrap}>
                <div className={styles.schemaTableMeta}>
                  <span className="pill">表：EventFields</span>
                  <span className="pill">{deliveryRows.length} 行</span>
                </div>
                <div className={styles.deliveryTable}>
                  <div className={styles.deliveryTableHeader}>
                    <div>模块</div><div>事件名</div><div>字段名</div><div>类型</div><div>必填</div><div>示例值</div><div>公共属性</div><div>字典字段</div><div>字典表</div>
                  </div>
                  {deliveryRows.map((row, index) => (
                    <button
                      type="button"
                      key={`${row.eventName}-${row.propertyName}-${index}`}
                      className={styles.deliveryTableRow}
                      onClick={() => navigateToEventResult(row.eventName, row.propertyName)}
                    >
                      <div>{row.module}</div><div>{row.eventName}</div><div>{row.propertyName}</div><div>{row.type}</div><div>{row.required}</div><div>{row.sampleValue || "-"}</div><div>{row.isGlobal}</div><div>{row.isDictionary}</div><div>{row.dictionaryName || "-"}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {schemaView === "dictionaries" ? (
              <div className={styles.deliveryTableWrap}>
                <div className={styles.schemaTableMeta}>
                  <span className="pill">表：Dictionaries</span>
                  <span className="pill">{dictionaryStructureRows.length} 行</span>
                </div>
                <div className={styles.deliveryTable}>
                  <div className={styles.deliveryTableHeader}>
                    <div>模块</div><div>配置名</div><div>关联参数</div><div>来源</div><div>规则</div><div>字典名</div><div>说明</div><div>公共属性</div><div>字典字段</div>
                  </div>
                  {dictionaryStructureRows.map((row, index) => (
                    <button
                      type="button"
                      key={`${row.eventName}-${row.propertyName}-${index}`}
                      className={`${styles.deliveryTableRow} ${styles.schemaConfirmedRow}`}
                      onClick={() => navigateToDictionaryResult(row.sampleValue || row.eventName)}
                    >
                      <div>{row.module}</div><div>{row.eventName}</div><div>{row.propertyName}</div><div>{row.type}</div><div>{row.required}</div><div>{row.sampleValue || "-"}</div><div>{row.description || "-"}</div><div>否</div><div>是</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {schemaView === "mappings" ? (
              <div className={styles.deliveryTableWrap}>
                <div className={styles.schemaTableMeta}>
                  <span className="pill">表：DictionaryMappings</span>
                  <span className="pill">{mappingStructureRows.length} 行</span>
                </div>
                <div className={styles.deliveryTable}>
                  <div className={styles.deliveryTableHeader}>
                    <div>模块</div><div>事件名</div><div>字段名</div><div>类型</div><div>必填</div><div>字典名</div><div>说明</div><div>公共属性</div><div>字典字段</div>
                  </div>
                  {mappingStructureRows.map((row, index) => (
                    <button
                      type="button"
                      key={`${row.eventName}-${row.propertyName}-${index}`}
                      className={`${styles.deliveryTableRow} ${styles.schemaConfirmedRow}`}
                      onClick={() =>
                        navigateToMappingResult({
                          eventName: row.eventName,
                          propertyName: row.propertyName,
                          dictionaryName: row.sampleValue
                        })
                      }
                    >
                      <div>{row.module}</div><div>{row.eventName}</div><div>{row.propertyName}</div><div>{row.type}</div><div>{row.required}</div><div>{row.sampleValue || "-"}</div><div>{row.description || "-"}</div><div>否</div><div>是</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
          <section className={`${styles.editorCard} ${styles.secondaryCard}`}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>方案设置与导出</p>
                <p className={styles.eventSource}>统一维护方案名称、版本和导出配置。</p>
              </div>
              <div className={styles.headerMeta}>
                {latestSource ? <span className="pill">最近输入：{formatInputSource(latestSource.type)}</span> : null}
                <span className={styles.statusBadge}>{activePlan.status}</span>
              </div>
            </div>
            <div className={styles.compactMetaRow}>
              <div className={styles.compactMetaItem}>
                <span className={styles.summaryLabel}>方案名称</span>
                <input className={styles.mockInput} value={planDraft.name} onChange={(event) => setPlanDraft((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className={styles.compactMetaItem}>
                <span className={styles.summaryLabel}>方案版本</span>
                <input className={styles.mockInput} value={planDraft.version} onChange={(event) => setPlanDraft((current) => ({ ...current, version: event.target.value }))} />
              </div>
            </div>
            <div className={styles.detailRow}>
              <label>方案摘要</label>
              <textarea className={`${styles.mockInput} ${styles.textarea}`} value={planDraft.summary} onChange={(event) => setPlanDraft((current) => ({ ...current, summary: event.target.value }))} />
            </div>
            <div className={styles.editorActions}>
              {activePlan.status !== "CONFIRMED" ? <span className={styles.mutedNote}>当前仍是未确认方案。完成诊断并确认后，再导出正式交付版。</span> : null}
              <div className={styles.exportVariantSwitch}>
                <button type="button" className={`${styles.modeTab} ${exportVariant === "planner" ? styles.modeTabActive : ""}`} onClick={() => setExportVariant("planner")}>策划版导出</button>
                <button type="button" className={`${styles.modeTab} ${exportVariant === "developer" ? styles.modeTabActive : ""}`} onClick={() => setExportVariant("developer")}>研发版导出</button>
              </div>
              <button className="button-secondary" disabled={isPending || !planDraft.name.trim() || !planDraft.version.trim()} onClick={() => startTransition(async () => {
                onError(null); onMessage(null);
                const response = await fetch(`/api/plans/${activePlan.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(planDraft) });
                const data = await response.json();
                if (!response.ok) { onError(data.error || "保存方案失败。"); return; }
                onMessage("方案信息已保存。");
                onRefresh(activePlan.id, activeEvent?.id ?? null, null, "schema");
              })}>保存方案信息</button>
              <button className="button-secondary" type="button" disabled={activePlan.status !== "CONFIRMED"} onClick={() => { window.location.href = `/api/plans/${activePlan.id}/export?format=json&variant=${exportVariant}`; }}>导出 JSON</button>
              <button className="button-secondary" type="button" disabled={activePlan.status !== "CONFIRMED"} onClick={() => { window.location.href = `/api/plans/${activePlan.id}/export?format=xlsx&variant=${exportVariant}`; }}>导出 Excel</button>
            </div>
          </section>
        </>
      ) : (
        <section className={styles.editorCard}>
          <div className={styles.emptyStateBlock}>
            <p className={styles.mutedNote}>请先完成当前步骤，或切换回“输入与生成”继续创建方案内容。</p>
            <button
              className="button-secondary"
              type="button"
              onClick={() => onStepChange("generate")}
            >
              返回输入与生成
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
