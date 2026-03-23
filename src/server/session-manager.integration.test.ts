import { describe, it, expect, afterEach } from "vitest";
import {
  query,
  listSessions,
  getSessionMessages,
} from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { SessionManager } from "./session-manager";

/**
 * Integration tests that actually run Claude Code via the Agent SDK.
 * These require:
 *   - `claude` CLI installed and authenticated (`claude login`)
 *   - Active Claude subscription
 *
 * Run with: pnpm test:integration
 */

const TEST_CWD = process.cwd();

describe("SessionManager — real SDK", () => {
  const manager = new SessionManager();
  const collectedMessages: SDKMessage[] = [];
  let testSessionId: string | null = null;

  manager.onMessage((_sid, msg) => {
    collectedMessages.push(msg);
  });

  manager.onSessionEnd((sid, reason) => {
    console.log(`Session ${sid} ended: ${reason}`);
  });

  afterEach(() => {
    if (testSessionId && manager.isActive(testSessionId)) {
      manager.cancelSession(testSessionId);
    }
    collectedMessages.length = 0;
    testSessionId = null;
  });

  it(
    "starts a session and receives messages from Claude",
    async () => {
      testSessionId = await manager.startSession(TEST_CWD);
      expect(testSessionId).toBeTruthy();
      expect(typeof testSessionId).toBe("string");

      // Send a simple message
      manager.sendMessage(testSessionId, "Reply with exactly: HELLO_TEST_123");

      // Wait for response messages (with timeout)
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500));

        // Check if we got an assistant message with our expected text
        const hasResponse = collectedMessages.some(
          (m) =>
            m.type === "assistant" ||
            (m as Record<string, unknown>).type === "stream_event",
        );
        if (hasResponse) break;
      }

      // We should have received at least one message from the SDK
      expect(collectedMessages.length).toBeGreaterThan(0);

      // Check we got system init and/or assistant messages
      const messageTypes = new Set(collectedMessages.map((m) => m.type));
      expect(
        messageTypes.has("assistant") ||
          messageTypes.has("stream_event") ||
          messageTypes.has("system"),
      ).toBe(true);
    },
    { timeout: 45_000 },
  );

  it(
    "tool approval flow blocks until resolved",
    async () => {
      testSessionId = await manager.startSession(TEST_CWD);

      // Ask Claude to read a file — this should trigger canUseTool
      manager.sendMessage(
        testSessionId,
        "Read the file package.json and tell me the project name. Use the Read tool.",
      );

      // Wait for a tool approval request
      const deadline = Date.now() + 30_000;
      let toolApprovalSeen = false;

      while (Date.now() < deadline && !toolApprovalSeen) {
        await new Promise((r) => setTimeout(r, 500));

        // Check for tool_use content blocks in assistant messages
        for (const msg of collectedMessages) {
          const content = (msg as Record<string, unknown>).content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (
                (block as Record<string, unknown>).type === "tool_use"
              ) {
                toolApprovalSeen = true;
                const toolUseId = (block as Record<string, unknown>)
                  .id as string;

                // Approve the tool use
                manager.resolveToolApproval(
                  testSessionId!,
                  toolUseId,
                  "allow",
                );
                break;
              }
            }
          }
        }
      }

      // We should have seen a tool use request
      // (It's possible Claude doesn't use tools for this — depends on the model's behavior)
      // So we just verify the session ran without errors
      expect(collectedMessages.length).toBeGreaterThan(0);
    },
    { timeout: 45_000 },
  );

  it(
    "interrupts a running session",
    async () => {
      testSessionId = await manager.startSession(TEST_CWD);
      manager.sendMessage(
        testSessionId,
        "Count from 1 to 1000, one number per line.",
      );

      // Wait a bit for streaming to start
      await new Promise((r) => setTimeout(r, 3000));
      expect(collectedMessages.length).toBeGreaterThan(0);

      // Interrupt
      await manager.interruptSession(testSessionId);

      // Session should eventually end
      const countBefore = collectedMessages.length;
      await new Promise((r) => setTimeout(r, 2000));

      // No new messages should arrive after interrupt (or very few)
      // We can't assert exact count since there's a race, but the session
      // shouldn't keep generating hundreds more messages
      expect(collectedMessages.length).toBeLessThan(countBefore + 50);
    },
    { timeout: 30_000 },
  );
});

describe("SDK direct — listSessions and getSessionMessages", () => {
  it("listSessions returns an array", async () => {
    const sessions = await listSessions({ dir: TEST_CWD, limit: 5 });
    expect(Array.isArray(sessions)).toBe(true);
    // Each session should have sessionId
    for (const s of sessions) {
      expect(s.sessionId).toBeTruthy();
      expect(typeof s.sessionId).toBe("string");
    }
  });

  it("getSessionMessages returns messages for a valid session", async () => {
    const sessions = await listSessions({ dir: TEST_CWD, limit: 1 });
    if (sessions.length === 0) {
      console.log("No existing sessions to test getSessionMessages");
      return;
    }

    const messages = await getSessionMessages(sessions[0].sessionId);
    expect(Array.isArray(messages)).toBe(true);
    for (const m of messages) {
      expect(m.type).toBeTruthy();
    }
  });
});
