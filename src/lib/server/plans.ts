import crypto from "node:crypto";

import { InputSourceType, JobStatus, PlanStatus } from "@prisma/client";
import { z } from "zod";
import * as XLSX from "xlsx";

import { getPrismaClient, hasDatabaseUrl } from "./prisma";
import { getMemoryStore } from "./store";

const createPlanSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(2, "方案名称至少需要 2 个字符。"),
  version: z.string().min(2, "请填写方案版本。"),
  summary: z.string().optional().nullable(),
  sourceContent: z.string().optional().nullable()
});

const updatePlanSchema = z.object({
  name: z.string().min(2).optional(),
  version: z.string().min(2).optional(),
  summary: z.string().nullable().optional(),
  status: z.nativeEnum(PlanStatus).optional(),
  appendInputSource: z
    .object({
      type: z.nativeEnum(InputSourceType),
      label: z.string().min(1),
      content: z.string().nullable().optional(),
      fileName: z.string().nullable().optional(),
      mimeType: z.string().nullable().optional()
    })
    .optional(),
  globalProperties: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        isRequired: z.boolean(),
        sampleValue: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional()
      })
    )
    .optional(),
  dictionaries: z
    .array(
      z.object({
        name: z.string().min(1),
        configName: z.string().min(1),
        relatedModule: z.string().min(1),
        paramNames: z.array(z.string().min(1)).min(1),
        purpose: z.string().min(1),
        handoffRule: z.string().min(1),
        sourceType: z.string().min(1)
      })
    )
    .optional(),
  dictionaryMappings: z
    .array(
      z.object({
        eventName: z.string().nullable().optional(),
        propertyName: z.string().min(1),
        dictionaryName: z.string().min(1),
        isRequiredMapping: z.boolean(),
        mappingNote: z.string().nullable().optional()
      })
    )
    .optional()
});

const upsertEventSchema = z.object({
  eventName: z.string().min(2, "事件名至少需要 2 个字符。"),
  displayName: z.string().nullable().optional(),
  triggerDescription: z.string().nullable().optional(),
  businessGoal: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sourceLabel: z.string().nullable().optional(),
  categoryId: z.string().min(1, "请选择事件分类。"),
  properties: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, "字段名不能为空。"),
      type: z.string().min(1, "字段类型不能为空。"),
      isRequired: z.boolean().default(false),
      sampleValue: z.string().nullable().optional(),
      description: z.string().nullable().optional()
    })
  )
});

const generatedEventSchema = z.object({
  eventName: z.string().min(2),
  displayName: z.string().nullable().optional(),
  triggerDescription: z.string().nullable().optional(),
  businessGoal: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sourceLabel: z.string().nullable().optional(),
  categoryId: z.string().min(1),
  properties: z.array(
    z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      isRequired: z.boolean().default(false),
      sampleValue: z.string().nullable().optional(),
      description: z.string().nullable().optional()
    })
  )
});

const packageGlobalPropertySchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  isRequired: z.boolean().default(true),
  sampleValue: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional()
});

const packageDictionarySchema = z.object({
  name: z.string().min(1),
  configName: z.string().min(1),
  relatedModule: z.string().min(1),
  paramNames: z.array(z.string().min(1)).min(1),
  purpose: z.string().min(1),
  handoffRule: z.string().min(1),
  sourceType: z.string().default("AI_GENERATED")
});

const packageDictionaryMappingSchema = z.object({
  eventName: z.string().nullable().optional(),
  propertyName: z.string().min(1),
  dictionaryName: z.string().min(1),
  isRequiredMapping: z.boolean().default(true),
  mappingNote: z.string().nullable().optional()
});

function attachPackageData<
  T extends {
    id: string;
    events: Array<{ id: string; eventName: string; properties: Array<{ name: string }> }>;
  }
>(plan: T) {
  const store = getMemoryStore();
  const dictionaries = store.dictionaries
    .filter((item) => item.trackingPlanId === plan.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const globalProperties = store.globalProperties
    .filter((item) => item.trackingPlanId === plan.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const dictionaryMappings = store.dictionaryMappings
    .filter((item) => item.trackingPlanId === plan.id)
    .map((mapping) => ({
      ...mapping,
      dictionary: dictionaries.find((dictionary) => dictionary.id === mapping.dictionaryId) ?? null,
      eventName: mapping.trackingEventId
        ? plan.events.find((event) => event.id === mapping.trackingEventId)?.eventName ?? null
        : null
    }));

  return {
    ...plan,
    globalProperties,
    dictionaries,
    dictionaryMappings
  };
}

function mapDbPlan<
  T extends {
    globalProperties: Array<{
      id: string;
      name: string;
      type: string;
      isRequired: boolean;
      sampleValue: string | null;
      description: string | null;
      category: string | null;
      sortOrder: number;
    }>;
    dictionaries: Array<{
      id: string;
      name: string;
      configName: string;
      relatedModule: string;
      paramNames: string[];
      purpose: string;
      handoffRule: string;
      sourceType: string;
      sortOrder: number;
    }>;
    dictionaryMappings: Array<{
      id: string;
      propertyName: string;
      isRequiredMapping: boolean;
      mappingNote: string | null;
      trackingEvent: { eventName: string } | null;
      dictionary: {
        id: string;
        name: string;
        configName: string;
      };
    }>;
  }
>(plan: T) {
  return {
    ...plan,
    globalProperties: [...plan.globalProperties].sort((a, b) => a.sortOrder - b.sortOrder),
    dictionaries: [...plan.dictionaries].sort((a, b) => a.sortOrder - b.sortOrder),
    dictionaryMappings: plan.dictionaryMappings.map((mapping) => ({
      id: mapping.id,
      eventName: mapping.trackingEvent?.eventName ?? null,
      propertyName: mapping.propertyName,
      isRequiredMapping: mapping.isRequiredMapping,
      mappingNote: mapping.mappingNote,
      dictionary: mapping.dictionary
    }))
  };
}

export async function getPlansForProject(projectId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    return store.plans
      .filter((plan) => plan.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((plan) =>
        attachPackageData({
          ...plan,
          diagnosis: store.planDiagnoses.find((diagnosis) => diagnosis.trackingPlanId === plan.id) ?? null,
          events: store.events
            .filter((event) => event.trackingPlanId === plan.id)
            .map((event) => ({
              ...event,
              category: store.categories.find((category) => category.id === event.categoryId) ?? null,
              properties: store.properties.filter((property) => property.trackingEventId === event.id)
            })),
          inputSources: store.planInputSources.filter((source) => source.trackingPlanId === plan.id)
        })
      );
  }

  const plans = await prisma.trackingPlan.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      diagnosis: true,
      inputSources: {
        orderBy: { createdAt: "asc" }
      },
      events: {
        orderBy: { createdAt: "asc" },
        include: {
          category: true,
          properties: {
            orderBy: { sortOrder: "asc" }
          }
        }
      },
      globalProperties: {
        orderBy: { sortOrder: "asc" }
      },
      dictionaries: {
        orderBy: { sortOrder: "asc" }
      },
      dictionaryMappings: {
        include: {
          trackingEvent: {
            select: { eventName: true }
          },
          dictionary: {
            select: {
              id: true,
              name: true,
              configName: true
            }
          }
        }
      }
    }
  });

  return plans.map((plan) => mapDbPlan(plan));
}

