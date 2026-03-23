"use client";

import { useEffect } from "react";
import { useAppStore } from "./store";

interface Shortcut {
  key: string;
  mod?: boolean; // Cmd/Ctrl
  label: string;
  category: string;
  action: () => void;
  allowInInput?: boolean;
}

export function useKeyboardShortcuts() {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  useEffect(() => {
    const shortcuts: Shortcut[] = [
      {
        key: "k",
        mod: true,
        label: "Focus input",
        category: "Input",
        action: () => {
          const input = document.querySelector<HTMLTextAreaElement>(
            'textarea[placeholder*="Message"]',
          );
          input?.focus();
        },
      },
      {
        key: "b",
        mod: true,
        label: "Toggle sidebar",
        category: "Navigation",
        action: () => setSidebarOpen(!sidebarOpen),
      },
      {
        key: "1",
        mod: true,
        label: "Chat tab",
        category: "Navigation",
        action: () => setActiveTab("chat"),
      },
      {
        key: "2",
        mod: true,
        label: "Files tab",
        category: "Navigation",
        action: () => setActiveTab("files"),
      },
      {
        key: "3",
        mod: true,
        label: "Terminal tab",
        category: "Navigation",
        action: () => setActiveTab("terminal"),
      },
      {
        key: "Escape",
        label: "Close dialog",
        category: "Navigation",
        allowInInput: true,
        action: () => {
          setSidebarOpen(false);
        },
      },
    ];

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        const modMatch = shortcut.mod
          ? e.metaKey || e.ctrlKey
          : !e.metaKey && !e.ctrlKey;

        if (e.key === shortcut.key && modMatch) {
          if (isInput && !shortcut.allowInInput) continue;
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSidebarOpen, sidebarOpen, setActiveTab]);
}

export const SHORTCUT_LIST = [
  { keys: ["Cmd", "K"], label: "Focus input", category: "Input" },
  { keys: ["Cmd", "B"], label: "Toggle sidebar", category: "Navigation" },
  { keys: ["Cmd", "1/2/3"], label: "Switch tabs", category: "Navigation" },
  { keys: ["Escape"], label: "Close dialog", category: "Navigation" },
  { keys: ["Cmd", "Enter"], label: "Send message", category: "Input" },
];
