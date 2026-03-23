# Ticket 009 — Tool Result Renderers

**Phase:** 2 — Full Message Visualization
**Effort:** XL
**Depends on:** Tickets 6, 8

## Summary

Build specialized renderers for every built-in tool's output. Each tool returns a different data shape that needs purpose-built visualization.

## Acceptance Criteria

### File Operation Results
- [ ] `DiffViewer` — for Edit/Write results
  - Unified diff mode (default, only option on mobile)
  - Split diff mode (desktop, togglable)
  - Syntax highlighting via Shiki on both sides
  - Collapsible unchanged regions ("Show N hidden lines")
  - File path header with +/- line count summary
  - Green/red background for additions/deletions (`--color-diff-add`, `--color-diff-remove`)
- [ ] `NewFileViewer` — for Write results with `type: "create"`
  - Full file content with syntax highlighting
  - "New file" badge

### Terminal Results
- [ ] `TerminalOutput` — for Bash results
  - Dark background (`--color-terminal-bg`)
  - Monospace font
  - stdout in white/green, stderr in red
  - Max-height with "Show more" expand
  - Scrollable
  - "Interrupted" badge if `interrupted: true`
  - Copy button

### Search Results
- [ ] `FileList` — for Glob results
  - File type icons per extension
  - Indented list respecting path hierarchy
  - "N files found" header, "truncated" warning if applicable
- [ ] `SearchResults` — for Grep results
  - File path headers
  - Matched lines with line numbers
  - Search term highlighted within matches
  - Collapsible per-file

### Media Results
- [ ] `ImagePreview` — for Read results with `type: "image"`
  - Inline image display
  - Tap/click for lightbox (full-screen with pinch-to-zoom on mobile)
  - Max-width constrained to message bubble

### Interactive Results
- [ ] `TodoChecklist` — for TodoWrite results
  - Items with status icons: pending (grey circle), in_progress (blue spinner), completed (green check)
  - Shows diff between old and new todo lists
- [ ] `QuestionDialog` — for AskUserQuestion results
  - Radio buttons for single-choice questions
  - Text inputs for free-form questions
  - Submit button sends response via WebSocket

### Web Results
- [ ] `WebSearchResults` — for WebSearch tool results
  - Query displayed as header
  - Result cards with title, URL, snippet
  - Duration display
- [ ] `WebFetchResult` — for WebFetch tool results
  - URL header with status code badge
  - Content preview (rendered markdown or truncated text)
  - Byte count and duration

### Fallback
- [ ] `GenericToolResult` — for MCP tools and unknown tool types
  - Collapsible JSON tree viewer
  - Syntax-highlighted JSON
  - Copy raw JSON button

## Implementation Notes

### DiffViewer
Use `react-diff-viewer` library. Feed it `oldString` and `newString` from Edit tool results. Detect language from file extension for Shiki highlighting.

### Message Renderer Mapper (src/lib/message-renderer.ts)
```typescript
function getToolResultRenderer(toolName: string): React.ComponentType<ToolResultProps> {
  switch (toolName) {
    case "Edit": case "Write": return DiffViewer;
    case "Read": return ReadResultRenderer; // dispatches to CodeViewer/ImagePreview/etc.
    case "Bash": return TerminalOutput;
    case "Glob": return FileList;
    case "Grep": return SearchResults;
    case "TodoWrite": return TodoChecklist;
    case "AskUserQuestion": return QuestionDialog;
    case "WebSearch": return WebSearchResults;
    case "WebFetch": return WebFetchResult;
    case "Agent": return AgentCard; // Ticket 10
    default: return GenericToolResult;
  }
}
```

## Tests

- [ ] **Unit:** DiffViewer renders additions in green, deletions in red
- [ ] **Unit:** DiffViewer collapses unchanged regions
- [ ] **Unit:** DiffViewer shows unified mode on mobile viewport
- [ ] **Unit:** TerminalOutput separates stdout/stderr with correct colors
- [ ] **Unit:** TerminalOutput shows "Interrupted" badge when applicable
- [ ] **Unit:** FileList renders file icons by extension
- [ ] **Unit:** SearchResults highlights matched terms
- [ ] **Unit:** ImagePreview renders inline image with lightbox on click
- [ ] **Unit:** TodoChecklist shows correct status icons and diff
- [ ] **Unit:** QuestionDialog renders options and submits response
- [ ] **Unit:** GenericToolResult renders collapsible JSON tree
- [ ] **Unit:** Message renderer maps all known tools to correct components
- [ ] **Snapshot:** Each renderer matches expected output for sample data

## Files to Create

- `src/components/tools/diff-viewer.tsx`
- `src/components/tools/terminal-output.tsx`
- `src/components/tools/file-list.tsx`
- `src/components/tools/search-results.tsx`
- `src/components/tools/image-preview.tsx`
- `src/components/tools/todo-checklist.tsx`
- `src/components/tools/question-dialog.tsx`
- `src/components/tools/web-search-results.tsx`
- `src/components/tools/web-fetch-result.tsx`
- `src/components/tools/generic-tool-result.tsx`
- `src/lib/message-renderer.ts`

## Dependencies to Add

- `react-diff-viewer`
