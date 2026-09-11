import {
  Activity,
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

  // Header icon and theme based on status matching application design tokens
  let StatusIcon = ShieldCheck;
  let bannerClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

  if (status === "CRITICAL_IMMINENT" || status === "THRESHOLD_EXCEEDED") {
    StatusIcon = AlertOctagon;
    bannerClass = "bg-rose-500/10 text-rose-400 border-rose-500/30";
  } else if (status === "WARNING_IMMINENT") {
    StatusIcon = AlertTriangle;
    bannerClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
  } else if (status === "WATCH") {
    StatusIcon = Info;
    bannerClass = "bg-orange-500/10 text-orange-400 border-orange-500/30";
  }

  // Confidence color & badge styling
  const confBadgeClass =
    confidence.level === "HIGH"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : confidence.level === "MEDIUM"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
      : "bg-slate-500/10 text-slate-400 border-slate-500/30";

  const correlationBadgeClass =
    correlation.compoundSeverity === "CRITICAL"
      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
      : correlation.compoundSeverity === "HIGH"
      ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
      : correlation.compoundSeverity === "ELEVATED"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

  return (
    <section className="rounded-2xl border border-surface-border bg-surface-card p-6 shadow-xl shadow-black/40">
      {/* Top Banner: Status and Projection */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Predictive Early Warning System
            </span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/80">
              NODE {analysis.nodeId}
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
            <StatusIcon className={`h-6 w-6 flex-shrink-0 ${bannerClass.split(" ")[1]}`} />
            <span>{explanation.headline}</span>
          </h2>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-300 leading-relaxed">
            {explanation.summary}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-start md:items-end shrink-0">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-xs font-bold tracking-wider shadow-sm ${bannerClass}`}
          >
            <span className="relative flex h-2 w-2">
              {(status === "CRITICAL_IMMINENT" || status === "WARNING_IMMINENT") && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              )}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
            </span>
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Grid: Projection, Confidence, Multi-Sensor Correlation */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Card 1: Time-to-Threshold Projection */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm flex flex-col justify-between">
          <div>
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
              <p className="text-xs font-medium text-slate-400">Estimated Time to Reach:</p>
              <div className="mt-1 font-mono text-3xl font-bold tracking-tight text-white">
                {projection.projectedFormatted}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
            {projection.projectionMessage}
          </p>
        </div>

        {/* Card 2: Prediction Confidence */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Gauge className="h-4 w-4 text-teal-400" />
                Confidence & Quality
              </span>
              <span className={`text-xs font-mono font-bold rounded-full px-2.5 py-0.5 border ${confBadgeClass}`}>
                {confidence.level}
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-bold text-white">
                  {confidence.score}%
                </span>
                <span className="text-xs font-semibold text-slate-400">data reliability</span>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-800/90">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    confidence.level === "HIGH"
                      ? "bg-emerald-500"
                      : confidence.level === "MEDIUM"
                      ? "bg-amber-500"
                      : "bg-slate-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, confidence.score))}%` }}
                />
              </div>

              <p className="mt-3 text-xs italic text-slate-400 border-l-2 border-teal-500 pl-2.5 leading-relaxed">
                "{confidence.label}"
              </p>
            </div>
          </div>

          <ul className="mt-3 space-y-1.5 text-xs text-slate-300 border-t border-slate-800/60 pt-3">
            {confidence.factors.map((factor, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Card 3: Multi-Sensor Correlation */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-teal-400" />
                Multi-Sensor Correlation
              </span>
              <span
                className={`text-xs font-mono font-bold rounded-full px-2.5 py-0.5 border ${correlationBadgeClass}`}
              >
                {correlation.compoundSeverity}
              </span>
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {correlation.correlatedSignals.length > 0 ? (
                  correlation.correlatedSignals.map((sig, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-md bg-slate-800/60 px-2.5 py-1 font-mono text-xs font-semibold text-slate-200 border border-slate-700/60"
                    >
                      {sig}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">
                    No compounding sensor escalations
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
            {correlation.patternDescription}
          </p>
        </div>
      </div>

      {/* Explanatory "Why" Section */}
      <div className="mt-6 rounded-xl border border-slate-800/80 bg-slate-900/60 p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Info className="h-4 w-4 text-teal-400" />
          Explainable Diagnostic Assessment (Why this prediction was generated)
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs text-slate-300">
          {explanation.reasons.map((reason, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 rounded-lg bg-slate-800/40 px-3.5 py-2.5 text-xs text-slate-200 border border-slate-700/40"
            >
              <Activity className="h-4 w-4 text-teal-400 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

