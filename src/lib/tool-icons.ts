import {
  File,
  FileEdit,
  FilePlus,
  FolderSearch,
  Search,
  Terminal,
  Bot,
  Globe,
  Puzzle,
  Eye,
  type LucideIcon,
} from "lucide-react";

const TOOL_ICON_MAP: Record<string, LucideIcon> = {
  Read: Eye,
  Edit: FileEdit,
  Write: FilePlus,
  Glob: FolderSearch,
  Grep: Search,
  Bash: Terminal,
  Agent: Bot,
  WebSearch: Globe,
  WebFetch: Globe,
  LSP: File,
};

export function getToolIcon(toolName: string): LucideIcon {
  return TOOL_ICON_MAP[toolName] || Puzzle;
}
