import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/server/auth";
import db from "@/server/db";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 50);
}

function requireAuth(request: NextRequest) {
  const sessionCookie = request.cookies.get("session");
  if (!sessionCookie?.value || !verifySessionToken(sessionCookie.value)) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  const projects = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  let body: { name?: string; repo_url?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, repo_url, description } = body;
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const slug = toSlug(name.trim());
  if (!slug) {
    return NextResponse.json({ error: "Name produces an empty slug" }, { status: 400 });
  }

  try {
    const result = db
      .prepare(
        "INSERT INTO projects (name, slug, repo_url, description) VALUES (?, ?, ?, ?)"
      )
      .run(name.trim(), slug, repo_url || null, description || null);
    const project = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(result.lastInsertRowid);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE")) {
      return NextResponse.json({ error: "A project with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
