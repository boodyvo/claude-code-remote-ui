"use client";

import { useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  oldValue: string;
  newValue: string;
  filename: string;
  additions?: number;
  deletions?: number;
}

export function DiffViewer({
  oldValue,
  newValue,
  filename,
  additions,
  deletions,
}: DiffViewerProps) {
  const [splitView, setSplitView] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between bg-muted px-3 py-1.5 text-xs">
        <span className="font-mono">{filename}</span>
        <div className="flex items-center gap-2">
          {additions !== undefined && (
            <span className="text-green-600 dark:text-green-400">
              +{additions}
            </span>
          )}
          {deletions !== undefined && (
            <span className="text-red-600 dark:text-red-400">
              -{deletions}
            </span>
          )}
          <button
            onClick={() => setSplitView(!splitView)}
            className="hidden rounded px-1.5 py-0.5 hover:bg-accent md:block"
          >
            {splitView ? "Unified" : "Split"}
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto text-xs">
        <ReactDiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={splitView}
          compareMethod={DiffMethod.WORDS}
          useDarkTheme
          hideLineNumbers={false}
          styles={{
            contentText: {
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
            },
          }}
        />
      </div>
    </div>
  );
}