export async function getPlanById(planId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const plan = store.plans.find((item) => item.id === planId);

    if (!plan) {
      return null;
    }

    return {
      ...attachPackageData({
        ...plan,
        diagnosis: store.planDiagnoses.find((diagnosis) => diagnosis.trackingPlanId === plan.id) ?? null,
        inputSources: store.planInputSources
          .filter((source) => source.trackingPlanId === plan.id)
          .sort((a, b) => a.createdAt - b.createdAt),
        events: store.events
          .filter((event) => event.trackingPlanId === plan.id)
          .map((event) => ({
            ...event,
            category: store.categories.find((category) => category.id === event.categoryId) ?? null,
            properties: store.properties
              .filter((property) => property.trackingEventId === event.id)
              .sort((a, b) => a.sortOrder - b.sortOrder)
          }))
      })
    };
  }

  const plan = await prisma.trackingPlan.findUnique({
    where: { id: planId },
    include: {
      diagnosis: true,
      inputSources: {
        orderBy: { createdAt: "asc" }
      },
      events: {
        orderBy: { createdAt: "asc" },
        include: {
          category: true,
          properties: {
            orderBy: { sortOrder: "asc" }
          }
        }
      },
      globalProperties: {
        orderBy: { sortOrder: "asc" }
      },
      dictionaries: {
        orderBy: { sortOrder: "asc" }
      },
      dictionaryMappings: {
        include: {
          trackingEvent: {
            select: { eventName: true }
          },
          dictionary: {
            select: {
              id: true,
              name: true,
              configName: true
            }
          }
        }
      }
    }
  });

  return plan ? mapDbPlan(plan) : null;
}

export async function createPlan(input: unknown) {
  const payload = createPlanSchema.parse(input);
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const planId = crypto.randomUUID();
    const now = Date.now();
    store.plans.push({
      id: planId,
      projectId: payload.projectId,
      name: payload.name,
      version: payload.version,
      status: "DRAFT",
      summary: payload.summary ?? null,
      diagnosisStatus: "PENDING",
      confirmedAt: null,
      createdAt: now,
      updatedAt: now
    });

    store.planInputSources.push({
      id: crypto.randomUUID(),
      trackingPlanId: planId,
      type: "TEXT",
      label: "手动创建",
      content: payload.sourceContent ?? "由用户手动创建的方案。",
      fileName: null,
      mimeType: null,
      createdAt: now
    });

    return store.plans.find((plan) => plan.id === planId)!;
  }

  return prisma.trackingPlan.create({
    data: {
      projectId: payload.projectId,
      name: payload.name,
      version: payload.version,
      summary: payload.summary ?? null,
      status: PlanStatus.DRAFT,
      diagnosisStatus: JobStatus.PENDING,
      inputSources: {
        create: {
          type: InputSourceType.TEXT,
          label: "手动创建",
          content: payload.sourceContent ?? "由用户手动创建的方案。"
        }
      }
    }
  });
}

