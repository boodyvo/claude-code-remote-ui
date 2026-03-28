import * as pty from "node-pty";
import type { WebSocket } from "ws";

const URL_REGEX = /https?:\/\/[^\s\])"'>]+/g;
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;
const AUTH_TRIGGER_KEYWORDS = [
  "browser didn't open",
  "open this url",
  "continue in your browser",
  "open_url:",
  "authorize",
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
  const ptyProcess = pty.spawn("claude", ["/login"], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: process.env.CLAUDE_CWD || process.cwd(),
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    } as Record<string, string>,
  });

  const session: ShellSession = {
    ptyProcess,
    ws,
    announcedUrls: new Set(),
  };

  shellSessions.set(ws, session);

  let urlBuffer = "";

  ptyProcess.onData((data: string) => {
    // Send terminal output to client
    sendShellMessage(ws, { type: "output", data });

    // Detect auth URLs in output
    urlBuffer += data;
    // Keep buffer manageable
    if (urlBuffer.length > 4096) {
      urlBuffer = urlBuffer.slice(-2048);
    }

    const clean = urlBuffer.replace(ANSI_REGEX, "");
    const lowerClean = clean.toLowerCase();
    const hasKeyword = AUTH_TRIGGER_KEYWORDS.some((kw) => lowerClean.includes(kw));

    if (hasKeyword) {
      const urls = clean.match(URL_REGEX);
      if (urls) {
        for (const url of urls) {
          if (!session.announcedUrls.has(url)) {
            session.announcedUrls.add(url);
            sendShellMessage(ws, { type: "auth_url", url });
          }
        }
      }
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    sendShellMessage(ws, { type: "exit", exitCode });
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
