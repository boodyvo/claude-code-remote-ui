import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, createWsToken } from "@/server/auth";

// GET /api/auth/ws-token — returns a short-lived token for WebSocket auth
// The session cookie is HttpOnly so the browser can't read it directly.
// This endpoint reads the cookie server-side and issues a WS-specific token.
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get("session");
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = verifySessionToken(sessionCookie.value);
  if (!payload) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Issue a short-lived (60s) token for WebSocket upgrade only
  const wsToken = createWsToken(payload.userId);
  return NextResponse.json({ token: wsToken });
}