export async function updatePlan(planId: string, input: unknown) {
  const payload = updatePlanSchema.parse(input);
  const prisma = getPrismaClient();
  const packageTouched =
    payload.globalProperties !== undefined ||
    payload.dictionaries !== undefined ||
    payload.dictionaryMappings !== undefined;
  const metadataTouched =
    payload.name !== undefined || payload.version !== undefined || payload.summary !== undefined;
  const shouldResetWorkflow = packageTouched || metadataTouched;

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const plan = store.plans.find((item) => item.id === planId);
    if (!plan) {
      throw new Error("方案不存在。");
    }

    if (payload.name !== undefined) {
      plan.name = payload.name;
    }
    if (payload.version !== undefined) {
      plan.version = payload.version;
    }
    if (payload.summary !== undefined) {
      plan.summary = payload.summary;
    }
    if (payload.status !== undefined) {
      plan.status = payload.status;
      plan.confirmedAt = payload.status === "CONFIRMED" ? Date.now() : null;
      if (payload.status === "CONFIRMED") {
        plan.diagnosisStatus = "COMPLETED";
      }
    }
    if (payload.appendInputSource) {
      store.planInputSources.push({
        id: crypto.randomUUID(),
        trackingPlanId: planId,
        type: payload.appendInputSource.type,
        label: payload.appendInputSource.label,
        content: payload.appendInputSource.content ?? null,
        fileName: payload.appendInputSource.fileName ?? null,
        mimeType: payload.appendInputSource.mimeType ?? null,
        createdAt: Date.now()
      });
    }
    if (payload.globalProperties !== undefined) {
      store.globalProperties = store.globalProperties.filter((item) => item.trackingPlanId !== planId);
      payload.globalProperties.forEach((property, index) => {
        store.globalProperties.push({
          id: crypto.randomUUID(),
          trackingPlanId: planId,
          name: property.name,
          type: property.type,
          isRequired: property.isRequired,
          sampleValue: property.sampleValue ?? null,
          description: property.description ?? null,
          category: property.category ?? null,
          sortOrder: index + 1
        });
      });
    }
    if (payload.dictionaries !== undefined) {
      store.dictionaries = store.dictionaries.filter((item) => item.trackingPlanId !== planId);
      const dictionaryNameToId = new Map<string, string>();
      payload.dictionaries.forEach((dictionary, index) => {
        const id = crypto.randomUUID();
        dictionaryNameToId.set(dictionary.name, id);
        store.dictionaries.push({
          id,
          trackingPlanId: planId,
          name: dictionary.name,
          configName: dictionary.configName,
          relatedModule: dictionary.relatedModule,
          paramNames: dictionary.paramNames,
          purpose: dictionary.purpose,
          handoffRule: dictionary.handoffRule,
          sourceType: dictionary.sourceType,
          sortOrder: index + 1
        });
      });

      if (payload.dictionaryMappings !== undefined) {
        store.dictionaryMappings = store.dictionaryMappings.filter((item) => item.trackingPlanId !== planId);
        payload.dictionaryMappings.forEach((mapping) => {
          const dictionaryId =
            dictionaryNameToId.get(mapping.dictionaryName) ??
            store.dictionaries.find(
              (item) => item.trackingPlanId === planId && item.name === mapping.dictionaryName
            )?.id;
          if (!dictionaryId) {
            return;
          }
          const eventId =
            mapping.eventName
              ? store.events.find(
                  (item) => item.trackingPlanId === planId && item.eventName === mapping.eventName
                )?.id ?? null
              : null;
          store.dictionaryMappings.push({
            id: crypto.randomUUID(),
            trackingPlanId: planId,
            trackingEventId: eventId,
            propertyName: mapping.propertyName,
            dictionaryId,
            isRequiredMapping: mapping.isRequiredMapping,
            mappingNote: mapping.mappingNote ?? null
          });
        });
      }
    } else if (payload.dictionaryMappings !== undefined) {
      const dictionaryByName = new Map(
        store.dictionaries
          .filter((item) => item.trackingPlanId === planId)
          .map((item) => [item.name, item.id] as const)
      );
      store.dictionaryMappings = store.dictionaryMappings.filter((item) => item.trackingPlanId !== planId);
      payload.dictionaryMappings.forEach((mapping) => {
        const dictionaryId = dictionaryByName.get(mapping.dictionaryName);
        if (!dictionaryId) {
          return;
        }
        const eventId =
          mapping.eventName
            ? store.events.find(
                (item) => item.trackingPlanId === planId && item.eventName === mapping.eventName
              )?.id ?? null
            : null;
        store.dictionaryMappings.push({
          id: crypto.randomUUID(),
          trackingPlanId: planId,
          trackingEventId: eventId,
          propertyName: mapping.propertyName,
          dictionaryId,
          isRequiredMapping: mapping.isRequiredMapping,
          mappingNote: mapping.mappingNote ?? null
        });
      });
    }
    if (shouldResetWorkflow && payload.status === undefined) {
      plan.diagnosisStatus = "PENDING";
      plan.status = "DRAFT";
      plan.confirmedAt = null;
      store.planDiagnoses = store.planDiagnoses.filter((item) => item.trackingPlanId !== planId);
    }
    plan.updatedAt = Date.now();
    return getPlanById(planId);
  }

  return prisma.$transaction(async (tx) => {
    if (payload.globalProperties !== undefined) {
      await tx.trackingGlobalProperty.deleteMany({
        where: { trackingPlanId: planId }
      });

      if (payload.globalProperties.length) {
        await tx.trackingGlobalProperty.createMany({
          data: payload.globalProperties.map((property, index) => ({
            trackingPlanId: planId,
            name: property.name,
            type: property.type,
            isRequired: property.isRequired,
            sampleValue: property.sampleValue ?? null,
            description: property.description ?? null,
            category: property.category ?? null,
            sortOrder: index + 1
          }))
        });
      }
    }

    let dictionaryNameToId = new Map<string, string>();
    if (payload.dictionaries !== undefined) {
      await tx.trackingDictionaryMapping.deleteMany({
        where: { trackingPlanId: planId }
      });
      await tx.trackingDictionary.deleteMany({
        where: { trackingPlanId: planId }
      });

      for (const [index, dictionary] of payload.dictionaries.entries()) {
        const created = await tx.trackingDictionary.create({
          data: {
            trackingPlanId: planId,
            name: dictionary.name,
            configName: dictionary.configName,
            relatedModule: dictionary.relatedModule,
            paramNames: dictionary.paramNames,
            purpose: dictionary.purpose,
            handoffRule: dictionary.handoffRule,
            sourceType: dictionary.sourceType,
            sortOrder: index + 1
          }
        });
        dictionaryNameToId.set(created.name, created.id);
      }
    } else if (payload.dictionaryMappings !== undefined) {
      const dictionaries = await tx.trackingDictionary.findMany({
        where: { trackingPlanId: planId },
        select: { id: true, name: true }
      });
      dictionaryNameToId = new Map(dictionaries.map((item) => [item.name, item.id]));
      await tx.trackingDictionaryMapping.deleteMany({
        where: { trackingPlanId: planId }
      });
    }

    if (payload.dictionaryMappings !== undefined) {
      const events = await tx.trackingEvent.findMany({
        where: { trackingPlanId: planId },
        select: { id: true, eventName: true }
      });
      const eventNameToId = new Map(events.map((event) => [event.eventName, event.id]));

      for (const mapping of payload.dictionaryMappings) {
        const dictionaryId = dictionaryNameToId.get(mapping.dictionaryName);
        if (!dictionaryId) {
          continue;
        }
        await tx.trackingDictionaryMapping.create({
          data: {
            trackingPlanId: planId,
            trackingEventId: mapping.eventName ? (eventNameToId.get(mapping.eventName) ?? null) : null,
            propertyName: mapping.propertyName,
            dictionaryId,
            isRequiredMapping: mapping.isRequiredMapping,
            mappingNote: mapping.mappingNote ?? null
          }
        });
      }
    }

    const data: Record<string, unknown> = {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.version !== undefined ? { version: payload.version } : {}),
      ...(payload.summary !== undefined ? { summary: payload.summary } : {})
    };

    if (payload.status !== undefined) {
      data.status = payload.status;
      data.confirmedAt = payload.status === PlanStatus.CONFIRMED ? new Date() : null;
      if (payload.status === PlanStatus.CONFIRMED) {
        data.diagnosisStatus = JobStatus.COMPLETED;
      }
    } else if (shouldResetWorkflow) {
      data.status = PlanStatus.DRAFT;
      data.confirmedAt = null;
      data.diagnosisStatus = JobStatus.PENDING;
      await tx.trackingPlanDiagnosis.deleteMany({
        where: { trackingPlanId: planId }
      });
    }

    await tx.trackingPlan.update({
      where: { id: planId },
      data
    });

    if (payload.appendInputSource) {
      await tx.trackingPlanInputSource.create({
        data: {
          trackingPlanId: planId,
          type: payload.appendInputSource.type,
          label: payload.appendInputSource.label,
          content: payload.appendInputSource.content ?? null,
          fileName: payload.appendInputSource.fileName ?? null,
          mimeType: payload.appendInputSource.mimeType ?? null
        }
      });
    }

    const updated = await tx.trackingPlan.findUnique({
      where: { id: planId },
      include: {
        diagnosis: true,
        inputSources: {
          orderBy: { createdAt: "asc" }
        },
        events: {
          orderBy: { createdAt: "asc" },
          include: {
            category: true,
            properties: {
              orderBy: { sortOrder: "asc" }
            }
          }
        },
        globalProperties: {
          orderBy: { sortOrder: "asc" }
        },
        dictionaries: {
          orderBy: { sortOrder: "asc" }
        },
        dictionaryMappings: {
          include: {
            trackingEvent: {
              select: { eventName: true }
            },
            dictionary: {
              select: {
                id: true,
                name: true,
                configName: true
              }
            }
          }
        }
      }
    });

    return updated ? mapDbPlan(updated) : null;
  }, {
    maxWait: 10000,
    timeout: 30000
  });
}

