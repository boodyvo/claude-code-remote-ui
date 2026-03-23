# Ticket 001 — Project Scaffold

**Phase:** 1 — Foundation
**Effort:** M
**Depends on:** —

## Summary

Initialize the Next.js 15 project with App Router, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, and the core file structure.

## Acceptance Criteria

- [ ] Next.js 15 project with App Router and `output: "standalone"` in next.config.ts
- [ ] TypeScript strict mode enabled
- [ ] Tailwind CSS v4 with CSS-first config (`@theme {}` design tokens in `src/styles/app.css`)
- [ ] shadcn/ui initialized with base components: button, card, dialog, drawer, input, scroll-area, toast
- [ ] Zustand store skeleton (`src/lib/store.ts`) with typed interface
- [ ] pnpm as package manager, lockfile committed
- [ ] ESLint + Prettier configured
- [ ] Root layout (`src/app/layout.tsx`) with fonts (Inter + JetBrains Mono), metadata, viewport
- [ ] Health check API route (`src/app/api/health/route.ts`)
- [ ] `.gitignore` covering node_modules, .next, .env*, data/
- [ ] Design tokens defined per §6.1 of product design (colors, typography, spacing, breakpoints)

## Implementation Notes

### next.config.ts
```typescript
const config: NextConfig = {
  output: "standalone",
  // WebSocket support works natively in standalone mode
};
```

### Design Tokens (src/styles/app.css)
Implement the full `@theme {}` block from product design §6.1 including:
- Semantic colors (background, foreground, muted, accent, destructive, success, warning)
- Claude-specific colors (thinking, tool-bg, diff-add, diff-remove, terminal-bg, voice-active)
- Typography (sans: Inter, mono: JetBrains Mono)
- Dark theme overrides via `@media (prefers-color-scheme: dark)`

### Zustand Store (src/lib/store.ts)
Skeleton matching the interface from product design §11:
```typescript
interface AppState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  sessionMessages: Record<string, SDKMessage[]>;
  streamBuffer: string;
  isStreaming: boolean;
  pendingToolApprovals: ToolApproval[];
  isRecording: boolean;
  interimTranscript: string;
  audioLevel: number;
  sidebarOpen: boolean;
  activeTab: "chat" | "files" | "terminal";
  theme: "light" | "dark" | "system";
  // Actions defined as stubs
}
```

### File Structure
Create the directory layout from product design §12 (empty dirs with .gitkeep where needed).

## Tests

- [ ] Health check API returns 200 with `{ status: "ok" }`
- [ ] Zustand store initializes with correct defaults
- [ ] App renders without errors (smoke test)
- [ ] Tailwind classes compile correctly (design tokens resolve)

## Files to Create

- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `src/styles/app.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/api/health/route.ts`
- `src/lib/store.ts`
- `src/lib/types.ts` (shared TypeScript types)
- `.gitignore`
- `.eslintrc.json`
- `.prettierrc`
