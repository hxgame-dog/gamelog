import { GoogleGenAI } from "@google/genai";
import { JobStatus } from "@prisma/client";
import { z } from "zod";

import { getGeminiRuntimeConfig } from "./ai-config";
import { getPlanById, savePlanDiagnosis, updatePlanDiagnosisStatus } from "./plans";

const diagnosisSchema = z.object({
  summary: z.string().min(1),
  findings: z
    .array(
      z.object({
        type: z.enum([
          "naming",
          "funnel_gap",
          "field_issue",
          "category_issue",
          "dictionary_missing",
          "dictionary_mapping_issue",
          "global_property_gap"
        ]),
        severity: z.enum(["high", "medium", "low"]),
        title: z.string().min(1),
        detail: z.string().min(1),
        eventName: z.string().nullable().optional(),
        recommendation: z.string().nullable().optional()
      })
    )
    .min(1)
});

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text.trim();
}

function hasAnyProperty(
  properties: Array<{ name: string }>,
  candidates: string[]
) {
  const names = new Set(properties.map((property) => property.name.toLowerCase()));
  return candidates.some((candidate) => names.has(candidate.toLowerCase()));
}

function buildRuleBasedDiagnosis(plan: NonNullable<Awaited<ReturnType<typeof getPlanById>>>) {
  const findings: Array<z.infer<typeof diagnosisSchema>["findings"][number]> = [];
  const globalNames = new Set((plan.globalProperties ?? []).map((property) => property.name.toLowerCase()));
  const hasGlobalUser = ["user_id", "account_id"].some((name) => globalNames.has(name));
  const hasGlobalSession = ["session_id"].some((name) => globalNames.has(name));

  if (!hasGlobalUser) {
    findings.push({
      type: "global_property_gap",
      severity: "high",
      title: "缺少核心用户标识公共属性",
      detail: "当前公共属性里没有 user_id 或等价账号标识，后续用户级分析和漏斗归因会受影响。",
      eventName: null,
      recommendation: "至少补充 user_id 或 account_id 作为全局公共属性。"
    });
  }

  if (!hasGlobalSession) {
    findings.push({
      type: "global_property_gap",
      severity: "medium",
      title: "缺少会话标识公共属性",
      detail: "当前公共属性里没有 session_id，会影响会话级行为串联和停留时长分析。",
      eventName: null,
      recommendation: "建议将 session_id 纳入全局公共属性或至少纳入核心公共事件。"
    });
  }

  const normalizedMappings = (plan.dictionaryMappings ?? []).map((mapping: any) => ({
    eventName: ("eventName" in mapping ? mapping.eventName : mapping.trackingEvent?.eventName) ?? null,
    propertyName: mapping.propertyName,
    dictionaryName: mapping.dictionary?.name ?? null
  }));
  const dictionaryMappingNames = new Set(
    normalizedMappings.map((mapping) => `${mapping.eventName ?? ""}:${mapping.propertyName}`.toLowerCase())
  );

  plan.events.forEach((event) => {
    const categoryName = event.category?.name ?? "";
    const propertyNames = event.properties.map((property) => property.name);

    const checkField = (
      matchers: string[],
      requiredFields: string[],
      type: "field_issue" | "dictionary_mapping_issue",
      severity: "high" | "medium",
      title: string,
      recommendation: string
    ) => {
      if (!matchers.some((matcher) => categoryName.includes(matcher))) {
        return;
      }
      if (!hasAnyProperty(event.properties, requiredFields)) {
        findings.push({
          type,
          severity,
          title,
          detail: `${event.eventName} 当前缺少 ${requiredFields.join(" / ")} 这类关键字段。`,
          eventName: event.eventName,
          recommendation
        });
      }
    };

    checkField(["关卡", "Level", "level"], ["level_id"], "field_issue", "high", "关卡事件缺少 level_id", "为关卡开始、失败、完成等事件补充 level_id。");
    checkField(["新手", "引导", "Tutorial", "tutorial"], ["step_id"], "field_issue", "high", "新手引导事件缺少 step_id", "为引导步骤相关事件补充 step_id，并尽量配套 step_name。");
    checkField(["商业化", "IAP", "付费", "Monetization"], ["product_id"], "field_issue", "high", "商业化事件缺少 product_id", "为商品曝光、点击、下单、支付结果事件补充 product_id。");
    checkField(["广告", "Ads", "ad"], ["ad_placement"], "field_issue", "high", "广告事件缺少 ad_placement", "为广告展示、点击、奖励领取等事件补充 ad_placement。");

    ["product_id", "ad_placement", "level_id", "step_id"].forEach((propertyName) => {
      if (!propertyNames.includes(propertyName)) {
        return;
      }
      const mappingKey = `${event.eventName}:${propertyName}`.toLowerCase();
      if (!dictionaryMappingNames.has(mappingKey)) {
        findings.push({
          type: "dictionary_mapping_issue",
          severity: "medium",
          title: `${propertyName} 缺少字典映射`,
          detail: `${event.eventName} 已包含 ${propertyName}，但当前方案没有为它配置字典表映射。`,
          eventName: event.eventName,
          recommendation: `为 ${propertyName} 绑定对应字典表，避免前端写死配置值。`
        });
      }
    });
  });

  if (!findings.length) {
    findings.push({
      type: "field_issue",
      severity: "low",
      title: "未发现明显结构缺口",
      detail: "规则诊断未发现显著的基础结构问题，建议继续用 AI 诊断和人工复核命名、字段语义与漏斗完整性。",
      eventName: null,
      recommendation: "继续执行 AI 诊断，重点检查命名规范、漏斗缺口和字典映射。"
    });
  }

  return {
    summary: `规则诊断共识别 ${findings.length} 个重点问题或提醒。`,
    findings
  };
}

