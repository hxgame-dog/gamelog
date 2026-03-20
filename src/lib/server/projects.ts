import crypto from "node:crypto";

import { CategoryType, InputSourceType, JobStatus, PlanStatus, ProjectRole } from "@prisma/client";
import { z } from "zod";

import { defaultProjectCategories, starterPlanTemplate } from "./project-templates";
import { getPrismaClient, hasDatabaseUrl } from "./prisma";
import { getMemoryStore } from "./store";

const projectSchema = z.object({
  name: z.string().min(2, "项目名称至少需要 2 个字符。"),
  description: z.string().optional().nullable(),
  platform: z.string().optional().nullable(),
  currentVersion: z.string().optional().nullable()
});

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function getProjectsForUser(userId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const memberProjectIds = new Set(
      store.memberships.filter((item) => item.userId === userId).map((item) => item.projectId)
    );

    return store.projects
      .filter((project) => memberProjectIds.has(project.id))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return prisma.project.findMany({
    where: {
      members: {
        some: {
          userId
        }
      }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getCategoriesForProject(projectId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    return store.categories
      .filter((category) => category.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return prisma.eventCategory.findMany({
    where: { projectId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function createProjectForUser(userId: string, input: unknown) {
  const payload = projectSchema.parse(input);
  const slugBase = slugify(payload.name);
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const slug = `${slugBase || "project"}-${store.projects.length + 1}`;
    const projectId = crypto.randomUUID();

    store.projects.push({
      id: projectId,
      name: payload.name,
      slug,
      description: payload.description ?? null,
      platform: payload.platform ?? null,
      currentVersion: payload.currentVersion ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    store.memberships.push({
      id: crypto.randomUUID(),
      projectId,
      userId,
      role: "OWNER",
      createdAt: Date.now()
    });

    for (const category of defaultProjectCategories) {
      store.categories.push({
        id: crypto.randomUUID(),
        projectId,
        name: category.name,
        type: category.type,
        color: category.color,
        sortOrder: category.sortOrder,
        description: category.description,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    await createStarterPlanInMemory(projectId);

    return store.projects.find((project) => project.id === projectId)!;
  }

  const existingSlugs = await prisma.project.findMany({
    where: { slug: { startsWith: slugBase || "project" } },
    select: { slug: true }
  });
  const suffix = existingSlugs.length ? `-${existingSlugs.length + 1}` : "";
  const slug = `${slugBase || "project"}${suffix}`;

  const project = await prisma.project.create({
    data: {
      name: payload.name,
      slug,
      description: payload.description ?? null,
      platform: payload.platform ?? null,
      currentVersion: payload.currentVersion ?? null,
      members: {
        create: {
          userId,
          role: ProjectRole.OWNER
        }
      },
      categories: {
        create: defaultProjectCategories.map((category) => ({
          name: category.name,
          type: category.type === "SYSTEM" ? CategoryType.SYSTEM : CategoryType.CUSTOM,
          color: category.color,
          sortOrder: category.sortOrder,
          description: category.description
        }))
      }
    }
  });

  await createStarterPlan(project.id);

  return project;
}

async function createStarterPlan(projectId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    await createStarterPlanInMemory(projectId);
    return;
  }

  const categories = await prisma.eventCategory.findMany({
    where: { projectId }
  });

  const categoryMap = new Map(categories.map((category) => [category.name, category.id]));

  await prisma.trackingPlan.create({
    data: {
      name: starterPlanTemplate.name,
      version: starterPlanTemplate.version,
      summary: starterPlanTemplate.summary,
      status: PlanStatus.DRAFT,
      diagnosisStatus: JobStatus.PENDING,
      projectId,
      inputSources: {
        create: {
          type: InputSourceType.TEXT,
          label: starterPlanTemplate.inputSource.label,
          content: starterPlanTemplate.inputSource.content
        }
      },
      events: {
        create: starterPlanTemplate.events.map((event) => ({
          eventName: event.eventName,
          displayName: event.displayName,
          triggerDescription: event.triggerDescription,
          businessGoal: event.businessGoal,
          notes: event.notes,
          sourceLabel: event.sourceLabel,
          categoryId: categoryMap.get(event.categoryName)!,
          properties: {
            create: event.properties.map((property, index) => ({
              name: property.name,
              type: property.type,
              isRequired: property.isRequired,
              sampleValue: property.sampleValue,
              description: property.description,
              sortOrder: index + 1
            }))
          }
        }))
      }
    }
  });
}

async function createStarterPlanInMemory(projectId: string) {
  const store = getMemoryStore();
  const planId = crypto.randomUUID();
  store.plans.push({
    id: planId,
    projectId,
    name: starterPlanTemplate.name,
    version: starterPlanTemplate.version,
    status: "DRAFT",
    summary: starterPlanTemplate.summary,
    diagnosisStatus: "PENDING",
    confirmedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  store.planInputSources.push({
    id: crypto.randomUUID(),
    trackingPlanId: planId,
    type: "TEXT",
    label: starterPlanTemplate.inputSource.label,
    content: starterPlanTemplate.inputSource.content,
    fileName: null,
    mimeType: null,
    createdAt: Date.now()
  });

  const categoryMap = new Map(
    store.categories.filter((category) => category.projectId === projectId).map((category) => [category.name, category.id])
  );

  for (const event of starterPlanTemplate.events) {
    const eventId = crypto.randomUUID();
    store.events.push({
      id: eventId,
      trackingPlanId: planId,
      categoryId: categoryMap.get(event.categoryName)!,
      eventName: event.eventName,
      displayName: event.displayName,
      triggerDescription: event.triggerDescription,
      businessGoal: event.businessGoal,
      notes: event.notes,
      sourceLabel: event.sourceLabel,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    event.properties.forEach((property, index) => {
      store.properties.push({
        id: crypto.randomUUID(),
        trackingEventId: eventId,
        name: property.name,
        type: property.type,
        isRequired: property.isRequired,
        sampleValue: property.sampleValue,
        description: property.description,
        sortOrder: index + 1
      });
    });
  }
}
