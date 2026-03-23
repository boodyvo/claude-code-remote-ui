# Claude Connector — Product Design Document

## 1. Vision

A self-hosted, mobile-first web interface for Claude Code that runs on Hetzner via Coolify. Built exclusively for Claude Code with subscription auth (no API key). Includes voice input via Deepgram. Designed to be the best way to interact with Claude Code from any device — especially phones.

---

## 2. Core Requirements

| # | Requirement | Details |
|---|-------------|---------|
| 1 | **Subscription-only auth** | Uses `claude login` OAuth tokens from `~/.claude/`. No API key path. |
| 2 | **Voice input** | Deepgram Nova-3 streaming transcription with push-to-talk and keyterm prompting for code vocabulary |
| 3 | **Persistent sessions** | Sessions survive container restarts via Docker volumes. Resume any session. |
| 4 | **Durable deployment** | Docker Compose on Coolify/Hetzner with health checks, restart policies, SSL |
| 5 | **Mobile-first UI** | PWA, bottom navigation, touch-optimized, installable on home screen |
| 6 | **Full Claude Code visualization** | Every message type rendered with purpose-built components (thinking, tools, diffs, agents, etc.) |
| 7 | **Multi-session management** | Spawn, switch, cancel, fork sessions from the UI |
| 8 | **Security** | Auth wall, WSS-only, CSP headers, Deepgram key server-side only |

---

## 3. Architecture

