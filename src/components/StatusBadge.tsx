import type { SensorReading } from "../types/sensor";

interface StatusBadgeProps {
  status: SensorReading["status"];
}

const statusStyles: Record<
  SensorReading["status"],
  { pill: string; dot: string }
> = {
  NORMAL: {
    pill: "bg-green-100 text-green-800 border-green-200",
    dot: "🟢",
  },
  WARNING: {
    pill: "bg-yellow-100 text-yellow-800 border-yellow-200",
    dot: "🟡",
  },
  CRITICAL: {
    pill: "bg-red-100 text-red-800 border-red-200",
    dot: "🔴",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = statusStyles[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${styles.pill}`}
    >
      <span aria-hidden="true">{styles.dot}</span>
      {status}
    </span>
  );
}
