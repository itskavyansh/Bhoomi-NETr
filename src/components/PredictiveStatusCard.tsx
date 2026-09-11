import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  Info,
  Layers,
  ShieldCheck,
} from "lucide-react";
import type { PredictiveAnalysisResult } from "../services/trendAnalysis";

interface PredictiveStatusCardProps {
  analysis: PredictiveAnalysisResult;
}

export function PredictiveStatusCard({ analysis }: PredictiveStatusCardProps) {
  const { status, statusLabel, confidence, projection, correlation, explanation } =
    analysis;

  // Header icon and theme based on status
  let StatusIcon = ShieldCheck;
  let bannerClass = "bg-teal-950/40 border-teal-800/80 text-teal-300";

  if (status === "CRITICAL_IMMINENT" || status === "THRESHOLD_EXCEEDED") {
    StatusIcon = AlertOctagon;
    bannerClass = "bg-rose-950/50 border-rose-800 text-rose-300";
  } else if (status === "WARNING_IMMINENT") {
    StatusIcon = AlertTriangle;
    bannerClass = "bg-amber-950/50 border-amber-800 text-amber-300";
  } else if (status === "WATCH") {
    StatusIcon = Info;
    bannerClass = "bg-yellow-950/40 border-yellow-800/80 text-yellow-300";
  }

  // Confidence color
  const confColor =
    confidence.level === "HIGH"
      ? "text-emerald-400"
      : confidence.level === "MEDIUM"
      ? "text-amber-400"
      : "text-slate-400";

  return (
    <section className="rounded-2xl border border-surface-border bg-surface-card p-6 shadow-xl shadow-black/50">
      {/* Top Banner: Status and Projection */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Predictive Early Warning System
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              NODE {analysis.nodeId}
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <StatusIcon className={`h-7 w-7 ${bannerClass.split(" ")[2]}`} />
            <span>{explanation.headline}</span>
          </h2>
          <p className="mt-1 max-w-3xl text-sm font-medium text-slate-300">
            {explanation.summary}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-start md:items-end shrink-0">
          <div
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-sm font-bold tracking-wide shadow-md ${bannerClass}`}
          >
            <span className="relative flex h-2.5 w-2.5">
              {(status === "CRITICAL_IMMINENT" || status === "WARNING_IMMINENT") && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              )}
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-current"></span>
            </span>
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Grid: Projection, Confidence, Multi-Sensor Correlation */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Card 1: Time-to-Threshold Projection */}
        <div className="rounded-xl border border-surface-border bg-surface-panel p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-teal-400" />
              Threshold Projection
            </span>
            <span className="text-xs font-mono font-medium text-slate-400">
              Target: {projection.targetThreshold.toFixed(2)} cm ({projection.thresholdType})
            </span>
          </div>

          <div className="mt-4">
            <div className="text-xs text-slate-400">Estimated Time to Reach:</div>
            <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-white">
              {projection.projectedFormatted}
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              {projection.projectionMessage}
            </p>
          </div>
        </div>

        {/* Card 2: Prediction Confidence */}
        <div className="rounded-xl border border-surface-border bg-surface-panel p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-teal-400" />
              Confidence & Quality
            </span>
            <span className={`text-xs font-mono font-bold ${confColor}`}>
              {confidence.level} ({confidence.score}%)
            </span>
          </div>

          <div className="mt-3">
            {/* Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  confidence.level === "HIGH"
                    ? "bg-emerald-500"
                    : confidence.level === "MEDIUM"
                    ? "bg-amber-500"
                    : "bg-slate-500"
                }`}
                style={{ width: `${confidence.score}%` }}
              />
            </div>

            <p className="mt-3 text-[11px] font-medium italic text-slate-400 border-l-2 border-teal-500 pl-2">
              "{confidence.label}"
            </p>

            <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
              {confidence.factors.map((factor, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-teal-500 shrink-0" />
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Card 3: Multi-Sensor Correlation */}
        <div className="rounded-xl border border-surface-border bg-surface-panel p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-teal-400" />
              Multi-Sensor Correlation
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                correlation.compoundSeverity === "CRITICAL"
                  ? "text-rose-400"
                  : correlation.compoundSeverity === "HIGH"
                  ? "text-amber-400"
                  : correlation.compoundSeverity === "ELEVATED"
                  ? "text-yellow-400"
                  : "text-slate-400"
              }`}
            >
              {correlation.compoundSeverity}
            </span>
          </div>

          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {correlation.correlatedSignals.length > 0 ? (
                correlation.correlatedSignals.map((sig, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-200 border border-white/10"
                  >
                    {sig}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-slate-500">
                  No compounding sensor escalations
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {correlation.patternDescription}
            </p>
          </div>
        </div>
      </div>

      {/* Explanatory "Why" Section */}
      <div className="mt-6 rounded-xl border border-surface-border bg-surface-panel/60 p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Info className="h-4 w-4 text-teal-400" />
          Explainable Diagnostic Assessment (Why this prediction was generated)
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs text-slate-300">
          {explanation.reasons.map((reason, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 rounded-lg bg-surface-card/60 p-2.5 border border-white/5"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-[10px] font-bold text-teal-300">
                {idx + 1}
              </span>
              <span className="leading-relaxed">{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
