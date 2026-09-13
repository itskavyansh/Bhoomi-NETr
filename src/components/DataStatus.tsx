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
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--brand-teal)] shadow-xs">
          <span className="absolute inset-2 rounded-xl border border-[var(--brand-teal)]/30 animate-pulse" />
          <span className="absolute h-2 w-2 rounded-full bg-[var(--brand-teal)]" />
          <Activity className="h-7 w-7 animate-[spin_3s_linear_infinite] text-[var(--brand-teal)]" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-semibold tracking-wide text-[var(--text-primary)]">{loadingLabel}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Connecting to the BHOOMI-NETr telemetry stream</p>
        <div className="mt-5 flex gap-1.5" aria-hidden="true">
          <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--brand-teal)] [animation-delay:-0.3s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--brand-teal)] [animation-delay:-0.15s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--brand-teal)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-[var(--alert-critical-border)] bg-[var(--alert-critical-bg)] p-4 text-sm font-medium text-[var(--alert-critical-text)]" role="alert">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-danger)]" aria-hidden="true" />
        <p>{error}</p>
      </div>
    );
  }

  return null;
}
