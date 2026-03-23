import { File, Folder } from "lucide-react";

interface FileListProps {
  files: string[];
  truncated?: boolean;
}

export function FileList({ files, truncated }: FileListProps) {
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
        <span>{files.length} files found</span>
        {truncated && (
          <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-yellow-600 dark:text-yellow-400">
            truncated
          </span>
        )}
      </div>
      <ul className="max-h-60 overflow-auto py-1">
        {files.map((file) => (
          <li
            key={file}
            className="flex items-center gap-2 px-3 py-0.5 font-mono text-xs"
          >
            <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{file}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
