# Ticket 018 — File Explorer Panel

**Phase:** 4 — Polish & Extended Features
**Effort:** L
**Depends on:** Ticket 4

## Summary

Build a file explorer panel accessible via the "Files" tab on mobile or a side panel on desktop. Allows browsing workspace files, viewing file contents, and navigating the project structure.

## Acceptance Criteria

- [ ] `FileExplorer` component:
  - Tree view with expand/collapse on directories
  - File type icons per extension
  - Current path as breadcrumb bar at top
  - Click on file → opens file preview (read-only)
- [ ] `FilePreview` component:
  - Syntax-highlighted content via Shiki (reuse `CodeViewer` from Ticket 6)
  - Filename + size + last modified in header
  - Line numbers
  - Read-only (no editing — Claude Code handles edits)
- [ ] File listing API (`GET /api/files?path=...`):
  - Returns directory contents for given path
  - Restricted to `/app/workspace` (no path traversal)
  - Returns: name, type (file/dir), size, modified date
- [ ] Search-to-open (command palette style):
  - `Cmd+P` / `Ctrl+P` shortcut opens search
  - Fuzzy search across all filenames in workspace
  - Select to preview
- [ ] On mobile: accessible via "Files" tab in bottom nav
- [ ] On desktop: toggleable side panel (right side)

## Security

- Path traversal prevention: all paths resolved and verified to be within `/app/workspace`
- No write operations — read-only file browser
- Symlink following disabled

## Tests

- [ ] **Unit:** Tree view expands/collapses directories
- [ ] **Unit:** File icons match extensions correctly
- [ ] **Unit:** Breadcrumb navigation works
- [ ] **Integration:** API returns correct directory listing
- [ ] **Integration:** API blocks path traversal attempts
- [ ] **Integration:** File preview loads and highlights content
- [ ] **E2E:** Browse → click file → see highlighted content

## Files to Create

- `src/components/layout/file-explorer.tsx`
- `src/components/layout/file-tree.tsx`
- `src/components/layout/file-preview.tsx`
- `src/components/layout/file-search.tsx`
- `src/app/api/files/route.ts`