export async function updatePlanDiagnosisStatus(planId: string, status: JobStatus) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const plan = store.plans.find((item) => item.id === planId);
    if (!plan) {
      throw new Error("方案不存在。");
    }
    plan.diagnosisStatus = status;
    plan.updatedAt = Date.now();
    return plan;
  }

  return prisma.trackingPlan.update({
    where: { id: planId },
    data: { diagnosisStatus: status }
  });
}

export async function resetPlanDiagnosis(planId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const plan = store.plans.find((item) => item.id === planId);
    if (plan) {
      plan.diagnosisStatus = "PENDING";
      if (plan.status !== "DRAFT") {
        plan.status = "DRAFT";
        plan.confirmedAt = null;
      }
      plan.updatedAt = Date.now();
    }
    store.planDiagnoses = store.planDiagnoses.filter((item) => item.trackingPlanId !== planId);
    return;
  }

  await prisma.$transaction([
    prisma.trackingPlanDiagnosis.deleteMany({
      where: { trackingPlanId: planId }
    }),
    prisma.trackingPlan.update({
      where: { id: planId },
      data: {
        diagnosisStatus: JobStatus.PENDING,
        status: PlanStatus.DRAFT,
        confirmedAt: null
      }
    })
  ]);
}

export async function savePlanDiagnosis(
  planId: string,
  input: {
    summary: string;
    findings: Array<{
      type: string;
      severity: string;
      title: string;
      detail: string;
      eventName?: string | null;
      recommendation?: string | null;
    }>;
  }
) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const existing = store.planDiagnoses.find((item) => item.trackingPlanId === planId);
    const diagnosis = {
      id: existing?.id ?? crypto.randomUUID(),
      trackingPlanId: planId,
      summary: input.summary,
      findings: input.findings.map((item) => ({
        type: item.type,
        severity: item.severity,
        title: item.title,
        detail: item.detail,
        eventName: item.eventName ?? null,
        recommendation: item.recommendation ?? null
      })),
      generatedAt: Date.now()
    };

    store.planDiagnoses = store.planDiagnoses.filter((item) => item.trackingPlanId !== planId);
    store.planDiagnoses.push(diagnosis);
    const plan = store.plans.find((item) => item.id === planId);
    if (plan) {
      plan.diagnosisStatus = "COMPLETED";
      plan.status = "DIAGNOSED";
      plan.updatedAt = Date.now();
    }
    return diagnosis;
  }

  await prisma.$transaction([
    prisma.trackingPlanDiagnosis.upsert({
      where: { trackingPlanId: planId },
      update: {
        summary: input.summary,
        findings: input.findings,
        generatedAt: new Date()
      },
      create: {
        trackingPlanId: planId,
        summary: input.summary,
        findings: input.findings
      }
    }),
    prisma.trackingPlan.update({
      where: { id: planId },
      data: {
        diagnosisStatus: JobStatus.COMPLETED,
        status: PlanStatus.DIAGNOSED
      }
    })
  ]);

  return prisma.trackingPlanDiagnosis.findUnique({
    where: { trackingPlanId: planId }
  });
}

