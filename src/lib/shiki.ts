import { createHighlighter, type Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

const PRELOADED_LANGS = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "bash",
  "json",
  "yaml",
  "css",
  "html",
  "sql",
  "dockerfile",
  "tsx",
  "jsx",
  "markdown",
] as const;

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: [...PRELOADED_LANGS],
    });
  }
  return highlighterPromise;
}

export async function highlight(
  code: string,
  lang: string,
  theme: "light" | "dark" = "dark",
): Promise<string> {
  const highlighter = await getHighlighter();
  const loadedLangs = highlighter.getLoadedLanguages();

  // Load language on demand if not preloaded
  if (!loadedLangs.includes(lang as never)) {
    try {
      await highlighter.loadLanguage(lang as never);
    } catch {
      // Fall back to plaintext
      lang = "text";
    }
  }

  return highlighter.codeToHtml(code, {
    lang,
    theme: theme === "dark" ? "github-dark" : "github-light",
  });
}
