# Ticket 002 — Auth System

**Phase:** 1 — Foundation
**Effort:** M
**Depends on:** Ticket 1

## Summary

Implement single-user password authentication with Argon2 hashing, JWT session cookies, and SQLite storage. First-run setup flow for initial password creation.

## Acceptance Criteria

- [ ] SQLite database auto-created at `DATABASE_PATH` (default: `/app/data/connector.db`)
- [ ] First-visit detection: if no user exists, redirect to `/setup`
- [ ] Setup page: create password (min 8 chars, confirmation field)
- [ ] Password stored as Argon2id hash in SQLite
- [ ] Login page at `/login` with password field
- [ ] On successful login: set HttpOnly, Secure, SameSite=Strict session cookie containing signed JWT (7-day expiry)
- [ ] Middleware protecting all routes except `/login`, `/setup`, `/api/health`
- [ ] Logout endpoint (`POST /api/auth/logout`) clearing the cookie
- [ ] Rate limiting on login: max 5 attempts per minute per IP
- [ ] `SESSION_SECRET` env var required (used for JWT signing)

## Implementation Notes

### Database (src/server/db.ts)
```typescript
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_PATH || "./data/connector.db");
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);
```

### Auth (src/server/auth.ts)
- Use `argon2` package with `argon2id` variant
- JWT signed with `jsonwebtoken` package, RS256 or HS256 with `SESSION_SECRET`
- Cookie: `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`

### Middleware (src/middleware.ts)
Next.js middleware checking for valid session cookie on protected routes. Redirect to `/login` if missing/expired. Redirect to `/setup` if no user exists (check via API).

### Rate Limiting
In-memory store (Map) tracking login attempts by IP. Reset after 60 seconds. Return 429 on excess.

## Security Considerations

- Never log passwords or hashes
- Constant-time comparison for password verification (Argon2 handles this)
- JWT payload contains only `{ userId: 1 }` — no sensitive data
- Session cookie not accessible from JavaScript (HttpOnly)
- CSRF protection via SameSite=Strict

## Tests

- [ ] **Unit:** Argon2 hash + verify round-trip
- [ ] **Unit:** JWT sign + verify with valid/expired/invalid tokens
- [ ] **Integration:** Setup flow creates user in DB
- [ ] **Integration:** Login with correct password returns session cookie
- [ ] **Integration:** Login with wrong password returns 401
- [ ] **Integration:** Protected routes redirect to /login without cookie
- [ ] **Integration:** Rate limiting blocks after 5 failed attempts
- [ ] **E2E:** Full setup → login → access protected page flow

## Files to Create/Modify

- `src/server/db.ts`
- `src/server/auth.ts`
- `src/app/login/page.tsx`
- `src/app/setup/page.tsx`
- `src/app/api/auth/route.ts`
- `src/middleware.ts`

## Dependencies to Add

- `better-sqlite3` + `@types/better-sqlite3`
- `argon2`
- `jsonwebtoken` + `@types/jsonwebtoken`