export async function confirmPlan(planId: string) {
  const prisma = getPrismaClient();
  const plan = await getPlanById(planId);

  if (!plan) {
    throw new Error("方案不存在。");
  }
  if (!plan.events.length) {
    throw new Error("当前方案还没有事件，无法确认。");
  }
  if (plan.diagnosisStatus !== "COMPLETED") {
    throw new Error("请先完成诊断，再确认方案。");
  }

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const target = store.plans.find((item) => item.id === planId);
    if (!target) {
      throw new Error("方案不存在。");
    }
    target.status = "CONFIRMED";
    target.confirmedAt = Date.now();
    target.updatedAt = Date.now();
    return getPlanById(planId);
  }

  await prisma.trackingPlan.update({
    where: { id: planId },
    data: {
      status: PlanStatus.CONFIRMED,
      confirmedAt: new Date()
    }
  });

  return getPlanById(planId);
}

export async function createEvent(planId: string, input: unknown) {
  const payload = upsertEventSchema.parse(input);
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const eventId = crypto.randomUUID();
    const now = Date.now();
    store.events.push({
      id: eventId,
      trackingPlanId: planId,
      categoryId: payload.categoryId,
      eventName: payload.eventName,
      displayName: payload.displayName ?? null,
      triggerDescription: payload.triggerDescription ?? null,
      businessGoal: payload.businessGoal ?? null,
      notes: payload.notes ?? null,
      sourceLabel: payload.sourceLabel ?? "MANUAL",
      createdAt: now,
      updatedAt: now
    });

    payload.properties.forEach((property, index) => {
      store.properties.push({
        id: crypto.randomUUID(),
        trackingEventId: eventId,
        name: property.name,
        type: property.type,
        isRequired: property.isRequired,
        sampleValue: property.sampleValue ?? null,
        description: property.description ?? null,
        sortOrder: index + 1
      });
    });

    await resetPlanDiagnosis(planId);

    return {
      id: eventId
    };
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.trackingEvent.create({
      data: {
        trackingPlanId: planId,
        categoryId: payload.categoryId,
        eventName: payload.eventName,
        displayName: payload.displayName ?? null,
        triggerDescription: payload.triggerDescription ?? null,
        businessGoal: payload.businessGoal ?? null,
        notes: payload.notes ?? null,
        sourceLabel: payload.sourceLabel ?? "MANUAL",
        properties: {
          create: payload.properties.map((property, index) => ({
            name: property.name,
            type: property.type,
            isRequired: property.isRequired,
            sampleValue: property.sampleValue ?? null,
            description: property.description ?? null,
            sortOrder: index + 1
          }))
        }
      }
    });

    await tx.trackingPlanDiagnosis.deleteMany({
      where: { trackingPlanId: planId }
    });

    await tx.trackingPlan.update({
      where: { id: planId },
      data: {
        diagnosisStatus: JobStatus.PENDING,
        status: PlanStatus.DRAFT
      }
    });

    return created;
  });
}

export async function updateEvent(eventId: string, input: unknown) {
  const payload = upsertEventSchema.parse(input);
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const event = store.events.find((item) => item.id === eventId);
    if (!event) {
      throw new Error("事件不存在。");
    }

    event.categoryId = payload.categoryId;
    event.eventName = payload.eventName;
    event.displayName = payload.displayName ?? null;
    event.triggerDescription = payload.triggerDescription ?? null;
    event.businessGoal = payload.businessGoal ?? null;
    event.notes = payload.notes ?? null;
    event.sourceLabel = payload.sourceLabel ?? "MANUAL";
    event.updatedAt = Date.now();

    store.properties = store.properties.filter((property) => property.trackingEventId !== eventId);
    payload.properties.forEach((property, index) => {
      store.properties.push({
        id: property.id ?? crypto.randomUUID(),
        trackingEventId: eventId,
        name: property.name,
        type: property.type,
        isRequired: property.isRequired,
        sampleValue: property.sampleValue ?? null,
        description: property.description ?? null,
        sortOrder: index + 1
      });
    });

    await resetPlanDiagnosis(event.trackingPlanId);

    return event;
  }

  return prisma.$transaction(async (tx) => {
    const currentEvent = await tx.trackingEvent.findUnique({
      where: { id: eventId },
      select: { trackingPlanId: true }
    });
    if (!currentEvent) {
      throw new Error("事件不存在。");
    }

    await tx.trackingEvent.update({
      where: { id: eventId },
      data: {
        categoryId: payload.categoryId,
        eventName: payload.eventName,
        displayName: payload.displayName ?? null,
        triggerDescription: payload.triggerDescription ?? null,
        businessGoal: payload.businessGoal ?? null,
        notes: payload.notes ?? null,
        sourceLabel: payload.sourceLabel ?? "MANUAL"
      }
    });

    await tx.trackingProperty.deleteMany({
      where: { trackingEventId: eventId }
    });

    await tx.trackingProperty.createMany({
      data: payload.properties.map((property, index) => ({
        trackingEventId: eventId,
        name: property.name,
        type: property.type,
        isRequired: property.isRequired,
        sampleValue: property.sampleValue ?? null,
        description: property.description ?? null,
        sortOrder: index + 1
      }))
    });

    await tx.trackingPlanDiagnosis.deleteMany({
      where: { trackingPlanId: currentEvent.trackingPlanId }
    });

    await tx.trackingPlan.update({
      where: { id: currentEvent.trackingPlanId },
      data: {
        diagnosisStatus: JobStatus.PENDING,
        status: PlanStatus.DRAFT
      }
    });

    return tx.trackingEvent.findUnique({
      where: { id: eventId },
      include: {
        category: true,
        properties: {
          orderBy: { sortOrder: "asc" }
        }
      }
    });
  });
}

