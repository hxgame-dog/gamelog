import crypto from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getPrismaClient, hasDatabaseUrl } from "./prisma";
import { getMemoryStore } from "./store";

const SESSION_COOKIE = "telemetry_studio_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) {
    return false;
  }

  const [salt, hash] = stored.split(":");

  if (!salt || !hash) {
    return false;
  }

  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashToken(sessionToken);
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    const session = store.sessions.find((item) => item.tokenHash === tokenHash && item.expiresAt > Date.now());
    if (!session) {
      return null;
    }

    return store.users.find((user) => user.id === session.userId) ?? null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function isAdminUser(userId: string) {
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    return store.users[0]?.id === userId;
  }

  const firstUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  return firstUser?.id === userId;
}

export async function requireAdmin() {
  const user = await requireUser();
  const isAdmin = await isAdminUser(user.id);

  if (!isAdmin) {
    redirect("/");
  }

  return user;
}

export async function loginWithPassword({
  email,
  password,
  name
}: {
  email: string;
  password: string;
  name?: string | null;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const prisma = getPrismaClient();

  if (!prisma || !hasDatabaseUrl()) {
    const store = getMemoryStore();
    let user = store.users.find((item) => item.email === normalizedEmail) ?? null;

    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        name: name?.trim() || normalizedEmail.split("@")[0] || "Owner",
        passwordHash: hashPassword(password)
      };
      store.users.push(user);
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw new Error("邮箱或密码不正确。");
    }

    const token = generateSessionToken();
    store.sessions.push({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: Date.now() + SESSION_DURATION_MS
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000
    });

    return user;
  }

  const userCount = await prisma.user.count();
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user && userCount === 0) {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || normalizedEmail.split("@")[0] || "Owner",
        passwordHash: hashPassword(password)
      }
    });
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("邮箱或密码不正确。");
  }

  const token = generateSessionToken();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000
  });

  return user;
}

export async function logoutCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionToken) {
    const tokenHash = hashToken(sessionToken);
    const prisma = getPrismaClient();

    if (!prisma || !hasDatabaseUrl()) {
      const store = getMemoryStore();
      store.sessions = store.sessions.filter((item) => item.tokenHash !== tokenHash);
    } else {
      await prisma.session.deleteMany({
        where: { tokenHash }
      });
    }
  }

  cookieStore.delete(SESSION_COOKIE);
}
