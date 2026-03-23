# Ticket 019 — Embedded Terminal

**Phase:** 4 — Polish & Extended Features
**Effort:** M
**Depends on:** Tickets 3, 5

## Summary

Embed an interactive terminal (xterm.js) for direct shell access to the workspace. Accessible via the "Terminal" tab on mobile or a bottom panel on desktop.

## Acceptance Criteria

- [ ] `TerminalPanel` component using xterm.js
  - Full terminal emulation (ANSI colors, cursor movement, scrollback)
  - WebSocket connection to server-side PTY
  - Resizable (drag handle on desktop, full-screen on mobile)
- [ ] Server-side PTY spawning:
  - Spawns shell (`/bin/sh` or `/bin/bash`) in `/app/workspace`
  - Connected via WebSocket (separate from main app WS)
  - Authenticated (same JWT as main connection)
  - One terminal per session (persists while tab is open)
- [ ] Terminal features:
  - Copy/paste (Ctrl+C/V or right-click)
  - Scrollback buffer (1000 lines)
  - Font: JetBrains Mono, same size as code blocks
  - Fits container, auto-resizes on window resize
- [ ] On mobile: "Terminal" tab in bottom nav
  - Full-screen terminal when active
  - Touch-friendly: long-press to select, tap to place cursor
- [ ] On desktop: toggleable bottom panel
  - Drag handle to resize height
  - Default 30% of viewport height

## Implementation Notes

### Server-Side PTY
Use `node-pty` to spawn a pseudo-terminal:
```typescript
import { spawn } from "node-pty";

const pty = spawn("/bin/sh", [], {
  name: "xterm-256color",
  cols: 80,
  rows: 24,
  cwd: "/app/workspace",
  env: process.env,
});

// Pipe PTY output to WebSocket
pty.onData((data) => ws.send(data));

// Pipe WebSocket input to PTY
ws.on("message", (data) => pty.write(data));
ws.on("close", () => pty.kill());
```

### Client-Side xterm.js
```typescript
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

const term = new Terminal({ fontFamily: "JetBrains Mono", fontSize: 14 });
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.loadAddon(new WebLinksAddon());
term.open(containerRef.current);
fitAddon.fit();
```

## Tests

- [ ] **Unit:** Terminal renders and connects to WebSocket
- [ ] **Unit:** Resize events propagate to PTY
- [ ] **Integration:** Commands execute and output displays
- [ ] **Integration:** Terminal persists state across tab switches
- [ ] **Security:** PTY confined to /app/workspace, no root access

## Files to Create

- `src/components/layout/terminal-panel.tsx`
- `src/server/terminal.ts` (PTY management)

## Dependencies to Add

- `@xterm/xterm`
- `@xterm/addon-fit`
- `@xterm/addon-web-links`
- `node-pty`
