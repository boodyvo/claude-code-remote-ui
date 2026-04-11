import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/server/auth";
import db from "@/server/db";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const PROJECTS_BASE_DIR =
  process.env.PROJECTS_BASE_DIR ||
  (process.env.NODE_ENV === "production" ? "/app/projects" : "./data/projects");

function requireAuth(request: NextRequest) {
  const sessionCookie = request.cookies.get("session");
  if (!sessionCookie?.value || !verifySessionToken(sessionCookie.value)) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | { id: number; name: string; slug: string; repo_url: string | null; description: string | null }
    | undefined;
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: { name?: string; repo_url?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name !== undefined ? body.name : project.name;
  const repo_url = body.repo_url !== undefined ? body.repo_url : project.repo_url;
  const description = body.description !== undefined ? body.description : project.description;

  try {
    db.prepare("UPDATE projects SET name = ?, repo_url = ?, description = ? WHERE id = ?").run(
      name,
      repo_url || null,
      description || null,
      id
    );
    const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    return NextResponse.json({ project: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE")) {
      return NextResponse.json({ error: "A project with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | { id: number; slug: string }
    | undefined;
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectDir = join(PROJECTS_BASE_DIR, project.slug);
  if (existsSync(projectDir)) {
    try {
      rmSync(projectDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }

  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
