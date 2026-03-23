# Ticket 013 — Mobile Layout

**Phase:** 3 — Voice & Mobile
**Effort:** L
**Depends on:** Ticket 12

## Summary

Implement the mobile-first responsive layout: bottom navigation, drawer sidebar, responsive breakpoints, and the core layout shell that adapts between mobile and desktop.

## Acceptance Criteria

- [ ] `TopBar` — fixed top, 48px height
  - Hamburger menu (mobile) / always visible (desktop)
  - Session name (truncated, tappable to rename)
  - Settings gear icon
  - Compact session info (model, mode) on desktop
- [ ] `BottomNav` — fixed bottom, 56px height, mobile only (<768px)
  - 3 tabs: Chat, Files, Terminal
  - Active tab highlighted with accent color
  - Safe-area-inset-bottom padding for notched devices
  - Hidden on desktop (sidebar handles navigation)
- [ ] Responsive layout breakpoints:
  - Mobile (<768px): bottom nav, drawer sidebar, full-width content
  - Tablet (768–1024px): collapsible sidebar, no bottom nav
  - Desktop (>1024px): persistent sidebar, full layout
- [ ] Session sidebar as slide-out `Drawer` on mobile (from left edge)
- [ ] `MessageStream` component:
  - Auto-scrolling message area that anchors to bottom
  - "New messages" button when scrolled up and new messages arrive
  - Smooth scroll on new message, instant scroll on user send
- [ ] `InputBar` — fixed above bottom nav (mobile) or at bottom of content area (desktop)
  - Auto-resizing textarea
  - Send button (accent color)
  - Mic button (Ticket 15 will implement)
  - Position adapts when virtual keyboard opens
- [ ] `UserBubble` and `AssistantBubble` — message containers
  - User: right-aligned, accent background
  - Assistant: left-aligned, card background, full-width content

## Implementation Notes

### Layout Structure
```tsx
// Mobile
<div className="flex flex-col h-dvh">
  <TopBar />
  <main className="flex-1 overflow-hidden">
    {activeTab === "chat" && <MessageStream />}
    {activeTab === "files" && <FileExplorer />}   // Ticket 18
    {activeTab === "terminal" && <TerminalPanel />} // Ticket 19
  </main>
  <InputBar />   {/* only shown on chat tab */}
  <BottomNav />
</div>

// Desktop
<div className="flex h-dvh">
  <SessionSidebar />
  <div className="flex-1 flex flex-col">
    <TopBar />
    <MessageStream />
    <InputBar />
  </div>
</div>
```

### Dynamic Viewport Height
Use `h-dvh` (dynamic viewport height) instead of `h-screen` for correct behavior on mobile browsers where the address bar height changes.

### Auto-Scroll Behavior
```typescript
const containerRef = useRef<HTMLDivElement>(null);
const isNearBottom = useRef(true);

// Track scroll position
const onScroll = () => {
  const el = containerRef.current;
  isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
};

// Auto-scroll on new message only if user is near bottom
useEffect(() => {
  if (isNearBottom.current) {
    containerRef.current?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }
}, [messages.length]);
```

## Tests

- [ ] **Unit:** BottomNav renders 3 tabs with correct active state
- [ ] **Unit:** TopBar shows hamburger on mobile, hides on desktop
- [ ] **Unit:** UserBubble right-aligned, AssistantBubble left-aligned
- [ ] **Unit:** InputBar auto-resizes textarea on content change
- [ ] **Responsive:** Layout switches between mobile/tablet/desktop at breakpoints
- [ ] **Responsive:** BottomNav hidden on desktop viewports
- [ ] **Responsive:** Sidebar renders as drawer on mobile
- [ ] **Integration:** Auto-scroll anchors to bottom on new message
- [ ] **Integration:** "New messages" button appears when scrolled up
- [ ] **E2E:** Full mobile flow: tap through bottom nav tabs, open sidebar drawer

## Files to Create

- `src/components/layout/top-bar.tsx`
- `src/components/layout/bottom-nav.tsx`
- `src/components/chat/message-stream.tsx`
- `src/components/chat/input-bar.tsx`
- `src/components/chat/user-bubble.tsx`
- `src/components/chat/assistant-bubble.tsx`
