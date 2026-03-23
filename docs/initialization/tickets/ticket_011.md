# Ticket 011 — System Message Components

**Phase:** 2 — Full Message Visualization
**Effort:** M
**Depends on:** Ticket 6

## Summary

Build components for all system-level messages: status indicators, retry banners, rate limit warnings, compact boundaries, error displays, and cost tracking.

## Acceptance Criteria

- [ ] `SessionHeader` — rendered from `system/init` message
  - Model name, permission mode badge, Claude Code version
  - Available tools count, MCP servers count
  - Compact bar below top navigation
- [ ] `StatusIndicator` — from `system/status`
  - Subtle top-of-page progress bar for "Compacting..."
  - Permission mode change notification
- [ ] `CompactDivider` — from `system/compact_boundary`
  - Horizontal rule with "Context compacted" label
  - Dimmed styling, non-interactive
- [ ] `RetryBanner` — from `system/api_retry`
  - Yellow banner with error type and retry countdown
  - Auto-dismisses when retry succeeds
  - Shows attempt number: "Retry 2/5 in 3s... (rate_limit)"
- [ ] `RateLimitBanner` — from `rate_limit_event`
  - Warning (yellow) for `allowed_warning`
  - Error (red) for `rejected`
  - Shows utilization percentage and reset time
- [ ] `ErrorBanner` — from `result/error_*`
  - Red banner for: max turns reached, budget exceeded, execution error
  - Shows error details and suggested action
- [ ] `CostDisplay` — from `result/success`
  - Inline display: "$0.42 · 12.3K tokens · 2m 15s · 8 turns"
  - Per-model breakdown if multiple models used (from `modelUsage`)
- [ ] `HookIndicator` — from `system/hook_*`
  - Small inline indicator: hook name + status
  - Expandable stdout/stderr on hook_progress
- [ ] `AuthStatusDisplay` — from `auth_status`
  - Full-screen modal if re-authentication needed
  - Progress indicator during auth flow
- [ ] `PromptSuggestion` — from `prompt_suggestion`
  - Clickable chip/button
  - Clicking inserts suggestion into input bar

## Tests

- [ ] **Unit:** SessionHeader renders model name and permission mode
- [ ] **Unit:** RetryBanner shows countdown and auto-dismisses
- [ ] **Unit:** RateLimitBanner distinguishes warning vs error state
- [ ] **Unit:** ErrorBanner renders correct message for each error subtype
- [ ] **Unit:** CostDisplay formats tokens (K/M suffixes) and USD correctly
- [ ] **Unit:** PromptSuggestion click dispatches to input bar
- [ ] **Unit:** CompactDivider renders as non-interactive separator

## Files to Create

- `src/components/system/session-header.tsx`
- `src/components/system/status-indicator.tsx`
- `src/components/system/compact-divider.tsx`
- `src/components/system/retry-banner.tsx`
- `src/components/system/rate-limit-banner.tsx`
- `src/components/system/error-banner.tsx`
- `src/components/system/cost-display.tsx`
- `src/components/system/hook-indicator.tsx`
- `src/components/system/auth-status-display.tsx`
- `src/components/chat/prompt-suggestion.tsx`
