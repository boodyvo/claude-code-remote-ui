---
name: security-review
description: Run a comprehensive security review of the claude-connector codebase. Covers auth, WebSocket, input validation, data storage, deployment, dependencies, and frontend security. Use when asked to "review security", "security audit", "check for vulnerabilities", or "/security-review".
user_invocable: true
---

# Security Review Skill — claude-connector

Run a systematic, in-depth security audit of the claude-connector project. This skill is tailored to this specific codebase's architecture: Next.js + custom WebSocket server + Claude Agent SDK + Deepgram voice relay + SQLite + Docker.

## Execution Steps

### Step 1: Scope & Architecture Refresh

Read these files to understand current state:
- `server.ts` — entry point, env var handling
- `src/server/auth.ts` — JWT, password hashing, rate limiting, cookie config
- `src/server/ws-server.ts` — WebSocket upgrade, auth, origin validation
- `src/server/ws-handler.ts` — all message handlers, input flows
- `src/server/session-manager.ts` — Claude SDK integration
- `src/server/deepgram-relay.ts` — voice relay
- `src/server/db.ts` — SQLite database
- `src/middleware.ts` — Next.js middleware auth gate
- `src/app/api/auth/route.ts` — login/setup endpoint
- `src/app/api/auth/ws-token/route.ts` — WS token exchange
- `src/app/api/files/route.ts` — file browser API
- `src/app/api/health/route.ts` — health check
- `Dockerfile`, `docker-compose.yml` — deployment
- `package.json`, `pnpm-lock.yaml` — dependencies
- `next.config.ts` — Next.js config

### Step 2: Audit Checklist

For EACH category below, read the relevant files and check every item. Report findings with severity, file:line, and fix recommendation.

#### 2.1 Authentication & Session Management
- [ ] `SESSION_SECRET` — is it required in production? Does it fail startup if missing?
- [ ] JWT signing — algorithm explicitly set? Expiry appropriate?
- [ ] WS token — is it short-lived (< 2 min)? Separate from session token?
- [ ] Password hashing — Argon2id with reasonable parameters?
- [ ] Cookie attributes — `HttpOnly`, `Secure` (production), `SameSite`, `Path`, `Max-Age`
- [ ] Session fixation — is a new token issued after login?
- [ ] Rate limiting — is it enforced on login? Is the IP source trustworthy?
- [ ] Logout — does it clear the cookie properly?

#### 2.2 WebSocket Security
- [ ] Auth on upgrade — is the token verified before connection?
- [ ] Origin validation — is `ALLOWED_ORIGINS` enforced when set?
- [ ] Message size limit — is `maxPayload` set on WebSocketServer?
- [ ] Binary message handling — are binary frames handled safely?
- [ ] Rate limiting — is there per-connection message throttling?
- [ ] Client cleanup — are stale connections cleaned up?

#### 2.3 Input Validation
- [ ] `cwd` in `new_session` — validated within workspace root?
- [ ] `sessionId` — validated as UUID format?
- [ ] `content` in `send_message` — any length limit?
- [ ] `toolUseId` in `tool_response` — scoped to correct session?
- [ ] `mode` in `set_permission_mode` — is `bypassPermissions` gated?
- [ ] `path` in `/api/files` — path traversal prevented?
- [ ] Audio data — size limits enforced?

#### 2.4 XSS & Frontend Injection
- [ ] `dangerouslySetInnerHTML` usage — is input sanitized (Shiki in code-block.tsx)?
- [ ] Markdown rendering — does react-markdown escape HTML by default?
- [ ] User message display — is content escaped?
- [ ] `window.location` assignments — any user-controlled redirects?

#### 2.5 Data Storage
- [ ] SQL queries — are all parameterized (`?` placeholders)?
- [ ] Database path — is it within expected directory?
- [ ] Password storage — only hashes stored, never plaintext?
- [ ] Sensitive data in responses — are secrets/tokens ever leaked?

#### 2.6 Server-Side
- [ ] Outbound connections — only to known hosts (Deepgram, Anthropic)?
- [ ] API key exposure — `DEEPGRAM_API_KEY` never sent to client?
- [ ] `ANTHROPIC_API_KEY` — explicitly deleted to prevent API usage?
- [ ] Error messages — do they leak internal paths/stack traces?
- [ ] Health endpoint — does it expose minimal info?

#### 2.7 Dependencies
- [ ] Lockfile present and up to date?
- [ ] Any known CVEs in current dependency versions?
- [ ] Run `pnpm audit` if available
- [ ] Check for abandoned/unmaintained packages

#### 2.8 Docker & Deployment
- [ ] Container runs as non-root user?
- [ ] No secrets baked into image?
- [ ] Multi-stage build (no source/devDeps in prod image)?
- [ ] Volumes properly scoped?
- [ ] Claude credentials mount — read-only if possible?
- [ ] HTTPS required for production (mic access needs it)?

#### 2.9 Security Headers
- [ ] Content-Security-Policy — configured?
- [ ] X-Content-Type-Options — set to `nosniff`?
- [ ] X-Frame-Options — set to `DENY` or `SAMEORIGIN`?
- [ ] Strict-Transport-Security — set for HTTPS?
- [ ] Referrer-Policy — configured?

### Step 3: Output Format

Generate a structured report:

```
# Security Review Report — claude-connector
Date: YYYY-MM-DD

## Summary
- Critical: N | High: N | Medium: N | Low: N | Info: N

## Findings

### [SEVERITY] Title
- **File:** path/to/file.ts:line
- **Category:** (auth / websocket / input / xss / storage / server / deps / docker / headers)
- **Description:** What the vulnerability is
- **Impact:** What an attacker could do
- **Fix:** Specific code change needed
- **Status:** NEW | FIXED | ACKNOWLEDGED

## Previously Fixed Issues
(List issues from prior audits that have been resolved)

## Recommendations
(Prioritized list of next security improvements)
```

### Step 4: Track Progress

After generating the report, save a summary to `.claude/security-review-latest.md` so future reviews can diff against it.

## Known Architecture-Specific Risks

These are inherent to the claude-connector design and should always be checked:

1. **Claude SDK has system-level access** — it can read/write files and execute commands on the server. The `bypassPermissions` mode disables all safety checks.
2. **Single-user auth model** — there's one password, one user. No RBAC.
3. **Host credential mounting** — Docker mounts `~/.claude` from the host, exposing OAuth tokens.
4. **Browser mic requires HTTPS** — deploying without TLS breaks voice dictation.
5. **WebSocket carries all control messages** — a compromised WS connection has full API access.
