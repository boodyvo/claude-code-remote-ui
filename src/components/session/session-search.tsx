"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SessionSearchProps {
  onSearch: (query: string) => void;
}

export function SessionSearch({ onSearch }: SessionSearchProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value), 300);
    return () => clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search sessions..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 pl-8 text-sm"
      />
    </div>
  );
}
