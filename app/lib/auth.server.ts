import { createCookieSessionStorage, redirect } from "react-router";
import bcrypt from "bcryptjs";
import { prisma } from "./db.server.js";

// ─── Session Storage ─────────────────────────────────────
// Cookie-based session signed with SESSION_SECRET.

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    secrets: [process.env.SESSION_SECRET!],
  },
});

// ─── Helper: get session from request ────────────────────

function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

// ─── Signup ──────────────────────────────────────────────

export async function signup(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, passwordHash },
  });

  return user;
}

// ─── Login ───────────────────────────────────────────────

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;

  return user;
}

// ─── Create User Session ─────────────────────────────────

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

// ─── Get Logged-In User ID ──────────────────────────────

export async function getUserId(request: Request) {
  const session = await getSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  return userId;
}

// ─── Require User (Protected Routes) ────────────────────

export async function requireUser(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    throw redirect("/login");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw redirect("/login");
  }

  return user;
}

// ─── Logout ──────────────────────────────────────────────

export async function logout(request: Request) {
  const session = await getSession(request);

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
