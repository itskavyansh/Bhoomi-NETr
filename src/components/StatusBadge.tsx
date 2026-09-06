import type { SensorReading } from "../types/sensor";

interface StatusBadgeProps {
  status: SensorReading["status"];
}

const statusStyles: Record<
  SensorReading["status"],
  { pill: string; dot: string }
> = {
  NORMAL: {
    pill: "bg-status-normal-bg text-status-normal border-status-normal-border",
    dot: "bg-status-normal",
  },
  WARNING: {
    pill: "bg-status-watch-bg text-status-watch border-status-watch-border",
    dot: "bg-status-watch",
  },
  CRITICAL: {
    pill: "bg-status-critical-bg text-status-critical border-status-critical-border animate-critical-pulse",
    dot: "bg-status-critical animate-pulse",
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
