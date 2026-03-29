import { NextRequest, NextResponse } from "next/server";
import { hasUser, getPasswordHash, createUser } from "@/server/db";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  buildSessionCookie,
  buildLogoutCookie,
  checkRateLimit,
} from "@/server/auth";

// POST /api/auth — login or setup
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  let body: { action?: string; password?: string; confirmPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { action, password, confirmPassword } = body;

  // ── Setup: create initial user ──
  if (action === "setup") {
    if (hasUser()) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    const hash = await hashPassword(password);
    createUser(hash);

    const token = createSessionToken(1);
    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", buildSessionCookie(token));
    return response;
  }

  // ── Login ──
  if (action === "login") {
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again in 1 minute." },
        { status: 429 },
      );
    }

    const hash = getPasswordHash();
    if (!hash) {
      return NextResponse.json({ error: "No user configured" }, { status: 400 });
    }

    const valid = await verifyPassword(hash, password || "");
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = createSessionToken(1);
    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", buildSessionCookie(token));
    return response;
  }

  // ── Logout ──
  if (action === "logout") {
    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", buildLogoutCookie());
    return response;
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// GET /api/auth — check auth status
export async function GET(request: NextRequest) {
  const userExists = hasUser();
  return NextResponse.json({ userExists });
}
