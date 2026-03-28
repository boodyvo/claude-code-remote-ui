import * as argon2 from "argon2";
import jwt from "jsonwebtoken";

const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
const WS_TOKEN_MAX_AGE = 60; // 60 seconds — only used during WS upgrade

if (!SESSION_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET environment variable is required in production. " +
      "Generate one with: openssl rand -hex 32",
    );
  }
  console.warn(
    "⚠️  SESSION_SECRET not set — using insecure default. " +
    "This is only acceptable for local development.",
  );
}

const SECRET = SESSION_SECRET || "dev-secret-DO-NOT-USE-IN-PRODUCTION";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function createSessionToken(userId: number): string {
  return jwt.sign({ userId }, SECRET, { expiresIn: SESSION_MAX_AGE });
}

/** Create a short-lived token for WebSocket upgrade (60s expiry) */
export function createWsToken(userId: number): string {
  return jwt.sign({ userId, purpose: "ws" }, SECRET, { expiresIn: WS_TOKEN_MAX_AGE });
}

export function verifySessionToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, SECRET) as { userId: number };
  } catch {
    return null;
  }
}

/** Verify a short-lived WS token — requires purpose: "ws" */
export function verifyWsToken(token: string): { userId: number } | null {
  try {
    const payload = jwt.verify(token, SECRET) as { userId: number; purpose?: string };
    if (payload.purpose !== "ws") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

const isProduction = process.env.NODE_ENV === "production";

export function buildSessionCookie(token: string): string {
  const secure = isProduction ? "; Secure" : "";
  return `session=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

export function buildLogoutCookie(): string {
  const secure = isProduction ? "; Secure" : "";
  return `session=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
}

// ── Rate Limiting ──

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 5) {
    return false;
  }

  entry.count++;
  return true;
}
