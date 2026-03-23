"use client";

import { useState, useEffect, useCallback } from "react";
import { File, Folder, FolderOpen, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeViewer } from "@/components/tools/code-viewer";
import { cn } from "@/lib/utils";

interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  modified: string | null;
}

export function FileExplorer() {
  const [currentPath, setCurrentPath] = useState(".");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    content: string;
  } | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const loadDirectory = useCallback(async (path: string) => {
    const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.items);
      setCurrentPath(data.path);
    }
  }, []);

  useEffect(() => {
    loadDirectory(".");
  }, [loadDirectory]);

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2 text-xs">
        <button
          onClick={() => loadDirectory(".")}
          className="text-muted-foreground hover:text-foreground"
        >
          workspace
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              onClick={() =>
                loadDirectory(breadcrumbs.slice(0, i + 1).join("/"))
              }
              className="text-muted-foreground hover:text-foreground"
            >
              {crumb}
            </button>
          </span>
        ))}
      </div>

      {/* File list or preview */}
      {selectedFile ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs">
            <span className="font-mono">{selectedFile.name}</span>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <ScrollArea className="flex-1">
            <CodeViewer code={selectedFile.content} filename={selectedFile.name} />
          </ScrollArea>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="py-1">
            {currentPath !== "." && (
              <button
                onClick={() => {
                  const parent = currentPath.split("/").slice(0, -1).join("/") || ".";
                  loadDirectory(parent);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
              >
                <Folder className="h-4 w-4 text-muted-foreground" />
                ..
              </button>
            )}
            {entries.map((entry) => (
              <button
                key={entry.name}
                onClick={() => {
                  if (entry.type === "directory") {
                    const newPath =
                      currentPath === "."
                        ? entry.name
                        : `${currentPath}/${entry.name}`;
                    loadDirectory(newPath);
                  } else {
                    // Load file content
                    fetch(
                      `/api/files?path=${encodeURIComponent(
                        currentPath === "."
                          ? entry.name
                          : `${currentPath}/${entry.name}`,
                      )}&content=true`,
                    )
                      .then((r) => r.text())
                      .then((content) =>
                        setSelectedFile({ name: entry.name, content }),
                      );
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
              >
                {entry.type === "directory" ? (
                  <Folder className="h-4 w-4 text-blue-400" />
                ) : (
                  <File className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="flex-1 truncate text-left">{entry.name}</span>
                {entry.type === "file" && (
                  <span className="text-xs text-muted-foreground">
                    {formatSize(entry.size)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
