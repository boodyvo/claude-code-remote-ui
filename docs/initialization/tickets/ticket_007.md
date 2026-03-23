# Ticket 007 — Thinking Blocks

**Phase:** 2 — Full Message Visualization
**Effort:** S
**Depends on:** Ticket 6

## Summary

Implement collapsible thinking/reasoning blocks that display Claude's extended thinking content, and a redacted thinking placeholder.

## Acceptance Criteria

- [ ] `ThinkingBlock` component renders thinking content in a collapsible section
- [ ] Visual style: amber tint background (`--color-thinking`), italic text, dimmed opacity
- [ ] Shows thinking duration (calculated from stream timestamps)
- [ ] Default state: **collapsed on mobile**, **expanded on desktop**
- [ ] Collapse/expand animation (smooth height transition)
- [ ] Header shows "Thinking (3.2s)" with chevron indicator
- [ ] `RedactedBlock` component for `redacted_thinking` content blocks
  - Locked icon + "Reasoning hidden" label
  - Non-expandable, muted styling
- [ ] Renders markdown within thinking content (reuses `MarkdownRenderer` from Ticket 6)

## Implementation Notes

### ThinkingBlock
```tsx
interface ThinkingBlockProps {
  content: string;
  durationMs?: number;
  defaultExpanded?: boolean;
}
```

Use shadcn/ui `Collapsible` component as the base. Override with custom styling for the amber tint.

### RedactedBlock
Simple static card — no interactivity needed.

### Duration Calculation
Track `content_block_start` and `content_block_stop` stream events for thinking blocks to calculate duration. Pass as prop.

## Tests

- [ ] **Unit:** ThinkingBlock renders content when expanded
- [ ] **Unit:** ThinkingBlock shows "Thinking (Xs)" header with correct duration
- [ ] **Unit:** Click toggles collapse/expand state
- [ ] **Unit:** RedactedBlock shows lock icon and non-expandable message
- [ ] **Unit:** Markdown content inside thinking blocks renders correctly
- [ ] **Responsive:** Default collapsed on viewports < 768px

## Files to Create

- `src/components/chat/thinking-block.tsx`
- `src/components/chat/redacted-block.tsx`
