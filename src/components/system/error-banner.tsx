import { AlertTriangle } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  details?: string;
}

export function ErrorBanner({ message, details }: ErrorBannerProps) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 font-medium text-red-600 dark:text-red-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {message}
      </div>
      {details && (
        <p className="mt-1 text-xs text-red-500/80">{details}</p>
      )}
    </div>
  );
}
