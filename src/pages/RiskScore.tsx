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
    <main className="dashboard-shell py-10 lg:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow mb-2">Decision support</p>
          <h1 className="page-title">Subsidence risk score</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Multi-sensor correlated subsidence risk evaluation, progression trends, and contributing factor analysis
          </p>
        </div>
        {!loading && !error && <LiveIndicator />}
      </div>

      <DataStatus loading={loading} error={error} />

      {!loading && !error && (
        <>
          {/* Summary Stat Cards */}
          <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-surface-border bg-surface-card p-5 shadow-lg shadow-black/40 border-l-4 border-l-teal-600">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Total Monitored Nodes
                </p>
                <TrendingUp className="h-5 w-5 text-teal-500" />
              </div>
              <p className="text-3xl font-mono font-bold text-white">{totalNodes}</p>
              <p className="mt-1 text-xs text-slate-500">Active monitoring points</p>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-card p-5 shadow-lg shadow-black/40 border-l-4 border-l-emerald-500">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Low Risk Nodes
                </p>
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-3xl font-mono font-bold text-white">{lowNodes}</p>
              <p className="mt-1 text-xs text-slate-500">Risk Index 0–24</p>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-card p-5 shadow-lg shadow-black/40 border-l-4 border-l-amber-500">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Moderate / Warning
                </p>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-3xl font-mono font-bold text-white">{moderateNodes}</p>
              <p className="mt-1 text-xs text-slate-500">Risk Index 25–49</p>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-card p-5 shadow-lg shadow-black/40 border-l-4 border-l-rose-500">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  High & Critical Risk
                </p>
                <AlertOctagon className="h-5 w-5 text-rose-500" />
              </div>
              <p className="text-3xl font-mono font-bold text-white">
                {criticalNodes + highNodes}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {criticalNodes} Critical, {highNodes} High
              </p>
            </div>
          </section>

          {/* Node Risk Grid */}
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {readings.map((reading) => {
              const riskBadgeStyle =
                reading.risk_level === "CRITICAL"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  : reading.risk_level === "HIGH"
                  ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                  : reading.risk_level === "MODERATE"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

              return (
                <article
                  key={reading.node_id}
                  className="flex flex-col justify-between rounded-2xl border border-surface-border bg-surface-card p-6 shadow-xl shadow-black/40 transition-all duration-300 hover:border-slate-600 hover:shadow-2xl"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <h2 className="text-lg font-bold tracking-wider text-slate-100">
                        NODE {reading.node_id}
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
                          <span className="text-5xl font-mono font-bold text-white">
                            {reading.risk_score}
                          </span>
                          <span className="text-sm font-semibold text-slate-400">/ 100</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">Subsidence Risk Index</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-400">Confidence:</span>
                        <p className="font-mono text-sm font-bold text-slate-200">
                          {reading.sensor_confidence}%
                        </p>
                      </div>
                    </div>

                    {/* Risk Progress Bar */}
                    <div className="mt-3.5 h-2 w-full rounded-full bg-slate-800/90 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          reading.risk_score >= 75
                            ? "bg-rose-500"
                            : reading.risk_score >= 50
                            ? "bg-orange-500"
                            : reading.risk_score >= 25
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, reading.risk_score))}%` }}
                      />
                    </div>

                    {/* Explanation */}
                    <div className="mt-4 rounded-xl bg-slate-900/60 p-3 border border-slate-800/80">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {getRiskExplanation(reading)}
                      </p>
                    </div>

                    {/* Factors */}
                    <div className="mt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                        Contributing Risk Factors:
                      </p>
                      <ul className="space-y-2 text-xs">
                        {reading.risk_factors.map((factor, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 rounded-lg bg-slate-800/40 px-3 py-2 text-slate-200 border border-slate-700/40"
                          >
                            <Activity className="h-4 w-4 text-teal-400 flex-shrink-0 mt-0.5" />
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Footer link to Node Detail */}
                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Evaluated: {new Date(reading.timestamp).toLocaleTimeString()}
                    </span>
                    <Link
                      to={`/node/${reading.node_id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
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
