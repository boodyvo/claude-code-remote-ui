#!/usr/bin/env node

/**
 * PreToolUse hook: uses Claude Haiku to evaluate tool call safety.
 *
 * - Instantly allows read-only tools (no LLM call).
 * - For Bash/Edit/Write/MCP tools, asks Haiku to classify: allow/deny/ask.
 * - Caches decisions in a local JSON file so repeated patterns are instant.
 * - Falls back to "ask" (user review) if anything goes wrong.
 *
 * Requires: ANTHROPIC_API_KEY env var.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ── Config ──
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 256;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_DIR = join(homedir(), ".claude");
const CACHE_FILE = join(CACHE_DIR, "hook-cache.json");

// Tools that are always safe — no LLM call needed
const ALWAYS_ALLOW = new Set([
  "Read", "Edit", "Write", "Glob", "Grep", "WebSearch", "WebFetch",
  "Agent", "ToolSearch", "Skill", "LSP",
  "TaskCreate", "TaskGet", "TaskList", "TaskOutput", "TaskUpdate", "TaskStop",
  "NotebookEdit", "EnterPlanMode", "ExitPlanMode", "AskUserQuestion",
  "EnterWorktree",
]);

const SYSTEM_PROMPT = `You are a security gate for a coding assistant. You evaluate tool calls and decide if they are safe to execute automatically.

You MUST respond with EXACTLY one JSON object — no markdown, no explanation, no extra text:
{"decision": "allow|deny|ask", "reason": "brief reason"}

Decision criteria:

ALLOW — the operation is clearly safe:
- Reading files, searching, listing directories
- Creating/editing source code, config, docs, tests, markdown, JSON, YAML, CSS, HTML
- Running build tools: npm, pnpm, yarn, node, npx, bun, deno, cargo, go, make, python, pip, tsc, next, turbo
- Running test tools: vitest, jest, playwright, cypress, mocha
- Running linters/formatters: eslint, prettier, biome, oxlint
- Git operations: status, log, diff, add, commit, branch, checkout, fetch, pull, push, stash, rebase, merge, tag, remote, clone
- GitHub CLI: gh pr, gh issue, gh repo, gh api, gh run
- Creating directories, copying/moving files, touching files
- Dev servers (next dev, vite, nodemon)
- curl/wget to fetch data (NOT piped to shell)
- chmod with reasonable modes (+x, 644, 755)
- tar, zip, unzip, gzip operations
- Removing specific files (rm file.txt, rm -r ./test-output, rm -rf node_modules, rm -rf .next, rm -rf dist, rm -rf build)
- docker/docker-compose commands
- Environment inspection: env, printenv, echo, which, whereis, uname, whoami, hostname, date

DENY — the operation is destructive or dangerous:
- rm -rf with broad/root paths (/, /home, ~, ., ..)
- sudo anything
- curl/wget piped to bash/sh/zsh (remote code execution)
- chmod 777/000/666 (insecure permissions)
- dd with /dev sources
- mkfs, fdisk, format (disk destruction)
- Writing to .env files containing secrets, .pem, .key, private key files
- Writing directly into .git/ internals (objects, refs, HEAD)
- Fork bombs, infinite loops
- Killing critical system processes (kill -9 1, killall)
- Overwriting system files (/etc/*, /usr/*, /bin/*)

ASK — not sure, let the user decide:
- Destructive git: push --force, reset --hard, clean -f, branch -D
- Removing directories that might contain important data
- Running unfamiliar scripts or binaries
- Network operations to unusual hosts/ports
- MCP tool calls (external integrations)
- Any operation where intent is ambiguous

Context: This is a Next.js/TypeScript web application project. Common safe operations include pnpm/npm commands, editing .ts/.tsx/.css/.json files, running vitest/jest/playwright, and git operations.`;

// ── Cache ──
function loadCache() {
  try {
    if (existsSync(CACHE_FILE)) {
      const data = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
      const now = Date.now();
      // Prune expired entries
      for (const key of Object.keys(data)) {
        if (now - data[key].ts > CACHE_TTL_MS) delete data[key];
      }
      return data;
    }
  } catch {
    // Corrupted cache — start fresh
  }
  return {};
}

function saveCache(cache) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache), "utf-8");
  } catch {
    // Non-critical — ignore cache write failures
  }
}

function makeCacheKey(toolName, toolInput) {
  let raw;
  if (toolName === "Bash") {
    raw = `Bash:${(toolInput.command || "").trim()}`;
  } else if (toolName === "Edit" || toolName === "Write") {
    // Cache by file path only — content varies too much
    raw = `${toolName}:${toolInput.file_path || ""}`;
  } else {
    raw = `${toolName}:${JSON.stringify(toolInput)}`;
  }
  return createHash("sha256").update(raw).digest("hex");
}

// ── Haiku evaluation ──
async function evaluateWithHaiku(toolName, toolInput) {
  try {
    const client = new Anthropic({ timeout: 4000 });

    let inputStr = JSON.stringify(toolInput, null, 2);
    if (inputStr.length > 2000) {
      inputStr = inputStr.slice(0, 2000) + "\n... (truncated)";
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Tool: ${toolName}\nInput:\n${inputStr}` },
      ],
    });

    let text = response.content[0].text.trim();

    // Strip markdown code blocks if present
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const result = JSON.parse(text);
    let decision = (result.decision || "ask").toLowerCase();
    const reason = result.reason || "No reason provided";

    if (!["allow", "deny", "ask"].includes(decision)) decision = "ask";

    return { decision, reason };
  } catch (err) {
    return { decision: "ask", reason: `Evaluation failed (${err.message}), asking user` };
  }
}

// ── Output ──
function outputDecision(decision, reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(output));
}

// ── Main ──
async function main() {
  let hookInput;
  try {
    const raw = readFileSync("/dev/stdin", "utf-8");
    hookInput = JSON.parse(raw);
  } catch {
    process.exit(0); // Can't parse → allow (don't block on hook errors)
  }

  const toolName = hookInput.tool_name || "";
  const toolInput = hookInput.tool_input || {};

  // Fast path: always-safe tools
  if (ALWAYS_ALLOW.has(toolName)) {
    process.exit(0); // exit 0 with no output = allow
  }

  // Check cache
  const cache = loadCache();
  const cacheKey = makeCacheKey(toolName, toolInput);

  if (cache[cacheKey]) {
    const { decision, reason } = cache[cacheKey];
    outputDecision(decision, `(cached) ${reason}`);
    process.exit(0);
  }

  // Call Haiku
  const { decision, reason } = await evaluateWithHaiku(toolName, toolInput);

  // Cache (don't cache "ask" — those are contextual)
  if (decision !== "ask") {
    cache[cacheKey] = { decision, reason, ts: Date.now() };
    saveCache(cache);
  }

  outputDecision(decision, reason);
  process.exit(0);
}

main();
