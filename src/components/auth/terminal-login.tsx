"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ExternalLink, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface TerminalLoginProps {
  onComplete: () => void;
  onClose: () => void;
}

export function TerminalLogin({ onComplete, onClose }: TerminalLoginProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyUrl = useCallback(() => {
    if (!authUrl) return;
    navigator.clipboard.writeText(authUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [authUrl]);

  useEffect(() => {
    if (!termRef.current) return;

    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      theme: {
        background: "#1a1b26",
        foreground: "#a9b1d6",
        cursor: "#c0caf5",
        selectionBackground: "#33467c",
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(termRef.current);

    // Small delay for DOM layout
    setTimeout(() => fitAddon.fit(), 50);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect to shell WebSocket
    connectShell(term);

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      wsRef.current?.close();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectShell(term: XTerminal) {
    try {
      const res = await fetch("/api/auth/ws-token");
      if (!res.ok) return;
      const { token } = await res.json();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/shell?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const fitAddon = fitAddonRef.current;
        if (fitAddon) fitAddon.fit();

        ws.send(
          JSON.stringify({
            type: "init",
            command: "claude /login",
            cols: term.cols,
            rows: term.rows,
          }),
        );
      };

      ws.onmessage = (event) => {
        let msg: { type: string; data?: string; url?: string; exitCode?: number };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case "output":
            if (msg.data) term.write(msg.data);
            break;
          case "auth_url":
            if (msg.url) setAuthUrl(msg.url);
            break;
          case "exit":
            term.write("\r\n\x1b[32mAuthentication complete.\x1b[0m\r\n");
            setTimeout(onComplete, 1500);
            break;
        }
      };

      ws.onerror = () => {
        term.write("\r\n\x1b[31mConnection error.\x1b[0m\r\n");
      };

      // Forward terminal input to PTY
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data }));
        }
      });

      // Forward resize events
      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });
    } catch {
      term.write("\x1b[31mFailed to connect to shell.\x1b[0m\r\n");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-2xl flex-col rounded-xl border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Claude Code Login</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Terminal */}
        <div className="p-2">
          <div
            ref={termRef}
            className="h-[300px] overflow-hidden rounded-lg"
            style={{ background: "#1a1b26" }}
          />
        </div>

        {/* Auth URL bar */}
        {authUrl && (
          <div className="border-t px-4 py-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Open this URL to authenticate:
            </p>
            <div className="flex gap-2">
              <a
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="truncate">Open Login Page</span>
              </a>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={copyUrl}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
