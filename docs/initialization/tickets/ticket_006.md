# Ticket 006 — Markdown Renderer + Code Blocks

**Phase:** 2 — Full Message Visualization
**Effort:** M
**Depends on:** Ticket 1

## Summary

Build a markdown renderer component that handles Claude's response text, including GitHub-flavored markdown and syntax-highlighted code blocks via Shiki. This is the foundation for all text-based message rendering.

## Acceptance Criteria

- [ ] `MarkdownRenderer` component renders GFM (tables, lists, headings, bold/italic, links, inline code)
- [ ] Fenced code blocks rendered with Shiki syntax highlighting
- [ ] Shiki configured with dual themes (light + dark) that switch with the app theme
- [ ] Code blocks include:
  - Language label (top-right)
  - Copy button (copies raw code)
  - Line numbers (optional, togglable)
  - Horizontal scroll (never wrap code)
- [ ] `CodeViewer` component for standalone file display (used by Read tool results)
  - Filename header bar
  - Shiki highlighting
  - Line numbers
  - Horizontal scroll
- [ ] Safe HTML rendering — no XSS from Claude's markdown output (sanitize with DOMPurify or rely on React's escaping)
- [ ] Links open in new tab with `rel="noopener noreferrer"`
- [ ] Dynamic import of Shiki (no SSR) to avoid hydration errors
- [ ] Monospace font: JetBrains Mono with `clamp(12px, 3.5vw, 16px)` on mobile

## Implementation Notes

### Shiki Setup
```typescript
import { createHighlighter } from "shiki";

const highlighter = await createHighlighter({
  themes: ["github-dark", "github-light"],
  langs: ["typescript", "javascript", "python", "go", "rust", "bash", "json", "yaml", "css", "html", "sql", "dockerfile"],
});
```

Lazy-load additional languages on demand. Use `dynamic(() => import(...), { ssr: false })`.

### Markdown Processing
Use `react-markdown` with `remark-gfm` plugin. Custom renderers for:
- `code` → Shiki-highlighted `CodeBlock` component
- `a` → External link with security attributes
- `pre` → Wrapper for code blocks

### CodeBlock Component
```tsx
interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
  showLineNumbers?: boolean;
}
```

## Tests

- [ ] **Unit:** Renders basic markdown (headings, bold, lists, tables)
- [ ] **Unit:** Code blocks show correct syntax highlighting for TypeScript, Python, Go
- [ ] **Unit:** Copy button copies raw code to clipboard
- [ ] **Unit:** Links render with correct security attributes
- [ ] **Unit:** No XSS from malicious markdown input (script tags, event handlers)
- [ ] **Snapshot:** CodeViewer renders correctly with filename header
- [ ] **Visual:** Dark and light themes switch correctly on code blocks

## Files to Create

- `src/components/chat/markdown-renderer.tsx`
- `src/components/chat/code-block.tsx`
- `src/components/tools/code-viewer.tsx`
- `src/lib/shiki.ts` (highlighter setup + lazy loading)

## Dependencies to Add

- `react-markdown`
- `remark-gfm`
- `shiki`
- `dompurify` + `@types/dompurify` (if needed beyond React escaping)
