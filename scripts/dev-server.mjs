import { build } from "esbuild";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outfile = resolve(root, ".next/dev-server.mjs");

// Bundle server.ts (same as production but for dev)
await build({
  entryPoints: [resolve(root, "server.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile,
  external: [
    "next",
    "better-sqlite3",
    "argon2",
    "@anthropic-ai/claude-agent-sdk",
    "ws",
  ],
  packages: "external",
});

console.log("> Dev server compiled");

// Load .env.local so the bundled server has the same env vars as Next.js
const envFile = resolve(root, ".env.local");
const envVars = {};
try {
  const content = readFileSync(envFile, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    envVars[key] = value;
  }
} catch {
  // No .env.local — that's fine
}

// Run the bundled server
// Remove ANTHROPIC_API_KEY so the SDK uses Claude Code subscription (OAuth) auth
// instead of a pay-per-use API key
const { ANTHROPIC_API_KEY: _, ...cleanEnv } = process.env;
const child = spawn("node", [outfile], {
  stdio: "inherit",
  cwd: root,
  env: { ...cleanEnv, ...envVars, NODE_ENV: "development" },
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
