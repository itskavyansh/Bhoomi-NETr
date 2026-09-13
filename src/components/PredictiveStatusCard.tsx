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
  let bannerClass = "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success-border)]";

  if (status === "CRITICAL_IMMINENT" || status === "THRESHOLD_EXCEEDED") {
    StatusIcon = AlertOctagon;
    bannerClass = "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger-border)]";
  } else if (status === "WARNING_IMMINENT") {
    StatusIcon = AlertTriangle;
    bannerClass = "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning-border)]";
  } else if (status === "WATCH") {
    StatusIcon = Info;
    bannerClass = "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning-border)]";
  }

  // Confidence color & badge styling
  const confBadgeClass =
    confidence.level === "HIGH"
      ? "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success-border)]"
      : confidence.level === "MEDIUM"
      ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning-border)]"
      : "bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border)]";

  const correlationBadgeClass =
    correlation.compoundSeverity === "CRITICAL"
      ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger-border)]"
      : correlation.compoundSeverity === "HIGH"
      ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning-border)]"
      : correlation.compoundSeverity === "ELEVATED"
      ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning-border)]"
      : "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success-border)]";

  return (
    <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 sm:p-6 shadow-xs min-w-0 transition-colors">
      {/* Top Banner: Status and Projection */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[var(--border)] pb-5 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-teal)]">
              Predictive Early Warning System
            </span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-secondary)] border border-[var(--border)]">
              {analysis.nodeId}
            </span>
          </div>
          <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2.5 min-w-0 break-words">
            <StatusIcon className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-current" />
            <span className="truncate">{explanation.headline}</span>
          </h2>
          <p className="mt-1.5 max-w-3xl text-sm text-[var(--text-secondary)] leading-relaxed">
            {explanation.summary}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-start md:items-end shrink-0">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-xs font-bold tracking-wider shadow-xs ${bannerClass}`}
          >
            <span className="relative flex h-2 w-2">
              {(status === "CRITICAL_IMMINENT" || status === "WARNING_IMMINENT") && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
              )}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
            </span>
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Grid: Projection, Confidence, Multi-Sensor Correlation */}
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3 min-w-0">
        {/* Card 1: Time-to-Threshold Projection */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[var(--brand-green)]" />
                Threshold Projection
              </span>
              <span className="text-xs font-mono font-medium text-[var(--text-muted)]">
                Target: {projection.targetThreshold.toFixed(2)} cm
              </span>
            </div>

            <div className="mt-4 min-w-0">
              <p className="text-xs font-medium text-[var(--text-muted)]">Estimated Time to Reach:</p>
              <div className="mt-1 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] break-words">
                {projection.projectedFormatted}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)] pt-3 break-words">
            {projection.projectionMessage}
          </p>
        </div>

        {/* Card 2: Prediction Confidence */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                <Gauge className="h-4 w-4 text-[var(--brand-green)]" />
                Confidence & Quality
              </span>
              <span className={`text-xs font-mono font-bold rounded-full px-2.5 py-0.5 border ${confBadgeClass}`}>
                {confidence.level}
              </span>
            </div>

            <div className="mt-4 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text-primary)]">
                  {confidence.score}%
                </span>
                <span className="text-xs font-semibold text-[var(--text-muted)]">data reliability</span>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    confidence.level === "HIGH"
                      ? "bg-[var(--status-success)]"
                      : confidence.level === "MEDIUM"
                      ? "bg-[var(--status-warning)]"
                      : "bg-[var(--text-muted)]"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, confidence.score))}%` }}
                />
              </div>

              <p className="mt-3 text-xs italic text-[var(--text-secondary)] border-l-2 border-[var(--brand-green)] pl-2.5 leading-relaxed break-words">
                "{confidence.label}"
              </p>
            </div>
          </div>

          <ul className="mt-3 space-y-1.5 text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-3">
            {confidence.factors.map((factor, idx) => (
              <li key={idx} className="flex items-center gap-1.5 break-words">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-success)] shrink-0" />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Card 3: Multi-Sensor Correlation */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[var(--brand-green)]" />
                Multi-Sensor Correlation
              </span>
              <span
                className={`text-xs font-mono font-bold rounded-full px-2.5 py-0.5 border ${correlationBadgeClass}`}
              >
                {correlation.compoundSeverity}
              </span>
            </div>

            <div className="mt-4 min-w-0">
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {correlation.correlatedSignals.length > 0 ? (
                  correlation.correlatedSignals.map((sig, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded bg-[var(--surface)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--text-primary)] border border-[var(--border)] shadow-xs"
                    >
                      {sig}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">
                    No compounding sensor escalations
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)] pt-3 break-words">
            {correlation.patternDescription}
          </p>
        </div>
      </div>

      {/* Explanatory "Why" Section */}
      <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4 sm:p-5 min-w-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
          <Info className="h-4 w-4 text-[var(--brand-teal)]" />
          Explainable Diagnostic Assessment (Why this prediction was generated)
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs text-[var(--text-secondary)]">
          {explanation.reasons.map((reason, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 rounded-lg bg-[var(--surface)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)] border border-[var(--border)] shadow-xs min-w-0"
            >
              <Activity className="h-4 w-4 text-[var(--brand-teal)] shrink-0 mt-0.5" />
              <span className="leading-relaxed break-words">{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

