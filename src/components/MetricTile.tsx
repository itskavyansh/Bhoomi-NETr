import { AnimatedNumber } from "./AnimatedNumber";
import {
  TILT_WARNING,
  TILT_CRITICAL,
  VIBRATION_WARNING,
  VIBRATION_CRITICAL,
  DISPLACEMENT_WARNING,
  DISPLACEMENT_CRITICAL,
} from "../services/analysisAdapter";

interface MetricTileProps {
  label: string;
  value?: number | null;
  unit: string;
  size?: "md" | "lg";
  decimals?: number;
  activeFlags?: string[];
}

export function MetricTile({
  label,
  value,
  unit,
  size = "md",
  decimals = 2,
  activeFlags = [],
}: MetricTileProps) {
  const isLarge = size === "lg";

  let severity: "NORMAL" | "WARNING" | "CRITICAL" = "NORMAL";
  let warnThreshold: number | null = null;
  
  if (value != null) {
    if (label.toLowerCase().includes("tilt")) {
      warnThreshold = TILT_WARNING;
      if (Math.abs(value) >= TILT_CRITICAL) severity = "CRITICAL";
      else if (Math.abs(value) >= TILT_WARNING) severity = "WARNING";
    } else if (label.toLowerCase() === "vibration") {
      warnThreshold = VIBRATION_WARNING;
      if (value >= VIBRATION_CRITICAL) severity = "CRITICAL";
      else if (value >= VIBRATION_WARNING) severity = "WARNING";
    } else if (label.toLowerCase() === "displacement") {
      warnThreshold = DISPLACEMENT_WARNING;
      if (Math.abs(value) >= DISPLACEMENT_CRITICAL) severity = "CRITICAL";
      else if (Math.abs(value) >= DISPLACEMENT_WARNING) severity = "WARNING";
    }
  }

  const severityBorder = 
    severity === "CRITICAL" ? "border-[var(--status-danger)]/60 border-l-4 border-l-[var(--status-danger)] bg-[var(--surface-alt)] text-[var(--status-danger)]" :
    severity === "WARNING" ? "border-[var(--status-warning)]/60 border-l-4 border-l-[var(--status-warning)] bg-[var(--surface-alt)] text-[var(--status-warning)]" :
    "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-primary)]";

  const flagTextColor = 
    severity === "CRITICAL" ? "text-[var(--status-danger)]" :
    severity === "WARNING" ? "text-[var(--status-warning)]" :
    "text-[var(--text-muted)]";

  return (
    <div
      className={`flex flex-col rounded-lg border ${severityBorder} ${
        isLarge ? "px-4 py-3.5 sm:px-5 sm:py-4" : "px-3 py-2 sm:py-2.5"
      } transition-colors duration-200 h-full min-w-0`}
    >
      <div className="flex-1 min-w-0">
        <p className="min-w-0 break-words text-[0.64rem] font-semibold uppercase leading-tight tracking-[0.035em] text-[var(--text-muted)] truncate">
          {label}
        </p>
        <div
          className={`mt-1 flex items-baseline flex-wrap gap-x-1 min-w-0 font-mono font-bold tracking-tight text-[var(--text-primary)] ${
            isLarge ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
          }`}
        >
          {value != null ? (
            <AnimatedNumber value={value} severity={severity} decimals={decimals} />
          ) : (
            <span className="text-[var(--text-disabled)] font-mono">—</span>
          )}
          <span
            className={`font-sans font-semibold text-[var(--text-muted)] ${
              isLarge ? "text-base sm:text-lg" : "text-xs sm:text-sm"
            }`}
          >
            {unit}
          </span>
        </div>
        {warnThreshold !== null && (
          <p className="mt-1 text-[10px] text-[var(--text-muted)] break-words">
            warn at {warnThreshold}{unit}
          </p>
        )}
      </div>
      
      {activeFlags.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 min-w-0">
          {activeFlags.map((flag) => (
            <div key={flag} className={`text-[10px] font-bold tracking-wide break-words ${flagTextColor}`}>
              ⚠ {flag.replace(/_/g, " ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
