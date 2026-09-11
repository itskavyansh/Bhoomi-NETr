import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Radio,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertHistoryPanel } from "../components/AlertHistoryPanel";
import { DataStatus } from "../components/DataStatus";
import { LiveIndicator } from "../components/LiveIndicator";
import { MetricTile } from "../components/MetricTile";
import { StatusBadge } from "../components/StatusBadge";
import { TrendChart } from "../components/TrendChart";
import {
  fetchLatestReadings,
  fetchNodeHistory,
  LIVE_HISTORY_LIMIT,
  subscribeToReadings,
} from "../services/sensorService";
import type { SensorReading, TimePoint } from "../types/sensor";

function toTimePoint(reading: SensorReading): TimePoint {
  return {
    timestamp: reading.timestamp,
    tilt_x: reading.tilt_x,
    tilt_y: reading.tilt_y,
    vibration: reading.vibration,
    distance: reading.distance,
    displacement: reading.displacement,
  };
}

function appendHistoryPoint(
  previous: TimePoint[],
  reading: SensorReading,
): TimePoint[] {
  const nextPoint = toTimePoint(reading);
  const withoutDuplicate = previous.filter(
    (point) => point.timestamp !== nextPoint.timestamp,
  );
  const merged = [...withoutDuplicate, nextPoint].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  return merged.length > LIVE_HISTORY_LIMIT
    ? merged.slice(merged.length - LIVE_HISTORY_LIMIT)
    : merged;
}

function renderHealthBadge(status: string) {
  if (status === "GOOD") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
        <CheckCircle className="h-3.5 w-3.5" />
        GOOD
      </span>
    );
  }
  if (status === "UNSTABLE" || status === "DEGRADED") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
        <AlertTriangle className="h-3.5 w-3.5" />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
      <XCircle className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

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

function getConfidenceSummary(reading: SensorReading): string {
  if (reading.sensor_confidence >= 85) {
    return "Telemetry stream is healthy, within physical limits, and trustworthy for risk evaluation.";
  }
  if (reading.sensor_confidence >= 60) {
    return "Telemetry is slightly jittery or experiencing latency, but remains usable for monitoring.";
  }
  return "Sensor data is unstable, out-of-range, or corrupted. Risk score calculation should be verified physically.";
}

