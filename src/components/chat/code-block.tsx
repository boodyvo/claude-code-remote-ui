"use client";

import { useState, useEffect, useCallback } from "react";
import { highlight } from "@/lib/shiki";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language,
  filename,
  showLineNumbers = false,
}: CodeBlockProps) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Detect theme from document
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    highlight(code, language, theme).then(setHtml);
  }, [code, language, theme]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border bg-[var(--color-terminal-bg)]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span>{filename || language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div
        className={cn(
          "overflow-x-auto font-mono text-[clamp(12px,3.5vw,16px)]",
          "[&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!p-4",
          "[&_pre]:!bg-transparent",
          showLineNumbers && "[&_.line]:before:mr-4 [&_.line]:before:inline-block [&_.line]:before:w-8 [&_.line]:before:text-right [&_.line]:before:text-muted-foreground [&_.line]:before:content-[counter(line)] [&_pre]:counter-reset-[line] [&_.line]:counter-increment-[line]",
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
