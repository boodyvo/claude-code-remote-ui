"use client";

import { CodeBlock } from "@/components/chat/code-block";

interface CodeViewerProps {
  code: string;
  filename: string;
  language?: string;
}

function inferLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    go: "go",
    rs: "rust",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    css: "css",
    html: "html",
    sql: "sql",
    md: "markdown",
    dockerfile: "dockerfile",
    toml: "toml",
    xml: "xml",
  };
  return map[ext] || "text";
}

export function CodeViewer({ code, filename, language }: CodeViewerProps) {
  const lang = language || inferLanguage(filename);

  return (
    <CodeBlock
      code={code}
      language={lang}
      filename={filename}
      showLineNumbers
    />
  );
}
