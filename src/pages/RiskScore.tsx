import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Breadcrumb } from "../components/Breadcrumb";
import { DataStatus } from "../components/DataStatus";
import { LiveIndicator } from "../components/LiveIndicator";
import {
  fetchLatestReadings,
  subscribeToReadings,
} from "../services/sensorService";
import type { SensorReading } from "../types/sensor";

function getRiskExplanation(reading: SensorReading): string {
  if (reading.risk_level === "CRITICAL") {
    return "Severe correlated ground subsidence detected across multiple sensor channels. Immediate structural inspection advised.";
  }
  if (reading.risk_level === "HIGH") {
    return "Significant ground movement anomalies detected. Multi-sensor indicators suggest active subsidence progression.";
  }
  if (reading.risk_level === "MODERATE") {
    return "Isolated sensor metric exceedance detected. Ground conditions are under active monitoring watch.";
  }
  return "All physical sensor parameters are operating within safe baseline limits with no subsidence detected.";
}

export function RiskScore() {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const latest = await fetchLatestReadings();
        if (cancelled) return;
        setReadings(latest);
        unsubscribe = subscribeToReadings((updated) => {
          if (!cancelled) setReadings(updated);
        });
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Failed to load nodes.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const totalNodes = readings.length;
  const criticalNodes = readings.filter((r) => r.risk_level === "CRITICAL").length;
  const highNodes = readings.filter((r) => r.risk_level === "HIGH").length;
  const moderateNodes = readings.filter((r) => r.risk_level === "MODERATE").length;
  const lowNodes = readings.filter((r) => r.risk_level === "LOW").length;

  return (
    <main id="main-content" className="dashboard-shell py-10 lg:py-12" tabIndex={-1} style={{ outline: "none" }}>
      <Breadcrumb items={[{ label: "Analysis" }, { label: "Risk Score" }]} />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow mb-2">Decision support</p>
          <h1 className="page-title">Subsidence Risk Score</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Multi-sensor correlated subsidence risk evaluation, progression trends, and contributing factor analysis.
          </p>
        </div>
        {!loading && !error && <LiveIndicator />}
      </div>

      <DataStatus loading={loading} error={error} />

      {!loading && !error && (
        <>
          {/* Summary Stat Cards */}
          <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xs border-l-4 border-l-[var(--brand-teal)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Total Monitored Nodes
                </p>
                <TrendingUp className="h-5 w-5 text-[var(--brand-teal)]" />
              </div>
              <p className="text-3xl font-mono font-bold text-[var(--text-primary)]">{totalNodes}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Active monitoring points</p>
            </div>

            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xs border-l-4 border-l-[var(--status-success)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Low Risk Nodes
                </p>
                <CheckCircle className="h-5 w-5 text-[var(--status-success)]" />
              </div>
              <p className="text-3xl font-mono font-bold text-[var(--text-primary)]">{lowNodes}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Risk Index 0–24</p>
            </div>

            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xs border-l-4 border-l-[var(--status-warning)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Moderate / Warning
                </p>
                <AlertTriangle className="h-5 w-5 text-[var(--status-warning)]" />
              </div>
              <p className="text-3xl font-mono font-bold text-[var(--text-primary)]">{moderateNodes}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Risk Index 25–49</p>
            </div>

            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xs border-l-4 border-l-[var(--status-danger)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  High & Critical Risk
                </p>
                <AlertOctagon className="h-5 w-5 text-[var(--status-danger)]" />
              </div>
              <p className="text-3xl font-mono font-bold text-[var(--text-primary)]">
                {criticalNodes + highNodes}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {criticalNodes} Critical, {highNodes} High
              </p>
            </div>
          </section>

          {/* Node Risk Grid */}
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {readings.map((reading) => {
              const riskBadgeStyle =
                reading.risk_level === "CRITICAL"
                  ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger)]/30"
                  : reading.risk_level === "HIGH"
                  ? "bg-[var(--accent-saffron-light)] text-[var(--accent-saffron)] border-[var(--accent-saffron)]/30"
                  : reading.risk_level === "MODERATE"
                  ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]/30"
                  : "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]/30";

              return (
                <article
                  key={reading.node_id}
                  className="flex flex-col justify-between rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 sm:p-6 shadow-xs transition-all duration-200 hover:border-[var(--brand-green)]"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <h2 className="text-lg font-bold tracking-wider text-[var(--text-primary)]">
                        {reading.node_id}
                      </h2>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold tracking-wider border ${riskBadgeStyle}`}
                      >
                        {reading.risk_level} RISK
                      </span>
                    </div>

                    {/* Score & Confidence */}
                    <div className="mt-5 flex items-baseline justify-between">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl font-mono font-bold text-[var(--text-primary)]">
                            {reading.risk_score}
                          </span>
                          <span className="text-sm font-semibold text-[var(--text-muted)]">/ 100</span>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Subsidence Risk Index</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">Confidence:</span>
                        <p className="font-mono text-sm font-bold text-[var(--text-primary)]">
                          {reading.sensor_confidence}%
                        </p>
                      </div>
                    </div>

                    {/* Risk Progress Bar */}
                    <div className="mt-3.5 h-2 w-full rounded-full bg-[var(--surface-muted)] border border-[var(--border)] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          reading.risk_score >= 75
                            ? "bg-[var(--status-danger)]"
                            : reading.risk_score >= 50
                            ? "bg-[var(--accent-saffron)]"
                            : reading.risk_score >= 25
                            ? "bg-[var(--status-warning)]"
                            : "bg-[var(--status-success)]"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, reading.risk_score))}%` }}
                      />
                    </div>

                    {/* Explanation */}
                    <div className="mt-4 rounded-lg bg-[var(--surface-alt)] p-3.5 border border-[var(--border)]">
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {getRiskExplanation(reading)}
                      </p>
                    </div>

                    {/* Factors */}
                    <div className="mt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                        Contributing Risk Factors:
                      </p>
                      <ul className="space-y-2 text-xs">
                        {reading.risk_factors.map((factor, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-[var(--text-primary)] border border-[var(--border)]"
                          >
                            <Activity className="h-4 w-4 text-[var(--brand-teal)] flex-shrink-0 mt-0.5" />
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Footer link to Node Detail */}
                  <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Evaluated: {new Date(reading.timestamp).toLocaleTimeString()}
                    </span>
                    <Link
                      to={`/node/${reading.node_id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-teal)] hover:text-[var(--brand-green)] transition-colors"
                    >
                      View Node Detail
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
