import crypto from "node:crypto";

import { diagnoseTrackingPlan } from "./plan-diagnosis";
import { generateTrackingPlanFromPrompt } from "./plan-generation";
import { getMemoryStore } from "./store";

type JobType = "GENERATE" | "DIAGNOSE";

function updateJob(
  jobId: string,
  patch: Partial<{
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
    message: string;
    error: string | null;
    result: Record<string, unknown> | null;
  }>
) {
  const store = getMemoryStore();
  const task = store.planTasks.find((item) => item.id === jobId);
  if (!task) {
    return null;
  }

  Object.assign(task, patch, { updatedAt: Date.now() });
  return task;
}

async function runJob(jobId: string, planId: string, type: JobType, payload?: unknown) {
  updateJob(jobId, {
    status: "PROCESSING",
    message: type === "GENERATE" ? "正在生成方案包..." : "正在执行诊断..."
  });

  try {
    const result =
      type === "GENERATE"
        ? await generateTrackingPlanFromPrompt(planId, payload)
        : await diagnoseTrackingPlan(planId);

    updateJob(jobId, {
      status: "COMPLETED",
      message: type === "GENERATE" ? "方案生成完成。" : "诊断完成。",
      result: result as Record<string, unknown>,
      error: null
    });
  } catch (error) {
    updateJob(jobId, {
      status: "FAILED",
      message: type === "GENERATE" ? "方案生成失败。" : "诊断失败。",
      error: error instanceof Error ? error.message : "任务失败",
      result: null
    });
  }
}

export function createPlanJob(planId: string, type: JobType, payload?: unknown) {
  const store = getMemoryStore();
  const jobId = crypto.randomUUID();
  const now = Date.now();

  store.planTasks.push({
    id: jobId,
    trackingPlanId: planId,
    type,
    status: "PENDING",
    message: type === "GENERATE" ? "任务已创建，等待执行。" : "诊断任务已创建，等待执行。",
    error: null,
    result: null,
    createdAt: now,
    updatedAt: now
  });

  void Promise.resolve().then(() => runJob(jobId, planId, type, payload));

  return store.planTasks.find((task) => task.id === jobId)!;
}

export function getPlanJob(jobId: string) {
  const store = getMemoryStore();
  return store.planTasks.find((task) => task.id === jobId) ?? null;
}