export async function deleteEvent(eventId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const event = store.events.find((item) => item.id === eventId);
    const eventIndex = store.events.findIndex((item) => item.id === eventId);
    if (eventIndex === -1) {
      throw new Error("事件不存在。");
    }

    store.events.splice(eventIndex, 1);
    store.properties = store.properties.filter((property) => property.trackingEventId !== eventId);
    store.dictionaryMappings = store.dictionaryMappings.filter((mapping) => mapping.trackingEventId !== eventId);
    if (event) {
      await resetPlanDiagnosis(event.trackingPlanId);
    }
    return { success: true };
  }

  const currentEvent = await prisma.trackingEvent.findUnique({
    where: { id: eventId },
    select: { trackingPlanId: true }
  });

  await prisma.trackingDictionaryMapping.deleteMany({
    where: { trackingEventId: eventId }
  });

  await prisma.trackingEvent.delete({
    where: { id: eventId }
  });

  if (currentEvent) {
    await resetPlanDiagnosis(currentEvent.trackingPlanId);
  }

  return { success: true };
}

export async function replacePlanEvents(
  planId: string,
  input: {
    summary?: string | null;
    sourceContent: string;
    sourceLabel: string;
    inputSourceType?: InputSourceType;
    events: Array<z.infer<typeof generatedEventSchema>>;
    globalProperties?: Array<z.infer<typeof packageGlobalPropertySchema>>;
    dictionaries?: Array<z.infer<typeof packageDictionarySchema>>;
    dictionaryMappings?: Array<z.infer<typeof packageDictionaryMappingSchema>>;
  }
) {
  const payload = {
    summary: input.summary ?? null,
    sourceContent: input.sourceContent,
    sourceLabel: input.sourceLabel,
    inputSourceType: input.inputSourceType ?? InputSourceType.TEXT,
    events: z.array(generatedEventSchema).parse(input.events),
    globalProperties: z.array(packageGlobalPropertySchema).parse(input.globalProperties ?? []),
    dictionaries: z.array(packageDictionarySchema).parse(input.dictionaries ?? []),
    dictionaryMappings: z.array(packageDictionaryMappingSchema).parse(input.dictionaryMappings ?? [])
  };
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const plan = store.plans.find((item) => item.id === planId);
    if (!plan) {
      throw new Error("方案不存在。");
    }

    const existingEventIds = new Set(
      store.events.filter((event) => event.trackingPlanId === planId).map((event) => event.id)
    );

    store.events = store.events.filter((event) => event.trackingPlanId !== planId);
    store.properties = store.properties.filter((property) => !existingEventIds.has(property.trackingEventId));
    store.globalProperties = store.globalProperties.filter((item) => item.trackingPlanId !== planId);
    store.dictionaries = store.dictionaries.filter((item) => item.trackingPlanId !== planId);
    store.dictionaryMappings = store.dictionaryMappings.filter((item) => item.trackingPlanId !== planId);

    const now = Date.now();
    plan.updatedAt = now;
    plan.diagnosisStatus = "PENDING";
    if (!plan.summary && payload.summary) {
      plan.summary = payload.summary;
    }
    store.planDiagnoses = store.planDiagnoses.filter((item) => item.trackingPlanId !== planId);

    store.planInputSources.push({
      id: crypto.randomUUID(),
      trackingPlanId: planId,
      type: payload.inputSourceType,
      label: payload.sourceLabel,
      content: payload.sourceContent,
      fileName: null,
      mimeType: null,
      createdAt: now
    });

    const eventNameToId = new Map<string, string>();

    payload.events.forEach((event, eventIndex) => {
      const eventId = crypto.randomUUID();
      eventNameToId.set(event.eventName, eventId);
      store.events.push({
        id: eventId,
        trackingPlanId: planId,
        categoryId: event.categoryId,
        eventName: event.eventName,
        displayName: event.displayName ?? null,
        triggerDescription: event.triggerDescription ?? null,
        businessGoal: event.businessGoal ?? null,
        notes: event.notes ?? null,
        sourceLabel: event.sourceLabel ?? "AI_GENERATED",
        createdAt: now + eventIndex,
        updatedAt: now + eventIndex
      });

      event.properties.forEach((property, propertyIndex) => {
        store.properties.push({
          id: crypto.randomUUID(),
          trackingEventId: eventId,
          name: property.name,
          type: property.type,
          isRequired: property.isRequired,
          sampleValue: property.sampleValue ?? null,
          description: property.description ?? null,
          sortOrder: propertyIndex + 1
        });
      });
    });

    payload.globalProperties.forEach((property, index) => {
      store.globalProperties.push({
        id: crypto.randomUUID(),
        trackingPlanId: planId,
        name: property.name,
        type: property.type,
        isRequired: property.isRequired,
        sampleValue: property.sampleValue ?? null,
        description: property.description ?? null,
        category: property.category ?? null,
        sortOrder: index + 1
      });
    });

    const dictionaryNameToId = new Map<string, string>();
    payload.dictionaries.forEach((dictionary, index) => {
      const dictionaryId = crypto.randomUUID();
      dictionaryNameToId.set(dictionary.name, dictionaryId);
      store.dictionaries.push({
        id: dictionaryId,
        trackingPlanId: planId,
        name: dictionary.name,
        configName: dictionary.configName,
        relatedModule: dictionary.relatedModule,
        paramNames: dictionary.paramNames,
        purpose: dictionary.purpose,
        handoffRule: dictionary.handoffRule,
        sourceType: dictionary.sourceType,
        sortOrder: index + 1
      });
    });

    payload.dictionaryMappings.forEach((mapping) => {
      const dictionaryId = dictionaryNameToId.get(mapping.dictionaryName);
      if (!dictionaryId) {
        return;
      }
      store.dictionaryMappings.push({
        id: crypto.randomUUID(),
        trackingPlanId: planId,
        trackingEventId: mapping.eventName ? (eventNameToId.get(mapping.eventName) ?? null) : null,
        propertyName: mapping.propertyName,
        dictionaryId,
        isRequiredMapping: mapping.isRequiredMapping,
        mappingNote: mapping.mappingNote ?? null
      });
    });

    return getPlanById(planId);
  }

  return prisma.$transaction(async (tx) => {
    const plan = await tx.trackingPlan.findUnique({
      where: { id: planId },
      include: {
        events: {
          select: { id: true }
        }
      }
    });

    if (!plan) {
      throw new Error("方案不存在。");
    }

    const existingEventIds = plan.events.map((event) => event.id);

    if (existingEventIds.length) {
      await tx.trackingProperty.deleteMany({
        where: {
          trackingEventId: { in: existingEventIds }
        }
      });
    }

    await tx.trackingDictionaryMapping.deleteMany({
      where: { trackingPlanId: planId }
    });
    await tx.trackingGlobalProperty.deleteMany({
      where: { trackingPlanId: planId }
    });
    await tx.trackingDictionary.deleteMany({
      where: { trackingPlanId: planId }
    });

    await tx.trackingEvent.deleteMany({
      where: { trackingPlanId: planId }
    });

    await tx.trackingPlanInputSource.create({
      data: {
        trackingPlanId: planId,
        type: payload.inputSourceType,
        label: payload.sourceLabel,
        content: payload.sourceContent
      }
    });

    await tx.trackingPlan.update({
      where: { id: planId },
      data: {
        ...(plan.summary ? {} : { summary: payload.summary }),
        diagnosisStatus: JobStatus.PENDING,
        status: PlanStatus.DRAFT,
        confirmedAt: null,
        updatedAt: new Date()
      }
    });

    await tx.trackingPlanDiagnosis.deleteMany({
      where: { trackingPlanId: planId }
    });

    const eventNameToId = new Map<string, string>();
    for (const [index, event] of payload.events.entries()) {
      const created = await tx.trackingEvent.create({
        data: {
          trackingPlanId: planId,
          categoryId: event.categoryId,
          eventName: event.eventName,
          displayName: event.displayName ?? null,
          triggerDescription: event.triggerDescription ?? null,
          businessGoal: event.businessGoal ?? null,
          notes: event.notes ?? null,
          sourceLabel: event.sourceLabel ?? "AI_GENERATED",
          createdAt: new Date(Date.now() + index),
          properties: {
            create: event.properties.map((property, propertyIndex) => ({
              name: property.name,
              type: property.type,
              isRequired: property.isRequired,
              sampleValue: property.sampleValue ?? null,
              description: property.description ?? null,
              sortOrder: propertyIndex + 1
            }))
          }
        }
      });
      eventNameToId.set(created.eventName, created.id);
    }

    if (payload.globalProperties.length) {
      await tx.trackingGlobalProperty.createMany({
        data: payload.globalProperties.map((property, index) => ({
          trackingPlanId: planId,
          name: property.name,
          type: property.type,
          isRequired: property.isRequired,
          sampleValue: property.sampleValue ?? null,
          description: property.description ?? null,
          category: property.category ?? null,
          sortOrder: index + 1
        }))
      });
    }

    const dictionaryNameToId = new Map<string, string>();
    for (const [index, dictionary] of payload.dictionaries.entries()) {
      const created = await tx.trackingDictionary.create({
        data: {
          trackingPlanId: planId,
          name: dictionary.name,
          configName: dictionary.configName,
          relatedModule: dictionary.relatedModule,
          paramNames: dictionary.paramNames,
          purpose: dictionary.purpose,
          handoffRule: dictionary.handoffRule,
          sourceType: dictionary.sourceType,
          sortOrder: index + 1
        }
      });
      dictionaryNameToId.set(created.name, created.id);
    }

    for (const mapping of payload.dictionaryMappings) {
      const dictionaryId = dictionaryNameToId.get(mapping.dictionaryName);
      if (!dictionaryId) {
        continue;
      }
      await tx.trackingDictionaryMapping.create({
        data: {
          trackingPlanId: planId,
          trackingEventId: mapping.eventName ? (eventNameToId.get(mapping.eventName) ?? null) : null,
          propertyName: mapping.propertyName,
          dictionaryId,
          isRequiredMapping: mapping.isRequiredMapping,
          mappingNote: mapping.mappingNote ?? null
        }
      });
    }

    const updated = await tx.trackingPlan.findUnique({
      where: { id: planId },
      include: {
        diagnosis: true,
        inputSources: {
          orderBy: { createdAt: "asc" }
        },
        events: {
          orderBy: { createdAt: "asc" },
          include: {
            category: true,
            properties: {
              orderBy: { sortOrder: "asc" }
            }
          }
        },
        globalProperties: {
          orderBy: { sortOrder: "asc" }
        },
        dictionaries: {
          orderBy: { sortOrder: "asc" }
        },
        dictionaryMappings: {
          include: {
            trackingEvent: {
              select: { eventName: true }
            },
            dictionary: {
              select: {
                id: true,
                name: true,
                configName: true
              }
            }
          }
        }
      }
    });

    return updated ? mapDbPlan(updated) : null;
  });
}

