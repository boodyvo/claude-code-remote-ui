"use client";

import { useEffect, useState, useCallback } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TerminalLogin } from "./terminal-login";

interface AuthOverlayProps {
  onAuthComplete?: () => void;
}

export function AuthOverlay({ onAuthComplete }: AuthOverlayProps) {
  const [claudeAuth, setClaudeAuth] = useState<{ authenticated: boolean } | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/claude-auth");
      if (res.ok) {
        const data = await res.json();
        setClaudeAuth(data);
        if (data.authenticated) {
          setShowTerminal(false);
        }
      }
    } catch {
      // Ignore
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleComplete = useCallback(() => {
    setClaudeAuth({ authenticated: true });
    setShowTerminal(false);
    onAuthComplete?.();
  }, [onAuthComplete]);

  // Still checking
  if (checking) return null;

  // Already authenticated
  if (claudeAuth?.authenticated) return null;

  // Show terminal login
  if (showTerminal) {
    return (
      <TerminalLogin
        onComplete={handleComplete}
        onClose={() => setShowTerminal(false)}
      />
    );
  }

  // Show auth required prompt
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Claude Code Login</h2>
            <p className="text-sm text-muted-foreground">
              Claude Code needs to be authenticated before you can start a session.
            </p>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => setShowTerminal(true)}
        >
          Log in to Claude Code
        </Button>

        <Button
          variant="ghost"
          className="mt-2 w-full text-muted-foreground"
          onClick={() => checkAuth()}
        >
          <Loader2 className="mr-2 h-4 w-4" />
          Re-check authentication
        </Button>
      </div>
    </div>
  );
}
