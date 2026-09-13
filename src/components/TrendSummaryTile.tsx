import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { TrendDirection, BehaviorClassification } from "../services/trendAnalysis";
import { AnimatedNumber } from "./AnimatedNumber";

interface TrendSummaryTileProps {
  label: string;
  value: string | number;
  numericValue?: number | null;
  unit?: string;
  decimals?: number;
  change?: string | number | null;
  rate?: string | null;
  direction?: TrendDirection;
  classification?: BehaviorClassification;
  isWarning?: boolean;
  isCritical?: boolean;
  subtext?: string;
}

export function TrendSummaryTile({
  label,
  value,
  numericValue,
  unit = "",
  decimals = 2,
  change,
  rate,
  direction = "STABLE",
  classification,
  isWarning = false,
  isCritical = false,
  subtext,
}: TrendSummaryTileProps) {
  let borderAccent = "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--card-border-hover)] shadow-xs";
  let statusBadge = null;

  if (isCritical) {
    borderAccent = "border-[var(--card-border)] border-l-4 border-l-[var(--status-danger)] bg-[var(--card-bg)] shadow-xs animate-critical-border";
  } else if (isWarning) {
    borderAccent = "border-[var(--card-border)] border-l-4 border-l-[var(--status-warning)] bg-[var(--card-bg)] shadow-xs";
  }

  // Direction icon and color
  let DirectionIcon = Minus;
  let dirColor = "text-[var(--text-muted)]";

  if (direction === "INCREASING") {
    DirectionIcon = TrendingUp;
    dirColor = isCritical ? "text-[var(--status-danger)]" : isWarning ? "text-[var(--status-warning)]" : "text-[var(--brand-teal)]";
  } else if (direction === "DECREASING") {
    DirectionIcon = TrendingDown;
    dirColor = "text-[var(--status-success)]";
  }

  // Classification pill matching StatusBadge pill pattern
  if (classification === "PROGRESSIVE_MOVEMENT") {
    statusBadge = (
      <span className="inline-flex items-center rounded-full bg-[var(--status-warning-bg)] px-2 py-0.5 text-[0.68rem] font-bold tracking-wider text-[var(--status-warning)] border border-[var(--status-warning-border)] shrink-0">
        PROGRESSIVE
      </span>
    );
  } else if (classification === "PERSISTENT_ABNORMAL") {
    statusBadge = (
      <span className="inline-flex items-center rounded-full bg-[var(--status-danger-bg)] px-2 py-0.5 text-[0.68rem] font-bold tracking-wider text-[var(--status-danger)] border border-[var(--status-danger-border)] shrink-0">
        PERSISTENT
      </span>
    );
  } else if (classification === "TEMPORARY_SPIKE") {
    statusBadge = (
      <span className="inline-flex items-center rounded-full bg-[var(--brand-teal-light)] text-[var(--brand-teal)] border border-[var(--brand-teal)]/30 px-2 py-0.5 text-[0.68rem] font-bold tracking-wider shrink-0">
        TRANSIENT
      </span>
    );
  }

  const numVal =
    numericValue !== undefined && numericValue !== null
      ? numericValue
      : typeof value === "number"
      ? value
      : null;

  const severity = isCritical ? "CRITICAL" : isWarning ? "WARNING" : "NORMAL";

  return (
    <div
      className={`relative flex min-h-[170px] flex-col justify-between rounded-lg border p-4 sm:p-5 transition-all duration-200 min-w-0 ${borderAccent}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="min-w-0 break-words text-[0.68rem] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
            {label}
          </span>
          {statusBadge}
        </div>

        <div className="mt-2.5 flex items-baseline flex-wrap gap-1 min-w-0">
          <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] break-words min-w-0">
            {numVal !== null && !Number.isNaN(numVal) ? (
              <AnimatedNumber
                value={numVal}
                severity={severity}
                decimals={decimals}
                isInteger={decimals === 0}
              />
            ) : (
              value
            )}
          </span>
          {unit && (
            <span className="font-sans text-xs sm:text-sm font-semibold text-[var(--text-muted)]">{unit}</span>
          )}
        </div>
      </div>

      <div className="mt-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-1 shrink-0">
            <DirectionIcon className={`h-3.5 w-3.5 ${dirColor}`} />
            <span className={`font-mono font-medium ${dirColor}`}>
              {direction}
            </span>
          </div>

          {rate && (
            <span className="font-mono text-[var(--text-secondary)] truncate">
              {rate}
            </span>
          )}

          {change !== undefined && change !== null && (
            <>
              <span className="text-[var(--text-muted)]">•</span>
              <span className="font-mono text-[var(--text-muted)]">
                Δ {typeof change === "number" && change > 0 ? `+${change}` : change}
              </span>
            </>
          )}
        </div>

        {subtext && (
          <p className="mt-2 text-xs text-[var(--text-muted)] leading-tight">{subtext}</p>
        )}
      </div>
    </div>
  );
}
