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
  value: number;
  unit: string;
  size?: "md" | "lg";
  activeFlags?: string[];
}

export function MetricTile({
  label,
  value,
  unit,
  size = "md",
  activeFlags = [],
}: MetricTileProps) {
  const isLarge = size === "lg";

  let severity: "NORMAL" | "WARNING" | "CRITICAL" = "NORMAL";
  let warnThreshold: number | null = null;
  
  if (label.toLowerCase() === "tilt") {
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

  const severityBorder = 
    severity === "CRITICAL" ? "border-red-500/50 bg-red-500/5" :
    severity === "WARNING" ? "border-amber-500/50 bg-amber-500/5" :
    "border-surface-border bg-surface-tile";

  const flagTextColor = 
    severity === "CRITICAL" ? "text-red-400" :
    severity === "WARNING" ? "text-amber-400" :
    "text-slate-400";

  return (
    <div
      className={`flex flex-col rounded-lg border ${severityBorder} ${
        isLarge ? "px-5 py-4" : "px-3 py-2"
      } transition-colors duration-300 h-full`}
    >
      <div className="flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p
          className={`mt-1 font-mono font-bold ${
            isLarge ? "text-3xl" : "text-2xl"
          }`}
        >
          <AnimatedNumber value={value} severity={severity} />
          <span
            className={`ml-1 font-sans font-semibold text-slate-400 ${
              isLarge ? "text-lg" : "text-sm"
            }`}
          >
            {unit}
          </span>
        </p>
        {warnThreshold !== null && (
          <p className="mt-1 text-[10px] text-slate-500">
            warn at {warnThreshold}{unit}
          </p>
        )}
      </div>
      
      {activeFlags.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {activeFlags.map((flag) => (
            <div key={flag} className={`text-[10px] font-bold tracking-wide ${flagTextColor}`}>
              ⚠ {flag.replace(/_/g, " ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
