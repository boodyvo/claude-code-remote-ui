# Ticket 012 — Session Sidebar + Management

**Phase:** 2 — Full Message Visualization
**Effort:** L
**Depends on:** Ticket 4

## Summary

Build the session sidebar with session list, grouping, search, and management actions (new, resume, fork, delete). This is the primary navigation for multi-session workflows.

## Acceptance Criteria

- [ ] `SessionSidebar` — left sidebar on desktop, drawer on mobile
  - Width: 240px on desktop, full-width drawer on mobile
  - Collapsible via hamburger icon in top bar
- [ ] Session list with:
  - Grouped by date: Today, Yesterday, This Week, This Month, Older
  - Each entry shows: session name or first message (truncated), timestamp, model badge
  - Active session highlighted with accent color
  - Scrollable with virtualization for large session lists
- [ ] Search bar at top of sidebar
  - Filters sessions by name/content in real-time
  - Debounced (300ms)
- [ ] `NewSessionButton` at top of sidebar
  - Opens dialog to select working directory and optional session name
  - Directory picker shows contents of `/app/workspace`
- [ ] Session context actions (accessible via right-click on desktop, long-press on mobile):
  - Resume — opens selected session
  - Fork — creates copy, opens new session
  - Rename — inline edit
  - Delete — confirmation dialog, then removes session
- [ ] Session state in Zustand: `sessions`, `activeSessionId`, `loadingSessions`
- [ ] Auto-refresh session list on new session creation and every 60 seconds
- [ ] Pull-to-refresh on mobile

## Implementation Notes

### Session Data Source
```typescript
// From Claude Agent SDK
const sessions = await listSessions({ dir: "/app/workspace", limit: 100 });
// Returns: { sessionId, name, createdAt, lastActiveAt, ... }
```

### Session Grouping
```typescript
function groupByDate(sessions: SessionInfo[]): Record<string, SessionInfo[]> {
  const now = new Date();
  const groups: Record<string, SessionInfo[]> = {
    "Today": [],
    "Yesterday": [],
    "This Week": [],
    "This Month": [],
    "Older": [],
  };
  // ... classify by lastActiveAt
  return groups;
}
```

### Mobile Drawer
Use shadcn/ui `Sheet` or `Drawer` component. Trigger via hamburger in top bar or swipe-right from left edge.

## Tests

- [ ] **Unit:** Sessions grouped correctly by date
- [ ] **Unit:** Search filters sessions by name/content
- [ ] **Unit:** Active session highlighted
- [ ] **Unit:** New session dialog validates directory selection
- [ ] **Integration:** Creating new session appears in list immediately
- [ ] **Integration:** Deleting session removes from list and closes if active
- [ ] **Integration:** Forking session creates new entry and switches to it
- [ ] **E2E:** Full flow: open sidebar → search → select session → see messages load
- [ ] **Responsive:** Sidebar renders as drawer on mobile viewports

## Files to Create

- `src/components/session/session-sidebar.tsx`
- `src/components/session/session-list-item.tsx`
- `src/components/session/new-session-dialog.tsx`
- `src/components/session/session-actions.tsx`
- `src/components/session/session-search.tsx`