### 3.1 System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Hetzner VPS (CPX32)                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Coolify + Traefik                       │  │
│  │                    (SSL, reverse proxy)                     │  │
│  └────────────┬───────────────────────────────┬───────────────┘  │
│               │                               │                  │
│  ┌────────────▼────────────────────────────────▼──────────────┐  │
│  │              Docker Compose Stack                          │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │           Next.js App (standalone)                    │  │  │
│  │  │                                                      │  │  │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │  │  │
│  │  │  │  WebSocket   │  │  REST API    │  │  SSR Pages │  │  │  │
│  │  │  │  Server      │  │  /api/*      │  │            │  │  │  │
│  │  │  └──────┬───────┘  └──────┬───────┘  └────────────┘  │  │  │
│  │  │         │                 │                           │  │  │
│  │  │  ┌──────▼─────────────────▼───────────────────────┐  │  │  │
│  │  │  │          Session Manager                        │  │  │  │
│  │  │  │                                                 │  │  │  │
│  │  │  │  ┌───────────────────┐  ┌───────────────────┐  │  │  │  │
│  │  │  │  │  Claude Agent SDK │  │  Deepgram Client  │  │  │  │  │
│  │  │  │  │  (query/resume/   │  │  (Nova-3 WS       │  │  │  │  │
│  │  │  │  │   list sessions)  │  │   streaming)      │  │  │  │  │
│  │  │  │  └────────┬──────────┘  └───────────────────┘  │  │  │  │
│  │  │  │           │                                     │  │  │  │
│  │  │  │  ┌────────▼──────────┐                          │  │  │  │
│  │  │  │  │  Claude Code CLI  │                          │  │  │  │
│  │  │  │  │  (subprocess)     │                          │  │  │  │
│  │  │  │  └───────────────────┘                          │  │  │  │
│  │  │  └─────────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  Volumes:                                                  │  │
│  │    claude_home → /home/app/.claude  (auth + sessions)      │  │
│  │    workspace   → /app/workspace     (project files)        │  │
│  │    app_data    → /app/data          (app DB, settings)     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 15 (App Router, standalone output) | Streaming RSC, WebSocket support, mature ecosystem |
| **UI Components** | shadcn/ui + custom chat components | Own the code, Tailwind-native, accessible (Radix primitives) |
| **Styling** | Tailwind CSS v4 | CSS-first config, `@theme {}` tokens, native dark mode |
| **State** | Zustand | Minimal API, selector-based re-renders, streaming-friendly |
| **Code Highlighting** | Shiki | VS Code TextMate grammars, dual-theme, WASM |
| **Diff View** | react-diff-viewer | Lightweight (52KB), unified + split modes |
| **Real-time** | WebSocket (ws library) | Bidirectional for tool approvals, interrupts, voice streaming |
| **Voice** | Deepgram Nova-3 SDK | 150ms latency, keyterm prompting, $200 free credits |
| **Claude Integration** | @anthropic-ai/claude-agent-sdk | Official SDK, manages subprocess, typed messages |
| **Auth** | Argon2 password hash + HttpOnly session cookie | Simple, secure, single-user |
| **Database** | SQLite (better-sqlite3) | Zero-config, single-file, persistent via volume |
| **PWA** | @serwist/next (Workbox fork) | Service worker, push notifications, installable |

---

## 4. Claude Agent SDK Integration

### 4.1 Session Lifecycle

```typescript
import { query, listSessions, getSessionMessages } from "@anthropic-ai/claude-agent-sdk";

// --- Start new session ---
const session = query({
  prompt: userMessageGenerator(),  // AsyncIterable<SDKUserMessage>
  options: {
    cwd: "/app/workspace/my-project",
    allowedTools: ["Read", "Grep", "Glob"],
    canUseTool: handleToolApproval,  // → WebSocket → browser → user decision
    includePartialMessages: true,    // token-by-token streaming
  }
});

for await (const msg of session) {
  broadcastToClients(msg);  // Send to all connected browsers via WebSocket
}

// --- Resume existing session ---
const resumed = query({
  prompt: "Continue the refactoring",
  options: { resume: "session-uuid-here" }
});

// --- Fork session ---
const forked = query({
  prompt: "Try a different approach",
  options: { resume: "session-uuid-here", forkSession: true }
});

// --- List sessions ---
const sessions = await listSessions({ dir: "/app/workspace/my-project", limit: 50 });

// --- Read session history ---
const messages = await getSessionMessages("session-uuid", { dir: "/app/workspace/my-project" });
```

### 4.2 All SDK Message Types (Complete Reference)

The UI must handle every message type returned by `query()`:

#### Primary Messages

| Type | Subtype | UI Component | Description |
|------|---------|-------------|-------------|
| `assistant` | — | `MessageBubble` | Claude's response. Contains `content[]` blocks (see §4.3) |
| `user` | — | `UserBubble` | User message (text or voice transcript) |
| `result` | `success` | `SessionSummary` | Session complete. Shows cost, tokens, duration, turns |
| `result` | `error_*` | `ErrorBanner` | Max turns, budget exceeded, execution error |
| `stream_event` | — | (updates `MessageBubble` live) | Token-by-token streaming delta |

#### System Messages

| Type | Subtype | UI Component | Description |
|------|---------|-------------|-------------|
| `system` | `init` | `SessionHeader` | Model, tools, MCP servers, version, permission mode |
| `system` | `status` | `StatusIndicator` | "Compacting..." or permission mode change |
| `system` | `compact_boundary` | `CompactDivider` | Visual separator when context was compressed |
| `system` | `task_started` | `AgentCard` (started) | Subagent/background task launched |
| `system` | `task_progress` | `AgentCard` (progress) | Subagent progress update |
| `system` | `task_notification` | `AgentCard` (done) | Subagent completed/failed |
| `system` | `hook_started` | `HookIndicator` | Hook execution began |
| `system` | `hook_progress` | `HookIndicator` | Hook stdout/stderr |
| `system` | `hook_response` | `HookIndicator` | Hook completed |
| `system` | `files_persisted` | `Toast` | Files saved notification |
| `system` | `api_retry` | `RetryBanner` | API retry with countdown |

#### Tool & Session Messages

| Type | Subtype | UI Component | Description |
|------|---------|-------------|-------------|
| `tool_progress` | — | `ToolSpinner` | Elapsed time while tool runs |
| `tool_use_summary` | — | `ToolSummaryChip` | Collapsed summary of batch tool uses |
| `auth_status` | — | `AuthModal` | Authentication flow indicator |
| `rate_limit_event` | — | `RateLimitBanner` | Warning or rejection notice |
| `prompt_suggestion` | — | `SuggestionChip` | Clickable suggested next prompt |

### 4.3 Content Block Types (inside `assistant` messages)

Each `assistant` message contains a `content[]` array with these block types:

| Block Type | UI Component | Rendering |
|-----------|-------------|-----------|
| `text` | `MarkdownRenderer` | Full markdown with Shiki code blocks |
| `thinking` | `ThinkingBlock` | Collapsible, dimmed, italic. Shows reasoning |
| `redacted_thinking` | `RedactedBlock` | Locked icon + "Reasoning hidden" label |
| `tool_use` | `ToolUseCard` | Tool name, input params, approve/reject buttons |
| `tool_result` | Per-tool renderer (see §4.4) | Varies by tool |
| `server_tool_use` | `ServerToolChip` | Web search / code execution indicator |

### 4.4 Tool-Specific Result Renderers

Each built-in tool needs a specialized renderer:

| Tool | Result Shape | UI Renderer |
|------|-------------|-------------|
| `Edit` | `{ filePath, oldString, newString, structuredPatch[], gitDiff }` | `DiffViewer` — unified diff with syntax highlighting |
| `Write` | `{ type, filePath, content, structuredPatch[], gitDiff }` | `DiffViewer` (update) or `NewFileViewer` (create) |
| `Read` | Discriminated: `text` / `image` / `notebook` / `pdf` / `parts` | `CodeViewer` / `ImagePreview` / `NotebookViewer` / `PDFEmbed` |
| `Bash` | `{ stdout, stderr, interrupted, isImage? }` | `TerminalOutput` — monospace with stderr in red |
| `Glob` | `{ filenames[], numFiles, truncated }` | `FileList` — collapsible list with icons |
| `Grep` | `{ filenames[], content?, numFiles, numMatches? }` | `SearchResults` — highlighted matches with line numbers |
| `Agent` | `{ status }` | `AgentCard` — nested or background indicator |
| `TodoWrite` | `{ oldTodos[], newTodos[] }` | `TodoChecklist` — status-colored items |
| `WebSearch` | `{ query, results[] }` | `SearchResultCards` — title, URL, snippet |
| `WebFetch` | `{ url, result, code }` | `FetchResultBlock` — URL header + content |
| `AskUserQuestion` | `{ questions[] }` | `QuestionDialog` — radio/checkbox options |
| MCP tools (`mcp__*`) | Varies | `GenericToolResult` — JSON tree viewer |

### 4.5 Streaming Event Flow

When `includePartialMessages: true`, token-by-token updates arrive as:

```
message_start → (content_block_start → content_block_delta* → content_block_stop)* → message_delta → message_stop
```

The `content_block_delta` events contain:
- `text_delta` — append to current text block
- `thinking_delta` — append to current thinking block
- `input_json_delta` — append to tool use input (partial JSON)

The UI should buffer these deltas and render incrementally for a typewriter effect.

---

## 5. Voice Input — Deepgram Integration

### 5.1 Architecture

```
Browser                         Server                      Deepgram
  │                               │                            │
  │ getUserMedia() + MediaRecorder │                            │
  │ (250ms chunks)                │                            │
  │                               │                            │
  │──── WS: audio blob ──────────▶│──── WS: audio stream ─────▶│
  │                               │                            │
  │◀─── WS: interim transcript ──│◀─── WS: transcript JSON ──│
  │◀─── WS: final transcript ───│                            │
  │                               │                            │
  │──── WS: send_message ────────▶│                            │
  │     (confirmed transcript)    │                            │
```

API key stays server-side. Browser never sees it.

### 5.2 Deepgram Configuration

```typescript
const connection = await deepgram.listen.v1.connect({
  model: "nova-3",
  language: "en-US",
  smart_format: true,
  punctuate: true,
  interim_results: true,
  endpointing: 300,        // ms of silence before finalizing
  keyterms: [               // Code vocabulary boost (up to 100 terms)
    "async", "await", "useState", "useEffect", "TypeScript",
    "interface", "const", "function", "import", "export",
    "component", "middleware", "API", "endpoint", "schema",
    "Docker", "Kubernetes", "WebSocket", "OAuth", "JWT",
    // Add project-specific terms dynamically
  ],
});
```

### 5.3 Voice UX Design

**Push-to-talk (primary mode):**
- Tap mic button → recording starts → tap again → transcript appears in input for review → tap send
- Hold mic button → recording → release → auto-send (WhatsApp-style, configurable)

**Visual feedback:**
- Idle: Microphone icon (outline)
- Recording: Pulsing red dot + waveform visualization (Web Audio API `AnalyserNode`)
- Processing: Spinner replacing waveform
- Interim text: Grey italic text updating live in the input area
- Final text: Black/white text, editable before sending

**Mobile considerations:**
- Haptic feedback on record start/stop (`navigator.vibrate`)
- Large touch target: 48x48px minimum for mic button
- Works on iOS Safari (getUserMedia + MediaRecorder supported since iOS 14.3)
- HTTPS required (enforced by Coolify/Traefik SSL)

### 5.4 Cost

- $200 free credits (~43,000 minutes, no expiration)
- After: $0.0077/min (Nova-3 mono)
- Keyterm prompting add-on: +$0.0013/min
- Billing is per-second, not per-minute

---

## 6. UI Design System

### 6.1 Design Tokens (Tailwind v4)

```css
/* app.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Colors - semantic */
  --color-background: #ffffff;
  --color-foreground: #0f172a;
  --color-muted: #f1f5f9;
  --color-muted-foreground: #64748b;
  --color-accent: #6d28d9;          /* Purple - brand */
  --color-accent-foreground: #ffffff;
  --color-destructive: #ef4444;
  --color-success: #22c55e;
  --color-warning: #f59e0b;

  /* Surfaces */
  --color-card: #ffffff;
  --color-card-border: #e2e8f0;
  --color-input: #f8fafc;
  --color-input-border: #cbd5e1;

  /* Claude-specific */
  --color-thinking: #fef3c7;        /* Amber tint for reasoning */
  --color-tool-bg: #f0f9ff;         /* Blue tint for tool calls */
  --color-diff-add: #dcfce7;        /* Green for additions */
  --color-diff-remove: #fee2e2;     /* Red for deletions */
  --color-terminal-bg: #1e1e1e;     /* Dark terminal background */
  --color-voice-active: #ef4444;    /* Red for recording */

  /* Typography */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;

  /* Spacing */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;

  /* Breakpoints */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
}

