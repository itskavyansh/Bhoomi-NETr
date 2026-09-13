import type { SensorReading } from "../types/sensor";

interface StatusBadgeProps {
  status: SensorReading["status"];
}

const statusStyles: Record<
  SensorReading["status"],
  { pill: string; dot: string }
> = {
  NORMAL: {
    pill: "bg-[var(--status-normal-bg)] text-[var(--status-normal)] border-[var(--status-normal-border)]",
    dot: "bg-[var(--status-normal)]",
  },
  WARNING: {
    pill: "bg-[var(--status-watch-bg)] text-[var(--status-watch)] border-[var(--status-watch-border)]",
    dot: "bg-[var(--status-watch)]",
  },
  CRITICAL: {
    pill: "bg-[var(--status-critical-bg)] text-[var(--status-critical)] border-[var(--status-critical-border)] animate-critical-pulse",
    dot: "bg-[var(--status-critical)] animate-pulse",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = statusStyles[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wider ${styles.pill}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${styles.dot}`} />
      {status}
    </span>
  );
}
