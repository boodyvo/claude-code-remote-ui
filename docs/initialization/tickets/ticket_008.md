# Ticket 008 — Tool Use Cards + Approval Flow

**Phase:** 2 — Full Message Visualization
**Effort:** L
**Depends on:** Tickets 3, 4

## Summary

Build the generic tool use card component that wraps any tool invocation, and the approval flow (Accept/Reject buttons) that communicates decisions back to the server via WebSocket.

## Acceptance Criteria

- [ ] `ToolUseCard` component renders for any `tool_use` content block
  - Tool icon (per tool type) + tool name header
  - Collapsible input parameters display
  - Blue tint background (`--color-tool-bg`)
- [ ] `ToolApprovalBar` with Accept (green) and Reject (red) buttons
  - Buttons are 48px height (touch-friendly)
  - Disabled after user makes a decision
  - Shows "Approved" / "Rejected" state after decision
  - Sends `tool_response` WebSocket message on click
- [ ] `ToolSpinner` for tools in progress
  - Tool name + animated spinner + elapsed time counter (updates every second)
  - Appears between tool_use and tool_result
- [ ] `ToolSummaryChip` for collapsed batch tool summaries
  - Compact pill: "Read 5 files, Grep 2 searches"
  - Expandable to show individual tool cards
- [ ] Tool approval timeout: show warning after 2 minutes, auto-deny after 5 minutes
- [ ] Zustand integration: `pendingToolApprovals` array in store

## Implementation Notes

### ToolUseCard
```tsx
interface ToolUseCardProps {
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "running" | "completed";
  children?: React.ReactNode; // Tool result renderer goes here
}
```

### Tool Icons
Map tool names to icons:
- File tools (Read, Edit, Write, Glob): file icons
- Bash: terminal icon
- Grep: search icon
- Agent: bot icon
- WebSearch/WebFetch: globe icon
- MCP tools: puzzle piece icon

### Approval Communication
```typescript
// Browser → Server
ws.send({ type: "tool_response", toolUseId: "toolu_xxx", decision: "allow" });

// Server resolves the canUseTool promise
pendingApprovals.get(toolUseId).resolve({ behavior: "allow", updatedInput: input });
```

## Tests

- [ ] **Unit:** ToolUseCard renders tool name and icon correctly for each built-in tool
- [ ] **Unit:** Input params display is collapsible
- [ ] **Unit:** Accept button sends correct WebSocket message and transitions to "Approved" state
- [ ] **Unit:** Reject button sends correct WebSocket message and transitions to "Rejected" state
- [ ] **Unit:** Buttons disabled after decision (no double-submit)
- [ ] **Unit:** ToolSpinner shows elapsed time counting up
- [ ] **Unit:** ToolSummaryChip shows correct counts per tool type
- [ ] **Integration:** Full approval flow: card appears → user clicks Accept → server receives → tool executes → result renders

## Files to Create

- `src/components/tools/tool-use-card.tsx`
- `src/components/tools/tool-approval-bar.tsx`
- `src/components/tools/tool-spinner.tsx`
- `src/components/tools/tool-summary-chip.tsx`
- `src/lib/tool-icons.ts` (tool name → icon mapping)