/* Dark theme overrides */
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --color-background: #0f172a;
    --color-foreground: #f8fafc;
    --color-muted: #1e293b;
    --color-muted-foreground: #94a3b8;
    --color-card: #1e293b;
    --color-card-border: #334155;
    --color-input: #0f172a;
    --color-input-border: #475569;
    --color-thinking: #451a03;
    --color-tool-bg: #0c1929;
  }
}
```

### 6.2 FOUC Prevention

Inline in `<head>` before any CSS loads:

```html
<script>
  (function() {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

### 6.3 Layout Architecture

#### Desktop (≥1024px)

```
┌──────────┬──────────────────────────────────────────────────┐
│          │  ┌─ SessionHeader ─────────────────────────────┐ │
│  Session │  │ Model: opus-4   Mode: default   $0.42 cost │ │
│  Sidebar │  └─────────────────────────────────────────────┘ │
│          │                                                  │
│  ┌─────┐ │  ┌─ MessageStream ─────────────────────────────┐ │
│  │ New │ │  │                                             │ │
│  └─────┘ │  │  UserBubble: "Fix the auth bug"            │ │
│          │  │                                             │ │
│  Today   │  │  ThinkingBlock: [▼ Reasoning...]            │ │
│  ├ #a3f  │  │                                             │ │
│  ├ #b2e  │  │  ToolUseCard: Read auth.py                  │ │
│  │       │  │    └─ CodeViewer (collapsed)                │ │
│  Yester. │  │                                             │ │
│  ├ #c1d  │  │  ToolUseCard: Edit auth.py                  │ │
│  │       │  │    └─ DiffViewer (unified)                  │ │
│  │       │  │    └─ [✓ Accept] [✗ Reject]                │ │
│  │       │  │                                             │ │
│  ┌─────┐ │  │  MessageBubble: "I've fixed the..."        │ │
│  │ ⚙️  │ │  │                                             │ │
│  └─────┘ │  └─────────────────────────────────────────────┘ │
│          │                                                  │
│  240px   │  ┌─ InputBar ──────────────────────────────────┐ │
│          │  │ [  Type a message...          🎤   ➤  ]    │ │
│          │  └─────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────┘
```

#### Mobile (<768px)

```
┌─────────────────────────────────┐
│  ☰  Session #a3f...    ⚙️       │  ← Top bar
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │ You: "Fix the auth bug"  │  │  ← Right-aligned user bubble
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ▶ Thinking (3.2s)        │  │  ← Collapsed by default on mobile
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 📄 Read: auth.py         │  │  ← Compact tool card
│  │ 142 lines                │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ✏️ Edit: auth.py          │  │
│  │ +3 -1 lines              │  │
│  │ [View Diff]              │  │  ← Tap to expand full-screen diff
│  │                          │  │
│  │ [✓ Accept]  [✗ Reject]   │  │  ← 48px touch targets
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Claude: "I've fixed..."  │  │
│  └───────────────────────────┘  │
│                                 │
├─────────────────────────────────┤
│ [  Type message...    🎤   ➤ ] │  ← Input bar (above keyboard)
├─────────────────────────────────┤
│  💬 Chat    📁 Files    🖥 Term │  ← Bottom nav (thumb zone)
└─────────────────────────────────┘
```

#### Voice Recording State (Mobile)

```
┌─────────────────────────────────┐
│  ...messages above...           │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🔴 Recording... 0:04      │  │
│  │ ┈┈╍╍━━╍╍┈┈╍╍━━━╍╍┈┈     │  │  ← Waveform visualization
│  │                           │  │
│  │ "fix the authentication   │  │  ← Interim transcript (grey)
│  │  bug in the login..."     │  │
│  └───────────────────────────┘  │
│                                 │
│ [ Cancel ]    [ 🔴 Stop ]      │  ← Large touch targets
├─────────────────────────────────┤
│  💬 Chat    📁 Files    🖥 Term │
└─────────────────────────────────┘
```

### 6.4 Component Catalog

#### Message Components

| Component | Purpose | Design Notes |
|-----------|---------|-------------|
| `UserBubble` | User text/voice messages | Right-aligned, accent color background, mic icon if voice |
| `AssistantBubble` | Claude text responses | Left-aligned, card background, full-width markdown |
| `ThinkingBlock` | Extended thinking | Amber tint, collapsible. Default collapsed on mobile, expanded on desktop. Shows duration |
| `RedactedBlock` | Redacted reasoning | Locked icon, muted text "Reasoning hidden", non-expandable |
| `MarkdownRenderer` | Renders markdown content | GitHub-flavored markdown, Shiki code blocks, link handling |

#### Tool Components

| Component | Purpose | Design Notes |
|-----------|---------|-------------|
| `ToolUseCard` | Wraps any tool invocation | Card with tool icon, name, collapsible params. Blue tint background |
| `ToolApprovalBar` | Accept/Reject buttons | Sticky at bottom of ToolUseCard. Green/red buttons, 48px height, disabled after decision |
| `ToolSpinner` | Tool in progress | Tool name + spinner + elapsed time counter |
| `ToolSummaryChip` | Batch tool summary | Compact pill: "Read 5 files, Grep 2 searches" — expandable |
| `DiffViewer` | File changes (Edit/Write) | Unified mode on mobile, split option on desktop. Shiki highlighting. Collapsible unchanged regions |
| `CodeViewer` | File content (Read) | Shiki highlighting, line numbers, horizontal scroll, copy button, filename header |
| `TerminalOutput` | Bash results | Dark background, monospace, stderr in red, stdout in white/green. Scrollable, max-height with expand |
| `FileList` | Glob results | Indented list with file type icons, truncation notice |
| `SearchResults` | Grep results | File path headers, highlighted match lines, line numbers |
| `ImagePreview` | Read image results | Inline image with lightbox on tap, pinch-to-zoom |
| `TodoChecklist` | TodoWrite results | Checkboxes with status colors: pending (grey), in_progress (blue), completed (green) |
| `QuestionDialog` | AskUserQuestion | Modal or inline form with radio buttons / text inputs |
| `GenericToolResult` | MCP / unknown tools | Collapsible JSON tree viewer |

#### Agent Components

| Component | Purpose | Design Notes |
|-----------|---------|-------------|
| `AgentCard` | Subagent display | Nested card with its own message stream (indented). Status badge: running/completed/failed |
| `AgentProgress` | Background task | Compact bar: agent description + spinner + last tool used |

#### Session Components

| Component | Purpose | Design Notes |
|-----------|---------|-------------|
| `SessionSidebar` | Session list | Grouped by date (Today, Yesterday, This Week, Older). Search bar. Session preview (first message truncated). Active session highlighted |
| `SessionHeader` | Active session info | Model name, permission mode, cost so far, session duration. Compact bar below top nav |
| `NewSessionButton` | Create session | Prominent button at top of sidebar. Opens project/directory picker |
| `SessionActions` | Session operations | Fork, rename, delete. Accessible via long-press (mobile) or right-click (desktop) |

#### System Components

| Component | Purpose | Design Notes |
|-----------|---------|-------------|
| `CompactDivider` | Context compaction | Horizontal rule with "Context compacted" label. Dimmed |
| `RetryBanner` | API retry | Yellow banner: "Retrying in 5s... (rate limit)" with countdown |
| `RateLimitBanner` | Rate limit | Warning (yellow) or error (red) banner with reset time |
| `ErrorBanner` | Session errors | Red banner for max turns, budget exceeded, execution errors |
| `StatusIndicator` | Compacting/loading | Subtle top-of-page progress bar |
| `AuthModal` | Authentication | Full-screen modal for login flow if auth token expired |

#### Voice Components

| Component | Purpose | Design Notes |
|-----------|---------|-------------|
| `VoiceMicButton` | Record trigger | 48x48px, 3 states: idle (outline), recording (pulsing red), processing (spinner) |
| `WaveformVisualizer` | Audio feedback | Real-time waveform bars (Web Audio API AnalyserNode). Replaces input area during recording |
| `InterimTranscript` | Live transcript | Grey italic text updating in real-time inside the input area |
| `VoiceConfirmBar` | Review before send | Shows final transcript with Edit and Send buttons. Replaces input during confirmation |

#### Navigation Components

| Component | Purpose | Design Notes |
|-----------|---------|-------------|
| `TopBar` | App header | Hamburger (mobile), session name, settings gear. Height: 48px |
| `BottomNav` | Mobile navigation | Chat / Files / Terminal tabs. Fixed bottom, 56px height, safe-area-inset padding |
| `FileExplorer` | File browser | Tree view in a drawer (mobile) or panel (desktop). Breadcrumb path |
| `TerminalPanel` | Embedded terminal | xterm.js instance for direct shell access. Full-screen option on mobile |

#### Shared Components

| Component | Purpose | Design Notes |
|-----------|---------|-------------|
| `ThemeToggle` | Light/Dark/System | 3-state segmented control in settings |
| `Toast` | Transient notifications | Bottom-center on mobile, bottom-right on desktop. Auto-dismiss 5s |
| `PermissionBadge` | Mode indicator | Pill showing current permission mode with color coding |
| `CostDisplay` | Usage tracking | Inline: "$0.42 · 12.3K tokens · 2m 15s" |
| `CodeSymbolToolbar` | Mobile keyboard helper | Floating bar above virtual keyboard: `{ } [ ] ( ) ; : " ' / = < >` |

---

## 7. Mobile-Specific Design Decisions

### 7.1 Touch Targets

All interactive elements: **minimum 44x44px** (Apple HIG) / **48x48px** (Material Design). We use 48px as the floor.

### 7.2 Code on Mobile

- **Horizontal scroll** for code blocks (never wrap)
- Font: `clamp(12px, 3.5vw, 16px)` for code
- Pinch-to-zoom enabled on code blocks and diffs
- Copy button on every code block (selecting code on mobile is painful)
- Diffs: **unified view only** on mobile (side-by-side is unusable)
- Full-screen diff viewer on tap (bottom sheet that slides up)

### 7.3 Keyboard Management

```typescript
// Resize chat when virtual keyboard opens
visualViewport?.addEventListener("resize", () => {
  const keyboardHeight = window.innerHeight - visualViewport.height;
  document.documentElement.style.setProperty("--keyboard-height", `${keyboardHeight}px`);
});
```

Input bar uses `position: fixed; bottom: calc(56px + var(--keyboard-height, 0px))` to stay above keyboard + bottom nav.

### 7.4 Gestures

| Gesture | Action |
|---------|--------|
| Swipe right from edge | Open session sidebar |
| Swipe left on message | Copy / Retry / Delete actions |
| Long press on session | Fork / Rename / Delete options |
| Pull down | Refresh session list |
| Pinch | Zoom on code/diff/images |

### 7.5 PWA Configuration

```json
{
  "name": "Claude Connector",
  "short_name": "Claude",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#0f172a",
  "background_color": "#0f172a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Push notifications for:
- Long-running task completion ("Your refactoring is done — 47 files changed")
- Session errors ("Session #a3f hit rate limit, paused")
- Background agent completion

Service worker strategy:
- App shell: cache-first (precache)
- API responses: network-first with cache fallback
- Static assets (fonts, icons): cache-first

### 7.6 iOS Safari Limitations

- 7-day cache expiry if PWA not opened — mitigated by keeping all data server-side
- No `beforeinstallprompt` — show custom install banner with "Add to Home Screen" instructions
- EU: PWAs may open in Safari tabs (iOS 17.4+) — design works in both standalone and browser modes
- 50MB storage cap — keep large data server-side, cache only app shell

---

## 8. Security

### 8.1 Authentication

Single-user, self-hosted. Simple but secure:

```typescript
// Password stored as Argon2 hash in SQLite
const hash = await argon2.hash(password, { type: argon2.argon2id });

// Session: HttpOnly cookie with signed JWT
const token = jwt.sign({ userId: 1 }, SESSION_SECRET, { expiresIn: "7d" });
res.setHeader("Set-Cookie",
  `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
);
```

First-run setup: user creates password on first visit. Stored in SQLite on persistent volume.

### 8.2 WebSocket Security

```typescript
// Authenticate WebSocket at upgrade time
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const token = url.searchParams.get("token");

  if (!validateJWT(token)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  // Validate Origin
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
```

### 8.3 HTTP Headers

```typescript
// Next.js middleware or headers config
const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss:; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "microphone=(self)",  // Allow mic for voice input
};
```

### 8.4 Deepgram API Key

- Stored as environment variable server-side only
- Never sent to browser
- Browser streams audio to our WebSocket server, which relays to Deepgram
- Rate limit voice recording: max 5 minutes per message, 60 minutes per hour

### 8.5 Claude Auth Token

- Stored in `~/.claude/` inside Docker volume
- Never exposed via any API endpoint
- Container runs as non-root user
- Volume permissions: `700`

---

## 9. Deployment — Docker Compose for Coolify

### 9.1 Dockerfile

```dockerfile
# --- Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Builder ---
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

# Create data directories
RUN mkdir -p /home/app/.claude /app/workspace /app/data && \
    chown -R app:app /home/app/.claude /app/workspace /app/data

USER app

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
```

### 9.2 docker-compose.yml

```yaml
services:
  claude-connector:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - HOSTNAME=0.0.0.0
      - PORT=3000
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - SESSION_SECRET=${SERVICE_PASSWORD_64_SESSION}
      - DATABASE_PATH=/app/data/connector.db
    volumes:
      - claude_home:/home/app/.claude
      - workspace:/app/workspace
      - app_data:/app/data
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    labels:
      - coolify.managed=true
      - traefik.enable=true
      - "traefik.http.routers.connector.rule=Host(`${SERVICE_FQDN_CONNECTOR}`)"
      - "traefik.http.routers.connector.entrypoints=https"
      - "traefik.http.routers.connector.tls=true"
      - "traefik.http.routers.connector.tls.certresolver=letsencrypt"
      - "traefik.http.services.connector.loadbalancer.server.port=3000"

volumes:
  claude_home:
    name: claude-connector-claude-home
  workspace:
    name: claude-connector-workspace
  app_data:
    name: claude-connector-data
```

### 9.3 Coolify-Specific Notes

- **Disable Gzip compression** in Coolify advanced settings — Gzip breaks WebSocket and SSE streaming through Traefik
- `SERVICE_FQDN_CONNECTOR` — Coolify auto-generates the FQDN
- `SERVICE_PASSWORD_64_SESSION` — Coolify generates a random 64-char secret
- Use **Raw Compose Deployment** mode for full control over the compose file
- Set environment variables in Coolify UI (not in .env file)

### 9.4 Persistent Volumes

| Volume | Mount | Contents | Criticality |
|--------|-------|----------|-------------|
| `claude_home` | `/home/app/.claude` | Auth tokens, session history, settings | **Critical** — losing this loses auth |
| `workspace` | `/app/workspace` | Project files, git repos | **Critical** — user's code |
| `app_data` | `/app/data` | SQLite DB (user password, app settings) | Important — recreatable |

**Backup strategy:** Coolify supports S3-compatible backup scheduling. Configure daily backups of all three volumes.

### 9.5 Hetzner Server Recommendation

| Plan | Specs | Monthly Cost | Notes |
|------|-------|-------------|-------|
| **CPX32** | 4 vCPU / 8GB RAM / 160GB | ~€11 | Single user, recommended |
| **CX43** | 8 vCPU / 16GB RAM / 160GB | ~€9.50 | Multi-session heavy use |

Coolify overhead: ~400-700MB RAM. Claude Code: ~500MB-2GB depending on activity.
Total with CPX32: ~1.5-3GB used, leaving 5-6GB headroom.

---

## 10. WebSocket Protocol

### 10.1 Client → Server Messages

```typescript
type ClientMessage =
  | { type: "send_message"; content: string; sessionId: string }
  | { type: "new_session"; cwd: string; name?: string }
  | { type: "resume_session"; sessionId: string }
  | { type: "fork_session"; sessionId: string }
  | { type: "cancel_session"; sessionId: string }
  | { type: "tool_response"; toolUseId: string; decision: "allow" | "deny"; updatedInput?: any }
  | { type: "interrupt" }
  | { type: "set_permission_mode"; mode: "default" | "acceptEdits" | "plan" | "bypassPermissions" }
  | { type: "audio_chunk"; data: ArrayBuffer }      // Voice: raw audio
  | { type: "audio_start"; sampleRate: number }      // Voice: begin recording
  | { type: "audio_stop" }                           // Voice: end recording
  | { type: "list_sessions"; dir?: string }
  | { type: "get_session_messages"; sessionId: string }
  | { type: "ping" }
```

### 10.2 Server → Client Messages

```typescript
type ServerMessage =
  | { type: "sdk_message"; message: SDKMessage }              // Any SDK message (see §4.2)
  | { type: "session_list"; sessions: SessionInfo[] }         // Response to list_sessions
  | { type: "session_messages"; messages: SDKMessage[] }      // Response to get_session_messages
  | { type: "session_created"; sessionId: string }            // New session started
  | { type: "session_ended"; sessionId: string; reason: string }
  | { type: "transcript_interim"; text: string }              // Voice: interim
  | { type: "transcript_final"; text: string }                // Voice: final
  | { type: "transcript_error"; error: string }               // Voice: error
  | { type: "auth_required" }                                 // Need to run claude login
  | { type: "error"; error: string; code?: string }
  | { type: "pong" }
```

### 10.3 Reconnection

- Client maintains `lastMessageIndex` per session
- On reconnect, server replays messages from `lastMessageIndex`
- Exponential backoff: 100ms initial, 30s max, random jitter
- UI shows "Reconnecting..." banner during disconnect
- Heartbeat ping every 30s, 10s timeout

---

## 11. State Management (Zustand)

```typescript
interface AppState {
  // Sessions
  sessions: SessionInfo[];
  activeSessionId: string | null;
  sessionMessages: Record<string, SDKMessage[]>;

  // Streaming
  streamBuffer: string;
  isStreaming: boolean;
  pendingToolApprovals: ToolApproval[];

  // Voice
  isRecording: boolean;
  interimTranscript: string;
  audioLevel: number;  // 0-1, for waveform

  // UI
  sidebarOpen: boolean;
  activeTab: "chat" | "files" | "terminal";
  theme: "light" | "dark" | "system";

  // Actions
  appendStreamToken: (token: string) => void;
  commitStream: (sessionId: string) => void;
  addMessage: (sessionId: string, msg: SDKMessage) => void;
  respondToTool: (toolUseId: string, decision: "allow" | "deny") => void;
  setRecording: (recording: boolean) => void;
  setInterimTranscript: (text: string) => void;
}
```

---

## 12. File Structure

```
claude-connector/
├── Dockerfile
├── docker-compose.yml
├── next.config.ts                    # standalone output, WebSocket
├── tailwind.config.ts                # (minimal, Tailwind v4 CSS-first)
├── package.json
│
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Service worker (generated)
│   └── icons/                        # PWA icons
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout, theme script, fonts
│   │   ├── page.tsx                  # Main chat page
│   │   ├── login/page.tsx            # Password login
│   │   ├── setup/page.tsx            # First-run password setup
│   │   └── api/
│   │       ├── health/route.ts       # Health check endpoint
│   │       ├── auth/route.ts         # Login/logout
│   │       └── sessions/route.ts     # REST fallback for session list
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui base components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── drawer.tsx            # Mobile sidebar
│   │   │   ├── input.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── chat/                     # Chat-specific components
│   │   │   ├── message-stream.tsx    # Auto-scrolling message area
│   │   │   ├── user-bubble.tsx
│   │   │   ├── assistant-bubble.tsx
│   │   │   ├── thinking-block.tsx
│   │   │   ├── markdown-renderer.tsx # With Shiki code blocks
│   │   │   ├── input-bar.tsx         # Text input + voice + send
│   │   │   └── code-symbol-toolbar.tsx
│   │   │
│   │   ├── tools/                    # Tool-specific renderers
│   │   │   ├── tool-use-card.tsx     # Generic tool wrapper
│   │   │   ├── tool-approval-bar.tsx
│   │   │   ├── tool-spinner.tsx
│   │   │   ├── diff-viewer.tsx
│   │   │   ├── code-viewer.tsx
│   │   │   ├── terminal-output.tsx
│   │   │   ├── file-list.tsx
│   │   │   ├── search-results.tsx
│   │   │   ├── image-preview.tsx
│   │   │   ├── todo-checklist.tsx
│   │   │   ├── question-dialog.tsx
│   │   │   └── generic-tool-result.tsx
│   │   │
│   │   ├── agents/                   # Agent/task components
│   │   │   ├── agent-card.tsx
│   │   │   └── agent-progress.tsx
│   │   │
│   │   ├── session/                  # Session management
│   │   │   ├── session-sidebar.tsx
│   │   │   ├── session-header.tsx
│   │   │   ├── session-actions.tsx
│   │   │   └── new-session-dialog.tsx
│   │   │
│   │   ├── voice/                    # Voice input
│   │   │   ├── voice-mic-button.tsx
│   │   │   ├── waveform-visualizer.tsx
│   │   │   ├── interim-transcript.tsx
│   │   │   └── voice-confirm-bar.tsx
│   │   │
│   │   ├── system/                   # System/status components
│   │   │   ├── compact-divider.tsx
│   │   │   ├── retry-banner.tsx
│   │   │   ├── rate-limit-banner.tsx
│   │   │   ├── error-banner.tsx
│   │   │   ├── status-indicator.tsx
│   │   │   └── cost-display.tsx
│   │   │
│   │   └── layout/                   # Layout components
│   │       ├── top-bar.tsx
│   │       ├── bottom-nav.tsx
│   │       ├── file-explorer.tsx
│   │       └── terminal-panel.tsx
│   │
│   ├── lib/
│   │   ├── ws-client.ts              # WebSocket client with reconnection
│   │   ├── store.ts                  # Zustand store
│   │   ├── message-renderer.ts       # SDK message → component mapper
│   │   ├── voice-recorder.ts         # MediaRecorder + Web Audio wrapper
│   │   └── theme.ts                  # Theme utilities
│   │
│   ├── server/
│   │   ├── ws-server.ts              # WebSocket server
│   │   ├── session-manager.ts        # Claude Agent SDK wrapper
│   │   ├── deepgram-relay.ts         # Audio → Deepgram → transcript
│   │   ├── auth.ts                   # Password hashing, session cookies
│   │   └── db.ts                     # SQLite setup
│   │
│   └── styles/
│       └── app.css                   # Tailwind v4 config + design tokens
│
├── docs/
│   └── initialization/
│       └── product-design.md         # This document
│
└── data/                             # (gitignored, created at runtime)
    └── connector.db
```

---

## 13. Design Inspirations

| Source | What to Take |
|--------|-------------|
| **Claude.ai** | Clean message bubbles, collapsible tool blocks, artifact side panel |
| **ChatGPT** | Voice mode integration in main chat, interim transcript display |
| **Cursor** | Inline diff acceptance, compact tool summaries |
| **v0.dev** | Prompt suggestions, iterative chat refinement |
| **WhatsApp** | Hold-to-record, slide-to-cancel, waveform in input area |
| **GitHub Mobile** | Swipeable file drawer, unified diff on mobile, compact code view |
| **Linear** | Session sidebar grouping, keyboard shortcuts, minimal chrome |
| **Vercel Dashboard** | Dark theme execution, status indicators, real-time logs |

---

## 14. Implementation Phases

### Phase 1 — Foundation
- Next.js project with shadcn/ui
- WebSocket server + client with auth
- Claude Agent SDK integration (start/resume sessions)
- Basic message rendering (text, code blocks)
- Docker + docker-compose for Coolify

### Phase 2 — Full Message Visualization
- All tool-specific renderers (diff, terminal, file list, search, etc.)
- Thinking blocks (collapsible)
- Agent/subagent cards
- Tool approval flow
- Session management sidebar

### Phase 3 — Voice & Mobile
- Deepgram integration (server relay)
- Push-to-talk with waveform
- Interim transcript display
- PWA manifest + service worker
- Bottom navigation
- Mobile-optimized diff viewer
- Code symbol toolbar
- Gesture support

### Phase 4 — Polish
- Push notifications
- Session forking
- File explorer panel
- Embedded terminal (xterm.js)
- iOS install banner
- Keyboard shortcuts (desktop)
- Cost tracking dashboard
