// Default programming vocabulary for Deepgram keyterm prompting
export const DEFAULT_KEYTERMS = [
  // JavaScript/TypeScript
  "async", "await", "const", "let", "function", "interface", "type",
  "import", "export", "component", "useState", "useEffect", "useCallback",
  "useRef", "useMemo", "React", "Next.js", "TypeScript", "JavaScript",
  // General programming
  "API", "REST", "GraphQL", "WebSocket", "JSON", "YAML", "SQL",
  "endpoint", "middleware", "module", "package", "dependency",
  "repository", "commit", "branch", "merge", "rebase",
  "refactor", "deploy", "container", "Docker", "Kubernetes",
  // Claude-specific
  "Claude", "Anthropic", "MCP", "tool use", "thinking", "streaming",
  "session", "prompt", "token", "model", "Opus", "Sonnet", "Haiku",
];

export function getKeyterms(additionalTerms?: string[]): string[] {
  return [...DEFAULT_KEYTERMS, ...(additionalTerms || [])];
}
