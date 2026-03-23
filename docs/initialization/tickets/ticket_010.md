# Ticket 010 — Agent/Subagent Display

**Phase:** 2 — Full Message Visualization
**Effort:** M
**Depends on:** Ticket 8

## Summary

Build components to display subagent (Task/Agent tool) invocations and background task notifications.

## Acceptance Criteria

- [ ] `AgentCard` component with 3 states:
  - **Started** (`task_started`): Description + spinner + "Running..." badge
  - **Progress** (`task_progress`): Description + last tool used + token usage
  - **Completed** (`task_notification`): Summary + status badge (completed/failed/stopped) + usage stats
- [ ] `AgentProgress` compact bar for background tasks
  - Inline in message stream: agent description + spinner + last tool name
  - Collapsible to show full progress history
- [ ] Nested agent display:
  - If agent result includes messages, render them indented within the card
  - Visual nesting with left border + indentation
- [ ] Failed agents show error summary in red
- [ ] Completed agents show summary text + cost

## Implementation Notes

### AgentCard
```tsx
interface AgentCardProps {
  taskId: string;
  description: string;
  status: "running" | "completed" | "failed" | "stopped";
  summary?: string;
  usage?: { input_tokens: number; output_tokens: number };
  lastToolName?: string;
  children?: React.ReactNode; // nested messages
}
```

### SDK Messages Handled
- `system/task_started` → create AgentCard in "running" state
- `system/task_progress` → update AgentCard with progress
- `system/task_notification` → finalize AgentCard with status + summary

## Tests

- [ ] **Unit:** AgentCard renders "Running..." with spinner for started state
- [ ] **Unit:** AgentCard shows last tool name during progress
- [ ] **Unit:** AgentCard shows summary and status badge on completion
- [ ] **Unit:** Failed state shows red error styling
- [ ] **Unit:** Nested messages render indented within card

## Files to Create

- `src/components/agents/agent-card.tsx`
- `src/components/agents/agent-progress.tsx`
