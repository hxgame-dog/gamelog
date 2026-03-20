export type GeminiModelInfo = {
  modelName: string;
  displayName?: string;
  supportedActions: string[];
};

type GeminiListResponse = {
  models?: Array<{
    name: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }>;
};

export async function detectGeminiModels(apiKey: string): Promise<GeminiModelInfo[]> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to fetch Gemini models.");
  }

  const data = (await response.json()) as GeminiListResponse;

  return (data.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => ({
      modelName: model.name.replace(/^models\//, ""),
      displayName: model.displayName,
      supportedActions: model.supportedGenerationMethods ?? []
    }))
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

export function pickDefaultGeminiModel(models: GeminiModelInfo[]) {
  const preferredNames = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
  ];

  for (const name of preferredNames) {
    const match = models.find((model) => model.modelName === name);
    if (match) {
      return match.modelName;
    }
  }

  return models[0]?.modelName ?? null;
}
