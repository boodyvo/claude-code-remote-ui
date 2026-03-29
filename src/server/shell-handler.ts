import * as pty from "node-pty";
import type { WebSocket } from "ws";

// Match URLs but stop at characters that signal end-of-URL (uppercase letter
// after a non-percent-encoded segment typically means trailing prose got joined)
const URL_REGEX = /https?:\/\/[^\s\])"'>]+/g;
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;
const AUTH_TRIGGER_KEYWORDS = [
  "browser didn't open",
  "open this url",
  "continue in your browser",
  "open_url:",
  "authorize",
  "press enter to open",
];

const LOGIN_SUCCESS_KEYWORDS = [
  "successfully authenticated",
  "logged in",
  "authentication successful",
  "successfully logged in",
  "login successful",
];

interface ShellSession {
  ptyProcess: pty.IPty;
  ws: WebSocket;
  announcedUrls: Set<string>;
}

const shellSessions = new Map<WebSocket, ShellSession>();

export function handleShellMessage(
  ws: WebSocket,
  data: string,
): void {
  let msg: { type: string; command?: string; data?: string; cols?: number; rows?: number };
  try {
    msg = JSON.parse(data);
  } catch {
    return;
  }

  switch (msg.type) {
    case "init":
      // SECURITY: Only allow "claude /login" — ignore client-supplied command
      startShell(ws, msg.cols || 80, msg.rows || 24);
      break;
    case "input":
      writeToShell(ws, msg.data || "");
      break;
    case "resize":
      resizeShell(ws, msg.cols || 80, msg.rows || 24);
      break;
  }
}

function startShell(ws: WebSocket, cols: number, rows: number): void {
  // Kill existing session
  cleanupShell(ws);

  // SECURITY: Hardcoded command — never accept from client
  // --dangerously-skip-permissions prevents permission prompts during login
  const ptyProcess = pty.spawn("claude", ["--dangerously-skip-permissions", "/login"], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: process.env.CLAUDE_CWD || process.cwd(),
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      FORCE_COLOR: "3",
    } as Record<string, string>,
  });

  const session: ShellSession = {
    ptyProcess,
    ws,
    announcedUrls: new Set(),
  };

  shellSessions.set(ws, session);

  let urlBuffer = "";

  let loginCompleted = false;

  ptyProcess.onData((data: string) => {
    // Send terminal output to client
    sendShellMessage(ws, { type: "output", data });

    // Don't process if login already completed
    if (loginCompleted) return;

    // Detect auth URLs in output
    urlBuffer += data;
    // Keep buffer manageable
    if (urlBuffer.length > 4096) {
      urlBuffer = urlBuffer.slice(-2048);
    }

    const clean = urlBuffer.replace(ANSI_REGEX, "");
    const lowerClean = clean.toLowerCase();

    // Check for login success — kill PTY to prevent interactive mode loop
    if (LOGIN_SUCCESS_KEYWORDS.some((kw) => lowerClean.includes(kw))) {
      loginCompleted = true;
      // Give a moment for remaining output, then kill the process
      setTimeout(() => {
        sendShellMessage(ws, { type: "exit", exitCode: 0 });
        try { ptyProcess.kill(); } catch { /* already dead */ }
        shellSessions.delete(ws);
      }, 1500);
      return;
    }

    const hasKeyword = AUTH_TRIGGER_KEYWORDS.some((kw) => lowerClean.includes(kw));

    if (hasKeyword) {
      // Extract URLs that may be wrapped across multiple terminal lines.
      // Strategy: split into lines, find URL starts, then greedily consume
      // continuation lines that look like URL fragments (start with URL-safe chars).
      const lines = clean.split(/[\r\n]+/).filter(l => l.trim());
      const extractedUrls: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/https?:\/\/[^\s\])"'>]+/);
        if (match) {
          let url = match[0];
          // Consume continuation lines that start with URL-safe characters
          // (no leading space, letter-word, or prompt characters)
          for (let j = i + 1; j < lines.length; j++) {
            const trimmed = lines[j].trim();
            // Stop if line looks like prose (starts with a word) or a prompt
            if (/^[A-Z][a-z]/.test(trimmed) || /^[>$#]/.test(trimmed) || trimmed === "") break;
            url += trimmed.replace(/[^\w%&=\-_.~+\/:?#@!$'()*,;[\]]/g, "");
            i = j;
          }
          extractedUrls.push(url);
        }
      }
      for (const url of extractedUrls) {
        if (!session.announcedUrls.has(url)) {
          session.announcedUrls.add(url);
          sendShellMessage(ws, { type: "auth_url", url });
        }
      }
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (!loginCompleted) {
      sendShellMessage(ws, { type: "exit", exitCode });
    }
    shellSessions.delete(ws);
  });
}

function writeToShell(ws: WebSocket, data: string): void {
  const session = shellSessions.get(ws);
  if (session) {
    session.ptyProcess.write(data);
  }
}

function resizeShell(ws: WebSocket, cols: number, rows: number): void {
  const session = shellSessions.get(ws);
  if (session) {
    session.ptyProcess.resize(cols, rows);
  }
}

export function cleanupShell(ws: WebSocket): void {
  const session = shellSessions.get(ws);
  if (session) {
    try {
      session.ptyProcess.kill();
    } catch {
      // Already dead
    }
    shellSessions.delete(ws);
  }
}

function sendShellMessage(ws: WebSocket, msg: Record<string, unknown>): void {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}
