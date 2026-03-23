"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

interface RetryBannerProps {
  errorType: string;
  retryAfterMs: number;
  attempt: number;
  maxAttempts: number;
}

export function RetryBanner({
  errorType,
  retryAfterMs,
  attempt,
  maxAttempts,
}: RetryBannerProps) {
  const [countdown, setCountdown] = useState(
    Math.ceil(retryAfterMs / 1000),
  );

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  if (countdown <= 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span>
        Retry {attempt}/{maxAttempts} in {countdown}s... ({errorType})
      </span>
    </div>
  );
}
