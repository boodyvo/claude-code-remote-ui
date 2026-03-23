import { NextRequest, NextResponse } from "next/server";
import { readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { verifySessionToken } from "@/server/auth";

const WORKSPACE_ROOT = process.env.CLAUDE_CWD || process.cwd();

export async function GET(request: NextRequest) {
  // Verify authentication
  const sessionCookie = request.cookies.get("session");
  if (!sessionCookie?.value || !verifySessionToken(sessionCookie.value)) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const requestedPath = request.nextUrl.searchParams.get("path") || ".";

  // Resolve and verify path is within workspace
  const resolved = resolve(WORKSPACE_ROOT, requestedPath);
  const rel = relative(WORKSPACE_ROOT, resolved);

  if (rel.startsWith("..") || resolve(resolved) !== resolved) {
    return NextResponse.json(
      { error: "Path traversal not allowed" },
      { status: 403 },
    );
  }

  try {
    const entries = readdirSync(resolved, { withFileTypes: true });
    const items = entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => {
        const fullPath = join(resolved, e.name);
        try {
          const stat = statSync(fullPath);
          return {
            name: e.name,
            type: e.isDirectory() ? "directory" : "file",
            size: stat.size,
            modified: stat.mtime.toISOString(),
          };
        } catch {
          return {
            name: e.name,
            type: e.isDirectory() ? "directory" : "file",
            size: 0,
            modified: null,
          };
        }
      })
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ path: rel || ".", items });
  } catch {
    return NextResponse.json(
      { error: "Directory not found" },
      { status: 404 },
    );
  }
}
