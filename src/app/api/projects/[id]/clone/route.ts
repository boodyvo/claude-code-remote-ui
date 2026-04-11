import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/server/auth";
import db from "@/server/db";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const PROJECTS_BASE_DIR =
  process.env.PROJECTS_BASE_DIR ||
  (process.env.NODE_ENV === "production" ? "/app/projects" : "./data/projects");

function requireAuth(request: NextRequest) {
  const sessionCookie = request.cookies.get("session");
  if (!sessionCookie?.value || !verifySessionToken(sessionCookie.value)) {
    return null;
  }
  return true;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionCookie = request.cookies.get("session");
  if (!sessionCookie?.value || !verifySessionToken(sessionCookie.value)) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | { id: number; name: string; slug: string; repo_url: string | null }
    | undefined;

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.repo_url) {
    return NextResponse.json({ error: "Project has no repo URL" }, { status: 400 });
  }

  const projectDir = join(PROJECTS_BASE_DIR, project.slug);
  const isCloned = existsSync(join(projectDir, ".git"));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (line: string) => {
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      };

      if (!isCloned) {
        mkdirSync(PROJECTS_BASE_DIR, { recursive: true });
      }

      const args = isCloned
        ? ["-C", projectDir, "pull"]
        : ["clone", project.repo_url!, projectDir];

      send(isCloned ? "Pulling latest changes..." : `Cloning ${project.repo_url}...`);

      const proc = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });

      proc.stdout.on("data", (chunk: Buffer) => {
        for (const line of chunk.toString().split("\n")) {
          if (line.trim()) send(line);
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        for (const line of chunk.toString().split("\n")) {
          if (line.trim()) send(line);
        }
      });

      proc.on("close", (code) => {
        if (code === 0) {
          send("done");
        } else {
          send(`error:Git exited with code ${code}`);
        }
        controller.close();
      });

      proc.on("error", (err) => {
        send(`error:${err.message}`);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