export async function diagnoseTrackingPlan(planId: string) {
  const plan = await getPlanById(planId);
  if (!plan) {
    throw new Error("方案不存在。");
  }
  if (!plan.events.length) {
    throw new Error("当前方案还没有事件，无法执行诊断。");
  }

  await updatePlanDiagnosisStatus(planId, JobStatus.PROCESSING);
  const ruleDiagnosis = buildRuleBasedDiagnosis(plan);
  const normalizedMappings = (plan.dictionaryMappings ?? []).map((mapping: any) => ({
    eventName: ("eventName" in mapping ? mapping.eventName : mapping.trackingEvent?.eventName) ?? null,
    propertyName: mapping.propertyName,
    dictionaryName: mapping.dictionary?.name ?? null,
    isRequiredMapping: mapping.isRequiredMapping,
    mappingNote: mapping.mappingNote ?? null
  }));

  try {
    let aiDiagnosis: z.infer<typeof diagnosisSchema> | null = null;
    let model = "rule-based";

    try {
      const runtime = await getGeminiRuntimeConfig();
      model = runtime.model;
      const ai = new GoogleGenAI({ apiKey: runtime.apiKey });

      const prompt = [
        "你是一个游戏埋点方案诊断专家，需要审查当前打点方案是否可支持研发接入与数据分析。",
        "请重点检查七类问题：事件命名规范、关键漏斗缺口、字段缺失/冗余、事件分类不合理、缺失字典表、字典映射不合理、全局公共属性缺失。",
        "输出必须是严格 JSON，不要包含额外解释。",
        "如果某类问题不存在，也至少保留其他最重要的问题；不要返回空 findings。",
        "返回 JSON 结构：",
        JSON.stringify(
          {
            summary: "string",
            findings: [
              {
                type: "naming | funnel_gap | field_issue | category_issue | dictionary_missing | dictionary_mapping_issue | global_property_gap",
                severity: "high | medium | low",
                title: "string",
                detail: "string",
                eventName: "string | null",
                recommendation: "string | null"
              }
            ]
          },
          null,
          2
        ),
        "当前方案信息：",
        JSON.stringify(
          {
            planName: plan.name,
            version: plan.version,
            summary: plan.summary,
            globalProperties: (plan.globalProperties ?? []).map((property) => ({
              name: property.name,
              type: property.type,
              isRequired: property.isRequired,
              category: property.category,
              description: property.description
            })),
            dictionaries: (plan.dictionaries ?? []).map((dictionary) => ({
              name: dictionary.name,
              configName: dictionary.configName,
              relatedModule: dictionary.relatedModule,
              paramNames: dictionary.paramNames,
              purpose: dictionary.purpose,
              handoffRule: dictionary.handoffRule
            })),
            dictionaryMappings: normalizedMappings.map((mapping) => ({
              eventName: mapping.eventName,
              propertyName: mapping.propertyName,
              dictionaryName: mapping.dictionaryName,
              isRequiredMapping: mapping.isRequiredMapping,
              mappingNote: mapping.mappingNote
            })),
            events: plan.events.map((event) => ({
              eventName: event.eventName,
              displayName: event.displayName,
              category: event.category?.name ?? null,
              triggerDescription: event.triggerDescription,
              businessGoal: event.businessGoal,
              notes: event.notes,
              properties: event.properties.map((property) => ({
                name: property.name,
                type: property.type,
                isRequired: property.isRequired,
                description: property.description
              }))
            }))
          },
          null,
          2
        )
      ].join("\n\n");

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error("Gemini 没有返回可解析的诊断内容。");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(rawText));
      } catch {
        throw new Error("Gemini 返回的诊断结果不是有效 JSON。");
      }

      aiDiagnosis = diagnosisSchema.parse(parsed);
    } catch {
      aiDiagnosis = null;
    }

    const seen = new Set<string>();
    const mergedFindings = [...ruleDiagnosis.findings, ...(aiDiagnosis?.findings ?? [])].filter((finding) => {
      const key = `${finding.type}:${finding.title}:${finding.eventName ?? ""}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    const saved = await savePlanDiagnosis(planId, {
      summary: aiDiagnosis
        ? `${ruleDiagnosis.summary} AI 诊断已补充命名、漏斗与字段语义建议。`
        : `${ruleDiagnosis.summary} 当前使用规则诊断结果。`,
      findings: mergedFindings
    });

    return {
      diagnosis: saved,
      model
    };
  } catch (error) {
    await updatePlanDiagnosisStatus(planId, JobStatus.FAILED);
    throw error;
  }
}
