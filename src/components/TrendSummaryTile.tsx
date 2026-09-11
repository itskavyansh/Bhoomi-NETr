import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { TrendDirection, BehaviorClassification } from "../services/trendAnalysis";

interface TrendSummaryTileProps {
  label: string;
  value: string | number;
  unit?: string;
  previousValue?: string | number | null;
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
  unit = "",
  change,
  rate,
  direction = "STABLE",
  classification,
  isWarning = false,
  isCritical = false,
  subtext,
}: TrendSummaryTileProps) {
  let borderAccent = "border-surface-border";
  let statusBadge = null;

  if (isCritical) {
    borderAccent = "border-rose-500/60 bg-rose-950/10";
  } else if (isWarning) {
    borderAccent = "border-amber-500/60 bg-amber-950/10";
  }

  // Direction icon and color
  let DirectionIcon = Minus;
  let dirColor = "text-slate-400";

  if (direction === "INCREASING") {
    DirectionIcon = TrendingUp;
    dirColor = isCritical || isWarning ? "text-rose-400" : "text-amber-400";
  } else if (direction === "DECREASING") {
    DirectionIcon = TrendingDown;
    dirColor = "text-emerald-400";
  }

  // Classification pill
  if (classification === "PROGRESSIVE_MOVEMENT") {
    statusBadge = (
      <span className="inline-flex items-center rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
        PROGRESSIVE
      </span>
    );
  } else if (classification === "PERSISTENT_ABNORMAL") {
    statusBadge = (
      <span className="inline-flex items-center rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300 border border-rose-500/30">
        PERSISTENT
      </span>
    );
  } else if (classification === "TEMPORARY_SPIKE") {
    statusBadge = (
      <span className="inline-flex items-center rounded-md bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-500/30">
        TRANSIENT SPIKE
      </span>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-surface-card p-5 shadow-lg shadow-black/40 transition-all ${borderAccent}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {statusBadge}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-slate-400">{unit}</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3 text-xs text-slate-400">
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
        <p className="mt-2 text-[11px] text-slate-500 leading-tight">{subtext}</p>
      )}
    </div>
  );
}
