import { AlertCircle, Activity } from "lucide-react";

interface DataStatusProps {
  loading: boolean;
  error: string | null;
  loadingLabel?: string;
}

export function DataStatus({ loading, error, loadingLabel = "Loading nodes…" }: DataStatusProps) {
  if (loading) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-20 text-center" role="status" aria-live="polite">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-teal-300/25 bg-teal-300/[0.06] text-teal-200 shadow-[0_0_34px_rgba(66,201,194,0.10)]">
          <span className="absolute inset-2 rounded-xl border border-teal-300/30 animate-pulse" />
          <span className="absolute h-2 w-2 rounded-full bg-teal-200 shadow-[0_0_14px_rgba(113,230,220,0.8)]" />
          <Activity className="h-7 w-7 animate-[spin_3s_linear_infinite] text-teal-300" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-semibold tracking-wide text-slate-200">{loadingLabel}</p>
        <p className="mt-1 text-xs text-slate-500">Connecting to the BHOOMI-NETr telemetry stream</p>
        <div className="mt-5 flex gap-1.5" aria-hidden="true">
          <span className="h-1 w-1 animate-bounce rounded-full bg-teal-300 [animation-delay:-0.3s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-teal-300 [animation-delay:-0.15s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-teal-300" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-status-critical-border bg-status-critical-bg p-4 text-sm font-medium text-red-200" role="alert">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" aria-hidden="true" />
        <p>{error}</p>
      </div>
    );
  }

  return null;
}
