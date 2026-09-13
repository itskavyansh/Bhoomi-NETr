import type { SensorReading } from "../types/sensor";
import { MetricTile } from "./MetricTile";
import { StatusBadge } from "./StatusBadge";

interface NodeCardProps {
  reading: SensorReading;
}

// Real severity sorting would rank CRITICAL-associated codes above WARNING-only
// codes once per-warning severity is published. Current codes are equal.
const WARNING_SEVERITY: Record<string, number> = {
  EXCESSIVE_TILT: 1,
  HIGH_VIBRATION: 1,
  ABNORMAL_DISPLACEMENT: 1,
};

function sortWarnings(warnings: string[]): string[] {
  return [...warnings].sort(
    (a, b) => (WARNING_SEVERITY[b] ?? 0) - (WARNING_SEVERITY[a] ?? 0),
  );
}

/* ── Status-specific visual treatment ── */
const CARD_STATUS: Record<
  SensorReading["status"],
  { border: string; animation: string }
> = {
  NORMAL:   { border: "border-[var(--card-border)] border-l-4 border-l-[var(--brand-teal)]", animation: "" },
  WARNING:  { border: "border-[var(--card-border)] border-l-4 border-l-[var(--status-warning)]", animation: "" },
  CRITICAL: { border: "border-[var(--card-border)] border-l-4 border-l-[var(--status-danger)]", animation: "animate-critical-border" },
};

export function NodeCard({ reading }: NodeCardProps) {
  const style = CARD_STATUS[reading.status];

  const tiltFlags        = reading.warnings.filter((w) => w === "EXCESSIVE_TILT");
  const vibrationFlags   = reading.warnings.filter((w) => w === "HIGH_VIBRATION");
  const displacementFlags = reading.warnings.filter((w) => w === "ABNORMAL_DISPLACEMENT");
  const unmappedWarnings = reading.warnings.filter(
    (w) =>
      w !== "EXCESSIVE_TILT" &&
      w !== "HIGH_VIBRATION" &&
      w !== "ABNORMAL_DISPLACEMENT",
  );

  return (
    <article
      className={`flex h-full flex-col rounded-lg border bg-[var(--card-bg)] ${style.border} ${style.animation} p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-px hover:border-[var(--card-border-hover)] hover:shadow-md min-w-0`}
    >
      {/* Header */}
      <header className="mb-4 flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <p className="eyebrow mb-0.5">Monitoring point</p>
          <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)] truncate">
            {reading.node_id}
          </h2>
        </div>
        <div className="shrink-0">
          <StatusBadge status={reading.status} />
        </div>
      </header>

      {/* Risk score bar */}
      <div className="mb-4 min-w-0">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Subsidence Risk Index
          </span>
          <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
            {reading.risk_score}
            <span className="ml-0.5 text-xs font-normal text-[var(--text-muted)]">
              / 100
            </span>
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
          role="progressbar"
          aria-valuenow={reading.risk_score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Risk score: ${reading.risk_score} out of 100`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              reading.risk_score >= 70
                ? "bg-[var(--status-danger)]"
                : reading.risk_score >= 40
                ? "bg-[var(--status-warning)]"
                : "bg-[var(--status-success)]"
            }`}
            style={{ width: `${Math.min(reading.risk_score, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {reading.risk_level}
        </p>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 flex-1 min-w-0">
        <MetricTile
          label="Tilt X"
          value={reading.tilt_x}
          unit="°"
          activeFlags={Math.abs(reading.tilt_x) >= 15 ? tiltFlags : []}
        />
        <MetricTile
          label="Tilt Y"
          value={reading.tilt_y}
          unit="°"
          activeFlags={Math.abs(reading.tilt_y) >= 15 ? tiltFlags : []}
        />
        <MetricTile
          label="Vibration"
          value={reading.vibration}
          unit="g"
          activeFlags={vibrationFlags}
        />
        <MetricTile label="Distance" value={reading.distance} unit="cm" />
        <MetricTile
          label="Displacement"
          value={reading.displacement}
          unit="cm"
          activeFlags={displacementFlags}
        />
        {/* Sensor confidence */}
        <div className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 sm:py-2.5 h-full min-w-0">
          <p className="min-w-0 break-words text-[0.64rem] font-semibold uppercase leading-tight tracking-[0.035em] text-[var(--text-muted)] truncate">
            Confidence
          </p>
          <p className="mt-1 font-mono text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {reading.sensor_confidence}
            <span className="ml-0.5 text-xs sm:text-sm font-sans font-semibold text-[var(--text-muted)]">
              %
            </span>
          </p>
        </div>
      </div>

      {/* Piezo-Electric Acoustic Channel — preserve all existing fields */}
      <div className="mt-4 border-t border-[var(--border)] pt-3 min-w-0">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[var(--brand-teal)]">
            Piezo-Electric Acoustic
          </p>
          <span className="font-mono text-[0.6rem] text-[var(--text-muted)]">
            ADS1115 A0
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1 sm:gap-1.5 min-w-0">
          {[
            {
              label: "Peak",
              value: reading.piezo_peak,
            },
            {
              label: "RMS",
              value: reading.piezo_rms,
            },
            {
              label: "Pk-Pk",
              value: reading.piezo_peak_to_peak,
            },
          ].map((ch) => (
            <div
              key={ch.label}
              className="rounded border border-[var(--border)] bg-[var(--surface-alt)] px-1.5 py-1.5 sm:px-2 min-w-0 text-center"
            >
              <p className="text-[0.58rem] font-semibold uppercase text-[var(--text-muted)] truncate">
                {ch.label}
              </p>
              <p className="mt-0.5 font-mono text-[0.72rem] sm:text-[0.8125rem] font-bold text-[var(--text-primary)] truncate tabular-nums">
                {ch.value != null ? ch.value.toFixed(4) : "—"}
                {ch.value != null && (
                  <span className="ml-0.5 text-[0.6rem] font-normal text-[var(--text-muted)]">
                    V
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Unmapped warnings */}
      {unmappedWarnings.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs font-semibold text-[var(--status-danger)] min-w-0">
          {sortWarnings(unmappedWarnings).map((warning) => (
            <li key={warning} className="break-words">{warning}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