export function NodeDetail() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<TimePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function load() {
      if (!nodeId) {
        setReading(null);
        setHistory([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [latest, points] = await Promise.all([
          fetchLatestReadings(),
          fetchNodeHistory(nodeId),
        ]);
        if (cancelled) {
          return;
        }

        const current = latest.find((entry) => entry.node_id === nodeId) ?? null;
        setReading(current);
        setHistory(points);

        unsubscribe = subscribeToReadings((updated) => {
          if (cancelled) {
            return;
          }
          const next = updated.find((entry) => entry.node_id === nodeId) ?? null;
          setReading(next);
          if (next) {
            setHistory((previous) => appendHistoryPoint(previous, next));
          }
        });
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Failed to load node.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [nodeId]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-teal-500 hover:text-teal-400"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Dashboard
      </Link>

      <DataStatus
        loading={loading}
        error={error}
        loadingLabel="Loading node…"
      />

      {!loading && !error && !reading && (
        <>
          <h1 className="mt-8 text-2xl font-bold text-slate-100">Node not found</h1>
          <p className="mt-2 text-sm font-medium text-slate-400">
            No sensor node matches the id {nodeId ?? "unknown"}.
          </p>
        </>
      )}

      {!loading && !error && reading && (
        <div className="mt-8 flex flex-col gap-8 lg:flex-row">
          {/* Left Column: Main Content */}
          <div className="flex-1 min-w-0">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
                  NODE {reading.node_id}
                </h1>
                <p className="mt-1 text-xs text-slate-400">
                  Last updated: {new Date(reading.timestamp).toLocaleTimeString()} · {reading.timestamp}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <LiveIndicator />
                <StatusBadge status={reading.status} />
              </div>
            </header>

            {/* Low Confidence Advisory Banner (if applicable) */}
            {reading.confidence_warning && (
              <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-300">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
                  <div className="text-sm">
                    <p className="font-bold text-amber-200">
                      ⚠ LOW SENSOR CONFIDENCE ({reading.sensor_confidence}%)
                    </p>
                    <p className="mt-0.5 text-amber-300/90 text-xs">
                      {reading.confidence_warning}. Note: The calculated risk evaluation should be verified against physical sensor connectivity.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 1 & 2: SEPARATE DEDICATED INTELLIGENCE SECTIONS */}
            <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* REQUIREMENT 1: Separate Subsidence Risk Index Card */}
              <section className="rounded-2xl border border-surface-border bg-surface-card p-6 shadow-xl shadow-black/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-teal-400" />
                      Subsidence Risk Index
                    </h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold tracking-wider border ${
                        reading.risk_level === "CRITICAL"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : reading.risk_level === "HIGH"
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                          : reading.risk_level === "MODERATE"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {reading.risk_level} RISK
                    </span>
                  </div>

                  {/* Score & Gauge */}
                  <div className="mt-5 flex items-baseline justify-between">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-mono font-bold text-white">
                          {reading.risk_score}
                        </span>
                        <span className="text-sm font-semibold text-slate-400">/ 100</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Multi-sensor deterministic subsidence score
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-400">Confidence:</span>
                      <p className="font-mono text-sm font-bold text-slate-200">
                        {reading.sensor_confidence}%
                      </p>
                    </div>
                  </div>

                  {/* Visual Progress / Risk Bar */}
                  <div className="mt-4 h-2.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
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

                  {/* Explanation Summary */}
                  <div className="mt-5 rounded-xl bg-slate-900/60 p-3.5 border border-slate-800/80">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {getRiskExplanation(reading)}
                    </p>
                  </div>

                  {/* Contributing Factors */}
                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Contributing Factors & Trends:
                    </p>
                    <ul className="mt-2.5 space-y-2 text-xs">
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

                <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span>Evaluation: Deterministic Correlation Engine</span>
                  <span className="font-mono">{reading.status}</span>
                </div>
              </section>

              {/* REQUIREMENT 2: Separate Sensor Health & Confidence Card */}
              <section className="rounded-2xl border border-surface-border bg-surface-card p-6 shadow-xl shadow-black/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-teal-400" />
                      Sensor Health & Confidence
                    </h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold tracking-wider border ${
                        reading.sensor_confidence >= 85
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : reading.sensor_confidence >= 60
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {reading.sensor_confidence >= 85
                        ? "HIGH TRUST"
                        : reading.sensor_confidence >= 60
                        ? "MODERATE TRUST"
                        : "LOW TRUST"}
                    </span>
                  </div>

                  {/* Confidence Score & Quality */}
                  <div className="mt-5 flex items-baseline justify-between">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-mono font-bold text-white">
                          {reading.sensor_confidence}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Data reliability & transducer plausibility score
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-400">Data Stream:</span>
                      <p className="font-mono text-sm font-bold text-slate-200">
                        {reading.sensor_health.data_quality}
                      </p>
                    </div>
                  </div>

                  {/* Visual Confidence Bar */}
                  <div className="mt-4 h-2.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        reading.sensor_confidence >= 85
                          ? "bg-emerald-500"
                          : reading.sensor_confidence >= 60
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, reading.sensor_confidence))}%` }}
                    />
                  </div>

                  {/* Trustworthiness Summary */}
                  <div className="mt-5 rounded-xl bg-slate-900/60 p-3.5 border border-slate-800/80">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {getConfidenceSummary(reading)}
                    </p>
                  </div>

                  {/* Channel Status Breakdown */}
                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Channel Health Status:
                    </p>
                    <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 border border-slate-700/40">
                        <span className="text-xs text-slate-300 font-medium">MPU6050 (Tilt & Gyro)</span>
                        {renderHealthBadge(reading.sensor_health.mpu6050)}
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 border border-slate-700/40">
                        <span className="text-xs text-slate-300 font-medium">HC-SR04 (Distance)</span>
                        {renderHealthBadge(reading.sensor_health.hcsr04)}
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 border border-slate-700/40">
                        <span className="text-xs text-slate-300 font-medium">Connectivity</span>
                        {renderHealthBadge(reading.sensor_health.connectivity)}
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 border border-slate-700/40">
                        <span className="text-xs text-slate-300 font-medium">Data Quality</span>
                        {renderHealthBadge(reading.sensor_health.data_quality)}
                      </div>
                    </div>
                  </div>
                </div>

                {reading.sensor_health.issues && reading.sensor_health.issues.length > 0 && (
                  <div className="mt-4 rounded-lg bg-amber-500/10 p-2.5 border border-amber-500/20">
                    <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                      <span>{reading.sensor_health.issues[0]}</span>
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* REQUIREMENT 4: SEPARATE REAL-TIME SENSOR TELEMETRY SECTION */}
            <section className="mb-12">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                  <Radio className="h-5 w-5 text-teal-400" />
                  Real-Time Sensor Telemetry
                </h2>
                <span className="text-xs text-slate-400">Live hardware channels</span>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <MetricTile 
                  label="Tilt X" 
                  value={reading.tilt_x} 
                  unit="°" 
                  size="lg" 
                  activeFlags={Math.abs(reading.tilt_x) >= 15 ? reading.warnings.filter(w => w === "EXCESSIVE_TILT") : []} 
                />
                <MetricTile 
                  label="Tilt Y" 
                  value={reading.tilt_y} 
                  unit="°" 
                  size="lg" 
                  activeFlags={Math.abs(reading.tilt_y) >= 15 ? reading.warnings.filter(w => w === "EXCESSIVE_TILT") : []} 
                />
                <MetricTile
                  label="Vibration"
                  value={reading.vibration}
                  unit="g"
                  size="lg"
                  activeFlags={reading.warnings.filter(w => w === "HIGH_VIBRATION")}
                />
                <MetricTile
                  label="Distance"
                  value={reading.distance}
                  unit="cm"
                  size="lg"
                />
                <MetricTile
                  label="Displacement"
                  value={reading.displacement}
                  unit="cm"
                  size="lg"
                  activeFlags={reading.warnings.filter(w => w === "ABNORMAL_DISPLACEMENT")}
                />
              </div>

              {(() => {
                const unmappedWarnings = reading.warnings.filter(w => 
                  w !== "EXCESSIVE_TILT" && 
                  w !== "HIGH_VIBRATION" && 
                  w !== "ABNORMAL_DISPLACEMENT"
                );
                
                if (unmappedWarnings.length === 0) return null;
                
                return (
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm font-medium text-status-critical text-left">
                    {unmappedWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                );
              })()}
            </section>

            {/* REQUIREMENT 4: SEPARATE HISTORICAL TRENDS SECTION */}
            <section className="mt-8">
              <h2 className="mb-6 text-xl font-bold tracking-tight text-slate-100 text-left">
                Historical Trends
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <TrendChart
                  data={history}
                  dataKey="tilt_x"
                  label="Tilt X"
                  unit="°"
                  color="#2563eb"
                />
                <TrendChart
                  data={history}
                  dataKey="tilt_y"
                  label="Tilt Y"
                  unit="°"
                  color="#7c3aed"
                />
                <TrendChart
                  data={history}
                  dataKey="vibration"
                  label="Vibration"
                  unit="g"
                  color="#d97706"
                />
                <TrendChart
                  data={history}
                  dataKey="distance"
                  label="Distance"
                  unit="cm"
                  color="#0d9488"
                />
                <TrendChart
                  data={history}
                  dataKey="displacement"
                  label="Displacement"
                  unit="cm"
                  color="#e11d48"
                />
              </div>
            </section>
          </div>

          {/* Right Column: Alert History */}
          <div className="lg:w-[30%] lg:flex-none lg:ml-auto h-[800px] lg:h-[calc(100vh-8rem)] lg:sticky lg:top-8 text-left">
            <AlertHistoryPanel nodeId={nodeId} showFilters={false} />
          </div>
        </div>
      )}
    </main>
  );
}
