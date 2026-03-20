export type StoredModel = {
  modelName: string;
  displayName?: string | null;
  isAvailable: boolean;
  isDefault: boolean;
  supportedActions: string[];
  detectedAt: string;
};

export type StoredAiConfig = {
  provider: "GEMINI";
  encryptedApiKey?: string | null;
  status: string;
  defaultModel?: string | null;
  lastVerifiedAt?: string | null;
  updatedAt: string;
  models: StoredModel[];
};

export type MemoryUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
};

export type MemorySession = {
  tokenHash: string;
  userId: string;
  expiresAt: number;
};

export type MemoryProject = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  platform: string | null;
  currentVersion: string | null;
  createdAt: number;
  updatedAt: number;
};

export type MemoryMembership = {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  createdAt: number;
};

export type MemoryCategory = {
  id: string;
  projectId: string;
  name: string;
  type: string;
  color: string | null;
  sortOrder: number;
  description: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
};

export type MemoryPlan = {
  id: string;
  projectId: string;
  name: string;
  version: string;
  status: string;
  summary: string | null;
  diagnosisStatus: string;
  confirmedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type MemoryPlanInputSource = {
  id: string;
  trackingPlanId: string;
  type: string;
  label: string | null;
  content: string | null;
  fileName: string | null;
  mimeType: string | null;
  createdAt: number;
};

export type MemoryEvent = {
  id: string;
  trackingPlanId: string;
  categoryId: string;
  eventName: string;
  displayName: string | null;
  triggerDescription: string | null;
  businessGoal: string | null;
  notes: string | null;
  sourceLabel: string | null;
  createdAt: number;
  updatedAt: number;
};

export type MemoryProperty = {
  id: string;
  trackingEventId: string;
  name: string;
  type: string;
  isRequired: boolean;
  sampleValue: string | null;
  description: string | null;
  sortOrder: number;
};

export type MemoryGlobalProperty = {
  id: string;
  trackingPlanId: string;
  name: string;
  type: string;
  isRequired: boolean;
  sampleValue: string | null;
  description: string | null;
  category: string | null;
  sortOrder: number;
};

export type MemoryDictionary = {
  id: string;
  trackingPlanId: string;
  name: string;
  configName: string;
  relatedModule: string;
  paramNames: string[];
  purpose: string;
  handoffRule: string;
  sourceType: string;
  sortOrder: number;
};

export type MemoryDictionaryMapping = {
  id: string;
  trackingPlanId: string;
  trackingEventId: string | null;
  propertyName: string;
  dictionaryId: string;
  isRequiredMapping: boolean;
  mappingNote: string | null;
};

export type MemoryLogUpload = {
  id: string;
  fileName: string;
  source: string;
  version: string;
  rawHeaders: string[] | null;
  fieldMappings: Array<{ source: string; target: string }> | null;
  summaryJson: Record<string, unknown> | null;
  recordCount: number;
  successRate: number | null;
  errorCount: number;
  unmatchedEvents: number;
  status: string;
  uploadedAt: number;
  projectId: string;
  trackingPlanId: string | null;
};

export type MemoryMetricSnapshot = {
  id: string;
  metricKey: string;
  metricLabel: string;
  metricValue: number;
  dimension: string | null;
  version: string | null;
  capturedAt: number;
  projectId: string;
};

export type MemoryPlanDiagnosis = {
  id: string;
  trackingPlanId: string;
  summary: string;
  findings: Array<{
    type: string;
    severity: string;
    title: string;
    detail: string;
    eventName: string | null;
    recommendation: string | null;
  }>;
  generatedAt: number;
};

export type MemoryAiReport = {
  id: string;
  title: string;
  summary: string;
  riskLevel: string;
  dataSource: string;
  versionFrom: string | null;
  versionTo: string | null;
  generatedAt: number;
  projectId: string;
};

export type MemoryPlanTask = {
  id: string;
  trackingPlanId: string;
  type: "GENERATE" | "DIAGNOSE";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  message: string;
  error: string | null;
  result: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
};

declare global {
  var __telemetryStudioStore__:
    | {
        aiConfig: StoredAiConfig | null;
        users: MemoryUser[];
        sessions: MemorySession[];
        projects: MemoryProject[];
        memberships: MemoryMembership[];
        categories: MemoryCategory[];
        plans: MemoryPlan[];
        planInputSources: MemoryPlanInputSource[];
        planDiagnoses: MemoryPlanDiagnosis[];
        events: MemoryEvent[];
        properties: MemoryProperty[];
        globalProperties: MemoryGlobalProperty[];
        dictionaries: MemoryDictionary[];
        dictionaryMappings: MemoryDictionaryMapping[];
        logUploads: MemoryLogUpload[];
        metricSnapshots: MemoryMetricSnapshot[];
        aiReports: MemoryAiReport[];
        planTasks: MemoryPlanTask[];
      }
    | undefined;
}

export function getMemoryStore() {
  if (!global.__telemetryStudioStore__) {
    global.__telemetryStudioStore__ = {
      aiConfig: null,
      users: [],
      sessions: [],
      projects: [],
      memberships: [],
      categories: [],
      plans: [],
      planInputSources: [],
      planDiagnoses: [],
      events: [],
      properties: [],
      globalProperties: [],
      dictionaries: [],
      dictionaryMappings: [],
      logUploads: [],
      metricSnapshots: [],
      aiReports: [],
      planTasks: []
    };
  }

  return global.__telemetryStudioStore__;
}