export async function exportPlanDocument(
  planId: string,
  format: "json" | "xlsx",
  variant: "planner" | "developer" = "developer"
) {
  const plan = await getPlanById(planId);

  if (!plan) {
    throw new Error("方案不存在。");
  }

  const events = plan.events.map((event) => ({
    eventName: event.eventName,
    displayName: event.displayName ?? "",
    category: event.category?.name ?? "",
    triggerDescription: event.triggerDescription ?? "",
    businessGoal: event.businessGoal ?? "",
    notes: event.notes ?? "",
    sourceLabel: event.sourceLabel ?? "",
    properties: event.properties.map((property) => ({
      name: property.name,
      type: property.type,
      isRequired: property.isRequired,
      sampleValue: property.sampleValue ?? "",
      description: property.description ?? ""
    }))
  }));
  const normalizedMappings = (plan.dictionaryMappings ?? []).map((mapping: any) => ({
    eventName: ("eventName" in mapping ? mapping.eventName : mapping.trackingEvent?.eventName) ?? null,
    propertyName: mapping.propertyName,
    dictionary: mapping.dictionary ?? null,
    isRequiredMapping: mapping.isRequiredMapping,
    mappingNote: mapping.mappingNote ?? null
  }));

  const payload = {
    plan: {
      id: plan.id,
      name: plan.name,
      version: plan.version,
      status: plan.status,
      summary: plan.summary ?? "",
      exportVariant: variant,
      exportedAt: new Date().toISOString()
    },
    globalProperties: plan.globalProperties ?? [],
    events,
    dictionaries: (plan.dictionaries ?? []).map((dictionary) => ({
      name: dictionary.name,
      configName: dictionary.configName,
      relatedModule: dictionary.relatedModule,
      paramNames: dictionary.paramNames,
      purpose: dictionary.purpose,
      handoffRule: dictionary.handoffRule,
      sourceType: dictionary.sourceType
    })),
    dictionaryMappings: normalizedMappings.map((mapping) => ({
      eventName: mapping.eventName ?? "",
      propertyName: mapping.propertyName,
      dictionaryName: mapping.dictionary?.name ?? "",
      isRequiredMapping: mapping.isRequiredMapping,
      mappingNote: mapping.mappingNote ?? ""
    }))
  };

  if (format === "json") {
    return {
      fileName: `${plan.name}-${plan.version}-${variant}.json`,
      contentType: "application/json; charset=utf-8",
      body: Buffer.from(JSON.stringify(payload, null, 2), "utf8")
    };
  }

  const workbook = XLSX.utils.book_new();
  const globalRows = (plan.globalProperties ?? []).map((property) => ({
    字段名: property.name,
    类型: property.type,
    是否必填: property.isRequired ? "必填" : "可选",
    示例值: property.sampleValue ?? "",
    分类: property.category ?? "",
    字段说明: property.description ?? ""
  }));
  const eventRows = events.map((event) => ({
    事件名: event.eventName,
    显示名称: event.displayName,
    事件分类: event.category,
    触发说明: event.triggerDescription,
    业务目标: event.businessGoal,
    备注: event.notes,
    来源: event.sourceLabel
  }));
  const propertyRows = events.flatMap((event) =>
    event.properties.map((property) => ({
      事件名: event.eventName,
      字段名: property.name,
      类型: property.type,
      是否必填: property.isRequired ? "必填" : "可选",
      示例值: property.sampleValue,
      字段说明: property.description,
      字典映射:
        normalizedMappings
          .find((mapping) => mapping.eventName === event.eventName && mapping.propertyName === property.name)
          ?.dictionary?.name ?? ""
    }))
  );
  const deliveryRows = [
    ...(plan.globalProperties ?? []).map((property) => ({
      模块: "公共属性",
      事件名: "*",
      参数名: property.name,
      类型: property.type,
      是否必填: property.isRequired ? "必填" : "可选",
      示例值: property.sampleValue ?? "",
      是否公共属性: "是",
      是否字典字段: "否",
      对应字典表: ""
    })),
    ...events.flatMap((event) =>
      event.properties.map((property) => {
        const mapping = normalizedMappings.find(
          (item) => item.eventName === event.eventName && item.propertyName === property.name
        );
        return {
          模块: event.category,
          事件名: event.eventName,
          参数名: property.name,
          类型: property.type,
          是否必填: property.isRequired ? "必填" : "可选",
          示例值: property.sampleValue ?? "",
          是否公共属性: "否",
          是否字典字段: mapping ? "是" : "否",
          对应字典表: mapping?.dictionary?.name ?? ""
        };
      })
    )
  ];
  const dictionaryRows = (plan.dictionaries ?? []).map((dictionary) => ({
    字典名: dictionary.name,
    配置名: dictionary.configName,
    关联模块: dictionary.relatedModule,
    关联参数: dictionary.paramNames.join(", "),
    用途说明: dictionary.purpose,
    规范约定: dictionary.handoffRule,
    来源: dictionary.sourceType
  }));
  const mappingRows = normalizedMappings.map((mapping) => ({
    事件名: mapping.eventName ?? "全局",
    参数名: mapping.propertyName,
    字典名: mapping.dictionary?.name ?? "",
    是否强制查表: mapping.isRequiredMapping ? "是" : "否",
    映射说明: mapping.mappingNote ?? ""
  }));

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        方案名称: plan.name,
        方案版本: plan.version,
        状态: plan.status,
        导出视图: variant === "planner" ? "策划版" : "研发版",
        方案摘要: plan.summary ?? "",
        导出时间: new Date().toLocaleString("zh-CN")
      }
    ]),
    "Plan"
  );

  if (variant === "planner") {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(globalRows), "GlobalProperties");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(eventRows), "Events");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dictionaryRows), "Dictionaries");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(mappingRows), "Mappings");
  } else {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(globalRows), "GlobalProperties");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(deliveryRows), "EventTable");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(eventRows), "Events");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(propertyRows), "EventFields");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dictionaryRows), "Dictionaries");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(mappingRows), "Mappings");
  }

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  return {
    fileName: `${plan.name}-${plan.version}-${variant}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  };
}
