# Ticket 017 — Mobile Polish

**Phase:** 3 — Voice & Mobile
**Effort:** M
**Depends on:** Ticket 13

## Summary

Implement mobile-specific UX enhancements: touch gestures, virtual keyboard handling, code symbol toolbar, and optimized code/diff viewing on small screens.

## Acceptance Criteria

- [ ] **Gesture support:**
  - Swipe right from left edge → open session sidebar drawer
  - Swipe left on message → reveal action buttons (Copy, Retry, Delete)
  - Long-press on session in sidebar → show context menu (Fork, Rename, Delete)
  - Pull-to-refresh on session list
  - Pinch-to-zoom on code blocks, diffs, and images
- [ ] **Virtual keyboard handling:**
  - Input bar repositions above keyboard using `visualViewport` API
  - Chat content doesn't jump when keyboard opens/closes
  - Smooth transition animation
  - Bottom nav hidden when keyboard is open
- [ ] **Code symbol toolbar** (`CodeSymbolToolbar`):
  - Floating bar above virtual keyboard when text input is focused
  - Buttons: `{ } [ ] ( ) ; : " ' / = < > _ .`
  - Tapping inserts character at cursor position
  - Horizontally scrollable if needed
  - Only shown on mobile (<768px)
- [ ] **Touch-optimized code viewing:**
  - Horizontal scroll on code blocks (never wrap)
  - Font size: `clamp(12px, 3.5vw, 16px)` for monospace
  - Copy button always visible on code blocks (no hover dependency)
  - Diffs forced to unified view on mobile
- [ ] **Full-screen diff viewer:**
  - Tapping "View Diff" on mobile opens a bottom sheet / full-screen overlay
  - Close via swipe-down or X button
  - Better readability than inline on narrow screens
- [ ] All interactive elements: **48px minimum** touch targets

## Implementation Notes

### Gesture Library
Use native touch events or a lightweight library like `@use-gesture/react`. Avoid heavy libraries.

### Virtual Keyboard Detection
```typescript
useEffect(() => {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const onResize = () => {
    const keyboardHeight = window.innerHeight - viewport.height;
    document.documentElement.style.setProperty("--keyboard-height", `${keyboardHeight}px`);
    document.documentElement.style.setProperty("--keyboard-open", keyboardHeight > 100 ? "1" : "0");
  };

  viewport.addEventListener("resize", onResize);
  return () => viewport.removeEventListener("resize", onResize);
}, []);
```

### CSS for Keyboard-Aware Layout
```css
.input-bar {
  position: fixed;
  bottom: calc(
    var(--keyboard-open, 0) * var(--keyboard-height, 0px) +
    (1 - var(--keyboard-open, 0)) * 56px  /* bottom nav height */
  );
}

.bottom-nav {
  display: var(--keyboard-open, 0) == 1 ? none : flex;
  /* Or use opacity/transform for smoother transition */
}
```

### Swipe-to-Reveal Actions
Implement with CSS `transform: translateX()` on touch events. Reveal 2-3 action buttons behind the message.

## Tests

- [ ] **Unit:** CodeSymbolToolbar inserts character at cursor position
- [ ] **Unit:** CodeSymbolToolbar hidden on desktop
- [ ] **Unit:** Full-screen diff opens as overlay on mobile
- [ ] **Integration:** Virtual keyboard detection sets CSS custom properties
- [ ] **Integration:** Input bar repositions when keyboard opens
- [ ] **Integration:** Bottom nav hides when keyboard opens
- [ ] **E2E:** Swipe right from left edge opens sidebar
- [ ] **E2E:** Long-press on session shows context menu

## Files to Create

- `src/components/chat/code-symbol-toolbar.tsx`
- `src/components/tools/fullscreen-diff.tsx`
- `src/lib/gestures.ts` (gesture utilities)
- `src/lib/keyboard.ts` (virtual keyboard detection hook)
