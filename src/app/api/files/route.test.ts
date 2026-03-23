import { describe, it, expect } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

function makeRequest(path?: string): NextRequest {
  const url = new URL("http://localhost:3000/api/files");
  if (path) url.searchParams.set("path", path);
  return new NextRequest(url);
}

describe("GET /api/files", () => {
  it("returns directory listing for root", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.items).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);

    // Should contain known files
    const names = data.items.map((i: { name: string }) => i.name);
    expect(names).toContain("package.json");
    expect(names).toContain("src");
  });

  it("returns items with correct shape", async () => {
    const res = await GET(makeRequest());
    const data = await res.json();

    for (const item of data.items) {
      expect(item.name).toBeTruthy();
      expect(["file", "directory"]).toContain(item.type);
      expect(typeof item.size).toBe("number");
    }
  });

  it("lists subdirectory contents", async () => {
    const res = await GET(makeRequest("src"));
    expect(res.status).toBe(200);

    const data = await res.json();
    const names = data.items.map((i: { name: string }) => i.name);
    expect(names).toContain("app");
    expect(names).toContain("lib");
  });

  it("blocks path traversal with ..", async () => {
    const res = await GET(makeRequest("../../etc"));
    expect(res.status).toBe(403);
  });

  it("blocks absolute path traversal", async () => {
    const res = await GET(makeRequest("/etc/passwd"));
    // This resolves to /etc/passwd which is outside workspace
    expect([403, 404]).toContain(res.status);
  });

  it("returns 404 for non-existent directory", async () => {
    const res = await GET(makeRequest("nonexistent_dir_xyz"));
    expect(res.status).toBe(404);
  });

  it("sorts directories before files", async () => {
    const res = await GET(makeRequest());
    const data = await res.json();

    const types = data.items.map((i: { type: string }) => i.type);
    const lastDirIndex = types.lastIndexOf("directory");
    const firstFileIndex = types.indexOf("file");

    if (lastDirIndex !== -1 && firstFileIndex !== -1) {
      expect(lastDirIndex).toBeLessThan(firstFileIndex);
    }
  });
});
