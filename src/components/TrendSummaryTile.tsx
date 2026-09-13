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
  let borderAccent = "border-surface-border bg-surface-card hover:border-slate-600";
  let statusBadge = null;

  if (isCritical) {
    borderAccent = "border-rose-500/50 bg-rose-500/5 shadow-rose-500/10 animate-critical-border";
  } else if (isWarning) {
    borderAccent = "border-amber-500/50 bg-amber-500/5 shadow-amber-500/5";
  }

  // Direction icon and color
  let DirectionIcon = Minus;
  let dirColor = "text-slate-400";

  if (direction === "INCREASING") {
    DirectionIcon = TrendingUp;
    dirColor = isCritical ? "text-rose-400" : isWarning ? "text-amber-400" : "text-teal-400";
  } else if (direction === "DECREASING") {
    DirectionIcon = TrendingDown;
    dirColor = "text-emerald-400";
  }

  // Classification pill matching StatusBadge pill pattern
  if (classification === "PROGRESSIVE_MOVEMENT") {
    statusBadge = (
      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-amber-400 border border-amber-500/30">
        PROGRESSIVE
      </span>
    );
  } else if (classification === "PERSISTENT_ABNORMAL") {
    statusBadge = (
      <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-rose-400 border border-rose-500/30">
        PERSISTENT
      </span>
    );
  } else if (classification === "TEMPORARY_SPIKE") {
    statusBadge = (
      <span className="inline-flex items-center rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-teal-400 border border-teal-500/30">
        TRANSIENT SPIKE
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
      className={`relative flex min-h-[188px] flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-[0_14px_34px_rgba(0,0,0,0.16)] transition-all duration-300 ${borderAccent}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 whitespace-nowrap text-[0.66rem] font-semibold uppercase tracking-[0.06em] text-slate-400">
            {label}
          </span>
          {statusBadge}
        </div>

        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
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
            <span className="font-sans text-sm font-semibold text-slate-400">{unit}</span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <DirectionIcon className={`h-3.5 w-3.5 ${dirColor}`} />
            <span className={`font-mono font-medium ${dirColor}`}>
              {direction}
            </span>
          </div>

          {rate && (
            <>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-300">{rate}</span>
            </>
          )}

          {change !== undefined && change !== null && (
            <>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-400">
                Δ {typeof change === "number" && change > 0 ? `+${change}` : change}
              </span>
            </>
          )}
        </div>

        {subtext && (
          <p className="mt-2 text-xs text-slate-500 leading-tight">{subtext}</p>
        )}
      </div>
    </div>
  );
}
