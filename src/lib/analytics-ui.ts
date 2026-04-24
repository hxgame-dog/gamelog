export type OnboardingTrendStep = {
  stepId: string;
  stepName: string;
  completionRate: number;
};

const tutorialStepLabels: Record<string, string> = {
  newguidebegin: "引导开始",
  newgudiebegin: "引导开始",
  tutorial_begin: "引导开始",
  tutorial_level_start: "进入引导关",
  tutoriallevel_start: "进入引导关",
  show_click_guide: "点击引导出现",
  player_click: "完成点击操作",
  show_rotate_model_guide: "旋转视角引导出现",
  player_rotate_model: "完成旋转视角",
  the_first_box_clear: "清除第一个盒子",
  finish_level: "完成引导关",
  guide_finish_drill: "完成电钻引导",
  guide_finish_magnet: "完成磁铁引导",
  claim_drill: "领取电钻",
  use_drill: "使用电钻",
  match_screw: "匹配螺丝",
  rotate_scene: "旋转场景"
};

export function formatTutorialStepName(stepId?: string | null, stepName?: string | null) {
  const rawName = (stepName || stepId || "").trim();
  const key = rawName.toLowerCase();

  if (tutorialStepLabels[key]) {
    return tutorialStepLabels[key];
  }

  if (/^\d+$/.test(String(stepId ?? ""))) {
    return `第 ${stepId} 步`;
  }

  if (!rawName) {
    return "未命名步骤";
  }

  return rawName
    .replace(/^guide[_-]?finish[_-]?/i, "完成")
    .replace(/^show[_-]?/i, "展示")
    .replace(/[_-]+/g, " ")
    .trim();
}

export function linePathWithNulls(values: Array<number | null>) {
  let path = "";
  let started = false;

  values.forEach((value, index) => {
    if (value === null) {
      started = false;
      return;
    }

    const x = (index / (values.length - 1 || 1)) * 100;
    const y = 100 - value;
    path += `${path ? " " : ""}${started ? "L" : "M"} ${x} ${y}`;
    started = true;
  });

  return path;
}

export function deriveOnboardingTrendCompareSeries(
  steps: OnboardingTrendStep[],
  compareSteps?: OnboardingTrendStep[]
) {
  const compareMap = new Map((compareSteps ?? []).map((step) => [step.stepId || step.stepName, step]));
  const compareValues = steps.map((step) => compareMap.get(step.stepId || step.stepName)?.completionRate ?? null);

  return {
    compareValues,
    compareLatest: compareValues.at(-1) ?? null,
    comparePoints: compareSteps?.length ? linePathWithNulls(compareValues) : ""
  };
}
