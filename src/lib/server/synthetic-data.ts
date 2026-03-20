import { z } from "zod";

import { createLogImport } from "./imports";
import { getPlanById } from "./plans";

const generateSyntheticSchema = z.object({
  version: z.string().min(1).optional(),
  userCount: z.number().int().min(20).max(5000).default(240),
  days: z.number().int().min(1).max(30).default(7)
});

type SyntheticRow = Record<string, string | number | boolean | null>;

function normalizeCategoryName(name?: string | null) {
  const value = (name ?? "").toLowerCase();

  if (value.includes("公共") || value.includes("system")) {
    return "system";
  }
  if (value.includes("引导") || value.includes("tutorial") || value.includes("onboarding")) {
    return "onboarding";
  }
  if (value.includes("关卡") || value.includes("level")) {
    return "level";
  }
  if (value.includes("广告") || value.includes("ad")) {
    return "ads";
  }
  if (value.includes("商业化") || value.includes("iap") || value.includes("付费")) {
    return "monetization";
  }

  return "custom";
}

function shouldEmitEvent(category: string, eventName: string) {
  const normalizedName = eventName.toLowerCase();

  if (category === "system") {
    return Math.random() < 0.88;
  }
  if (category === "onboarding") {
    if (normalizedName.includes("start")) {
      return Math.random() < 0.94;
    }
    if (normalizedName.includes("complete") || normalizedName.includes("finish")) {
      return Math.random() < 0.68;
    }
    return Math.random() < 0.79;
  }
  if (category === "level") {
    return Math.random() < 0.74;
  }
  if (category === "ads") {
    return Math.random() < 0.36;
  }
  if (category === "monetization") {
    return Math.random() < 0.18;
  }

  return Math.random() < 0.42;
}

function buildResult(category: string, eventName: string) {
  const normalizedName = eventName.toLowerCase();

  if (normalizedName.includes("fail")) {
    return "fail";
  }
  if (normalizedName.includes("complete") || normalizedName.includes("success") || normalizedName.includes("purchase")) {
    return Math.random() < 0.78 ? "success" : "fail";
  }
  if (category === "ads") {
    return Math.random() < 0.74 ? "success" : "close";
  }
  if (category === "level") {
    return Math.random() < 0.56 ? "success" : "fail";
  }
  if (category === "onboarding") {
    return Math.random() < 0.72 ? "success" : "drop";
  }

  return "success";
}

function buildPropertyValue(
  propertyName: string,
  propertyType: string,
  index: number,
  userId: string,
  category: string,
  result: string
) {
  const normalizedName = propertyName.toLowerCase();

  if (normalizedName.includes("user")) {
    return userId;
  }
  if (normalizedName.includes("step")) {
    return String((index % 6) + 1);
  }
  if (normalizedName.includes("level")) {
    return `level_${(index % 18) + 1}`;
  }
  if (normalizedName.includes("duration")) {
    return category === "onboarding"
      ? Number((8 + Math.random() * 32).toFixed(1))
      : Number((20 + Math.random() * 80).toFixed(1));
  }
  if (normalizedName.includes("price") || normalizedName.includes("amount")) {
    return Number((0.99 + Math.floor(Math.random() * 5) * 1.5).toFixed(2));
  }
  if (normalizedName.includes("currency")) {
    return "USD";
  }
  if (normalizedName.includes("placement") || normalizedName.includes("slot")) {
    return ["reward_video", "level_end_interstitial", "shop_popup"][index % 3];
  }
  if (normalizedName.includes("reason")) {
    return result === "fail" || result === "close"
      ? ["misclick", "timeout", "resource_shortage"][index % 3]
      : "";
  }
  if (normalizedName.includes("result") || normalizedName.includes("status")) {
    return result;
  }
  if (normalizedName.includes("reward")) {
    return result === "success" ? "coin_pack" : "";
  }
  if (propertyType === "number" || propertyType === "integer") {
    return index % 10;
  }
  if (propertyType === "boolean") {
    return index % 2 === 0;
  }

  return `sample_${index + 1}`;
}

function buildStandardMappings(headers: string[]) {
  return headers.map((header) => ({
    source: header,
    target: header
  }));
}

export async function generateSyntheticDataset(planId: string, input: unknown) {
  const payload = generateSyntheticSchema.parse(input);
  const plan = await getPlanById(planId);

  if (!plan) {
    throw new Error("方案不存在。");
  }

  if (!plan.events.length) {
    throw new Error("当前方案还没有事件，无法生成模拟数据。");
  }

  const rows: SyntheticRow[] = [];
  const version = payload.version ?? plan.version;
  const totalUsers = payload.userCount;

  for (let userIndex = 0; userIndex < totalUsers; userIndex += 1) {
    const userId = `u_${String(userIndex + 1).padStart(5, "0")}`;

    plan.events.forEach((event, eventIndex) => {
      const category = normalizeCategoryName(event.category?.name);

      if (!shouldEmitEvent(category, event.eventName)) {
        return;
      }

      const result = buildResult(category, event.eventName);
      const row: SyntheticRow = {
        user_id: userId,
        event_name: event.eventName,
        result,
        duration_sec:
          category === "onboarding"
            ? Number((8 + Math.random() * 32).toFixed(1))
            : Number((15 + Math.random() * 65).toFixed(1))
      };

      if (category === "onboarding") {
        row.step_id = String((eventIndex % 6) + 1);
      }

      if (category === "level") {
        row.level_id = `level_${(eventIndex % 18) + 1}`;
        row.reason = result === "fail" ? ["timeout", "misclick", "resource_shortage"][eventIndex % 3] : "";
      }

      if (category === "ads") {
        row.placement = ["reward_video", "level_end_interstitial", "revive_popup"][eventIndex % 3];
        row.reward_type = result === "success" ? "coin_pack" : "";
      }

      if (category === "monetization") {
        row.price = Number((0.99 + (eventIndex % 4) * 1.5).toFixed(2));
        row.currency = "USD";
      }

      event.properties.forEach((property, propertyIndex) => {
        row[property.name] = buildPropertyValue(
          property.name,
          property.type,
          userIndex + propertyIndex + eventIndex,
          userId,
          category,
          result
        );
      });

      rows.push(row);
    });
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const mappings = buildStandardMappings(headers);

  const result = await createLogImport({
    projectId: plan.projectId,
    trackingPlanId: plan.id,
    version,
    fileName: `${plan.name}-${version}-synthetic.csv`,
    source: "SYNTHETIC",
    rows,
    mappings
  });

  return {
    ...result,
    generatedUsers: totalUsers,
    days: payload.days
  };
}
