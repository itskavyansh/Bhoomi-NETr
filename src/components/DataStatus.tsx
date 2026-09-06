import { Loader2, AlertCircle } from "lucide-react";

interface DataStatusProps {
  loading: boolean;
  error: string | null;
  loadingLabel?: string;
}

export function DataStatus({
  loading,
  error,
  loadingLabel = "Loading nodes…",
}: DataStatusProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm font-medium text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" aria-hidden="true" />
        {loadingLabel}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-lg border border-status-critical-border bg-status-critical-bg p-4 text-sm font-medium text-red-200">
        <AlertCircle className="h-5 w-5 shrink-0 text-status-critical" aria-hidden="true" />
        <p>{error}</p>
      </div>
    );
  }

  return null;
}
