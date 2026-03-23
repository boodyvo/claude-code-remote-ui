# Ticket 020 — Theme System + Keyboard Shortcuts

**Phase:** 4 — Polish & Extended Features
**Effort:** M
**Depends on:** Ticket 1

## Summary

Implement the 3-state theme system (Light/Dark/System) with FOUC prevention, and desktop keyboard shortcuts for power users.

## Acceptance Criteria

### Theme System
- [ ] `ThemeToggle` component: 3-state segmented control (Light / Dark / System)
- [ ] Theme stored in `localStorage`, applied via `.dark` class on `<html>`
- [ ] FOUC prevention: inline `<script>` in `<head>` (before CSS) that reads localStorage and sets class
- [ ] Tailwind v4 dark variant: `@custom-variant dark (&:where(.dark, .dark *))`
- [ ] System preference detection via `prefers-color-scheme` media query
- [ ] All components respect dark theme (colors from design tokens)
- [ ] Smooth transition when switching themes (100ms transition on `background-color` and `color`)
- [ ] Theme persists across sessions (stored in localStorage)

### Keyboard Shortcuts (Desktop)
- [ ] `Cmd/Ctrl + K` — Focus input bar / clear input
- [ ] `Cmd/Ctrl + P` — Open file search (Ticket 18)
- [ ] `Cmd/Ctrl + N` — New session
- [ ] `Cmd/Ctrl + B` — Toggle sidebar
- [ ] `Cmd/Ctrl + J` — Toggle terminal panel (Ticket 19)
- [ ] `Cmd/Ctrl + Enter` — Send message
- [ ] `Escape` — Close any open dialog/drawer/overlay
- [ ] `Cmd/Ctrl + 1/2/3` — Switch tabs (Chat/Files/Terminal)
- [ ] `?` — Show keyboard shortcuts cheatsheet (when input not focused)
- [ ] Shortcuts disabled when text input is focused (except Cmd+Enter and Escape)

### Keyboard Shortcuts Cheatsheet
- [ ] Modal dialog listing all shortcuts
- [ ] Grouped by category: Navigation, Session, Input
- [ ] Triggered by `?` key or settings menu

## Implementation Notes

### FOUC Prevention Script (in layout.tsx <head>)
```html
<script dangerouslySetInnerHTML={{ __html: `
  (function() {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
`}} />
```

### Theme Hook
```typescript
function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    return (localStorage.getItem("theme") as any) || "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else if (theme === "light") root.classList.remove("dark");
    else {
      // System
      const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
```

### Keyboard Shortcut Handler
Global `keydown` listener registered in root layout. Check `event.metaKey || event.ctrlKey` for modifier. Skip when `event.target` is an input/textarea (except for Cmd+Enter and Escape).

## Tests

- [ ] **Unit:** ThemeToggle renders 3 states correctly
- [ ] **Unit:** Dark class applied/removed on <html> for each state
- [ ] **Unit:** System theme follows media query
- [ ] **Unit:** Theme persists in localStorage
- [ ] **Unit:** Keyboard shortcuts trigger correct actions
- [ ] **Unit:** Shortcuts disabled in text inputs (except exceptions)
- [ ] **Unit:** Cheatsheet modal opens on `?` key
- [ ] **Integration:** Theme switches all components correctly (no unstyled elements)
- [ ] **Visual:** No FOUC on page load in dark mode

## Files to Create

- `src/lib/theme.ts` (useTheme hook)
- `src/components/layout/theme-toggle.tsx`
- `src/lib/keyboard-shortcuts.ts` (global handler)
- `src/components/layout/shortcuts-dialog.tsx`
