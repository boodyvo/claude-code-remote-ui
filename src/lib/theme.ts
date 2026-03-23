"use client";

import { useEffect } from "react";
import { useAppStore } from "./store";
import type { Theme } from "./types";

export function useTheme() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);

      const mql = matchMedia("(prefers-color-scheme: dark)");
      const onChange = (e: MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches);
      };
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
