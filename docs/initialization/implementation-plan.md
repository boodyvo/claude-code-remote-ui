# Claude Connector — Implementation Plan

## Overview

The implementation is split into **4 phases** with **20 tickets**. Each phase builds on the previous and produces a working, testable increment. Phases are sequential; tickets within a phase can often be parallelized.

---

## Phase 1 — Foundation (Tickets 1–5)

**Goal:** A working Next.js app with auth, WebSocket server, and Claude Agent SDK integration. Can start a session, send a message, see a plain-text response. Deployable to Coolify.

```
[1] Project scaffold → [2] Auth system → [3] WebSocket server → [4] Claude SDK integration → [5] Docker + Coolify
         │                                       │                        │
         └── can run in parallel ────────────────┘                        │
                                                                          └── depends on 1-4
```

| Ticket | Title | Depends On | Effort |
|--------|-------|-----------|--------|
| 1 | Project scaffold (Next.js + shadcn/ui + Tailwind v4) | — | M |
| 2 | Auth system (Argon2 + JWT session cookie + SQLite) | 1 | M |
| 3 | WebSocket server + client with reconnection | 1 | L |
| 4 | Claude Agent SDK integration (start, resume, list sessions) | 1, 3 | L |
| 5 | Docker + docker-compose + Coolify deployment | 1–4 | M |

**Milestone:** Deploy to Hetzner, login, start a Claude Code session via text, see streaming plain-text response.

---

## Phase 2 — Full Message Visualization (Tickets 6–12)

**Goal:** Every SDK message type has a purpose-built UI component. Tool approvals work. Session management is complete.

```
[6] Markdown + code blocks ─┐
[7] Thinking blocks          ├─ all parallel, depend on Phase 1
[8] Tool use cards + approval│
[9] Tool result renderers   ─┘
                              └→ [10] Agent/task display
                                  └→ [11] System messages
                                      └→ [12] Session sidebar + management
```

| Ticket | Title | Depends On | Effort |
|--------|-------|-----------|--------|
| 6 | Markdown renderer with Shiki code blocks | 1 | M |
| 7 | Thinking blocks (collapsible, redacted) | 6 | S |
| 8 | Tool use cards with approval flow | 3, 4 | L |
| 9 | Tool result renderers (diff, terminal, file list, search, image, todo, question) | 6, 8 | XL |
| 10 | Agent/subagent cards and background task display | 8 | M |
| 11 | System message components (status, retry, rate limit, compact, error, cost) | 6 | M |
| 12 | Session sidebar with management (new, resume, fork, delete, search) | 4 | L |

**Milestone:** Full Claude Code experience in the browser — every message type renders correctly, tool approvals work, sessions manageable.

---

## Phase 3 — Voice & Mobile (Tickets 13–17)

**Goal:** Deepgram voice input works. Mobile UX is polished. PWA is installable.

```
[13] Mobile layout (bottom nav, responsive) ─┐
[14] Deepgram server relay                    ├─ parallel
[15] Voice UI (mic button, waveform, transcript)─┘
                                               └→ [16] PWA (manifest, service worker, push)
                                                   └→ [17] Mobile polish (gestures, keyboard, code viewing)
```

| Ticket | Title | Depends On | Effort |
|--------|-------|-----------|--------|
| 13 | Mobile layout (bottom nav, drawer sidebar, responsive breakpoints) | 12 | L |
| 14 | Deepgram server relay (audio WebSocket proxy, keyterm config) | 3 | M |
| 15 | Voice UI (mic button, waveform visualizer, interim transcript, confirm bar) | 13, 14 | L |
| 16 | PWA setup (manifest, service worker, push notifications, install banner) | 13 | M |
| 17 | Mobile polish (gestures, virtual keyboard handling, code symbol toolbar, touch code viewing) | 13 | M |

**Milestone:** Use Claude Code from phone with voice input. Installable PWA with push notifications.

---

## Phase 4 — Polish & Extended Features (Tickets 18–20)

**Goal:** File explorer, embedded terminal, dark/light theme, keyboard shortcuts.

| Ticket | Title | Depends On | Effort |
|--------|-------|-----------|--------|
| 18 | File explorer panel (tree view, breadcrumbs, file preview) | 4 | L |
| 19 | Embedded terminal (xterm.js, shell access) | 3, 5 | M |
| 20 | Theme system (light/dark/system toggle, FOUC prevention) + keyboard shortcuts | 1 | M |

**Milestone:** Feature-complete product.

---

## Effort Scale

| Label | Meaning |
|-------|---------|
| **S** | Small — a few hours, single component |
| **M** | Medium — ~1 day, multiple files, some integration |
| **L** | Large — ~2-3 days, cross-cutting, multiple components |
| **XL** | Extra large — ~3-5 days, many renderers/edge cases |

---

## Ticket Reference

| # | Title | File |
|---|-------|------|
| 1 | Project Scaffold | [ticket_001.md](tickets/ticket_001.md) |
| 2 | Auth System | [ticket_002.md](tickets/ticket_002.md) |
| 3 | WebSocket Server + Client | [ticket_003.md](tickets/ticket_003.md) |
| 4 | Claude Agent SDK Integration | [ticket_004.md](tickets/ticket_004.md) |
| 5 | Docker + Coolify Deployment | [ticket_005.md](tickets/ticket_005.md) |
| 6 | Markdown Renderer + Code Blocks | [ticket_006.md](tickets/ticket_006.md) |
| 7 | Thinking Blocks | [ticket_007.md](tickets/ticket_007.md) |
| 8 | Tool Use Cards + Approval Flow | [ticket_008.md](tickets/ticket_008.md) |
| 9 | Tool Result Renderers | [ticket_009.md](tickets/ticket_009.md) |
| 10 | Agent/Subagent Display | [ticket_010.md](tickets/ticket_010.md) |
| 11 | System Message Components | [ticket_011.md](tickets/ticket_011.md) |
| 12 | Session Sidebar + Management | [ticket_012.md](tickets/ticket_012.md) |
| 13 | Mobile Layout | [ticket_013.md](tickets/ticket_013.md) |
| 14 | Deepgram Server Relay | [ticket_014.md](tickets/ticket_014.md) |
| 15 | Voice UI | [ticket_015.md](tickets/ticket_015.md) |
| 16 | PWA Setup | [ticket_016.md](tickets/ticket_016.md) |
| 17 | Mobile Polish | [ticket_017.md](tickets/ticket_017.md) |
| 18 | File Explorer Panel | [ticket_018.md](tickets/ticket_018.md) |
| 19 | Embedded Terminal | [ticket_019.md](tickets/ticket_019.md) |
| 20 | Theme System + Keyboard Shortcuts | [ticket_020.md](tickets/ticket_020.md) |

---

## Testing Strategy

Testing is integrated into every ticket (TDD skill is active). Each ticket specifies its test requirements.

| Test Type | Tool | Scope |
|-----------|------|-------|
| **Unit** | Vitest + Testing Library | Components, utilities, store logic |
| **Integration** | Vitest | WebSocket protocol, SDK message handling, auth flow |
| **E2E** | Playwright | Full user flows: login, start session, send message, approve tool, voice input |

---

## Deployment Strategy

- **Dev:** `pnpm dev` locally
- **Staging:** Docker build + run locally (`docker compose up`)
- **Production:** Push to git → Coolify auto-deploys from repo → Hetzner
