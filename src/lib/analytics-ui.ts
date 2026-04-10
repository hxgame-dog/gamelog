export type OnboardingTrendStep = {
  stepId: string;
  stepName: string;
  completionRate: number;
};

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
