import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ShieldAlert,
  ShieldCheck,
  XCircle,
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

function getConfidenceSummary(reading: SensorReading): string {
  const isFault =
    reading.sensor_health?.mpu6050_status === "fault" ||
    reading.sensor_health?.hc_sr04_status === "fault" ||
    reading.sensor_health?.sensor_status === "fault";

  if (isFault) {
    return "Firmware telemetry explicitly reported a hardware transducer fault. Confidence is degraded regardless of plausibility checks.";
  }
  if (reading.sensor_confidence >= 85) {
    return "All transducers operating within physical limits with reliable live telemetry.";
  }
  if (reading.sensor_confidence >= 60) {
    return "Telemetry is slightly jittery or experiencing minor latency, but remains usable.";
  }
  return "Sensor data is unstable or out-of-bounds. Risk score calculation should be verified.";
}

export function StructuralHealth() {
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
  const highTrustNodes = readings.filter((r) => r.sensor_confidence >= 85).length;
  const moderateTrustNodes = readings.filter(
    (r) => r.sensor_confidence >= 60 && r.sensor_confidence < 85,
  ).length;
  const lowTrustNodes = readings.filter((r) => r.sensor_confidence < 60).length;
  const avgConfidence =
    totalNodes > 0
      ? Math.round(
          readings.reduce((acc, r) => acc + r.sensor_confidence, 0) / totalNodes,
        )
      : 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
            STRUCTURAL & SENSOR HEALTH
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time telemetry quality, transducer plausibility, and operational reliability across all sensor nodes
          </p>
        </div>
        {!loading && !error && <LiveIndicator />}
      </div>

      <DataStatus loading={loading} error={error} />

      {!loading && !error && (
        <>
          {/* Fleet Summary Stats */}
          <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-surface-border bg-surface-card p-5 shadow-lg shadow-black/40 border-l-4 border-l-teal-600">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Total Monitored Nodes
                </p>
                <ShieldCheck className="h-5 w-5 text-teal-500" />
              </div>
              <p className="text-3xl font-mono font-bold text-white">{totalNodes}</p>
              <p className="mt-1 text-xs text-slate-500">Active hardware nodes</p>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-card p-5 shadow-lg shadow-black/40 border-l-4 border-l-emerald-500">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  High Confidence
                </p>
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-3xl font-mono font-bold text-white">{highTrustNodes}</p>
              <p className="mt-1 text-xs text-slate-500">Confidence ≥ 85%</p>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-card p-5 shadow-lg shadow-black/40 border-l-4 border-l-amber-500">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Degraded Quality
                </p>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-3xl font-mono font-bold text-white">{moderateTrustNodes}</p>
              <p className="mt-1 text-xs text-slate-500">Confidence 60–84%</p>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-card p-5 shadow-lg shadow-black/40 border-l-4 border-l-rose-500">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Fleet Avg Confidence
                </p>
                <ShieldAlert className="h-5 w-5 text-rose-400" />
              </div>
              <p className="text-3xl font-mono font-bold text-white">{avgConfidence}%</p>
              <p className="mt-1 text-xs text-slate-500">
                {lowTrustNodes > 0 ? `${lowTrustNodes} node(s) low confidence` : "All nodes healthy"}
              </p>
            </div>
          </section>

          {/* Node Grid */}
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {readings.map((reading) => {
              const isLowTrust = reading.sensor_confidence < 60;
              const isModerateTrust =
                reading.sensor_confidence >= 60 && reading.sensor_confidence < 85;

              return (
                <article
                  key={reading.node_id}
                  className="flex flex-col justify-between rounded-2xl border border-surface-border bg-surface-card p-6 shadow-xl shadow-black/40 transition-all duration-300 hover:border-slate-600 hover:shadow-2xl"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold tracking-wider text-slate-100">
                          NODE {reading.node_id}
                        </h2>
                        {(reading.sensor_health.mpu6050_status === "fault" ||
                          reading.sensor_health.hc_sr04_status === "fault" ||
                          reading.sensor_health.sensor_status === "fault") && (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-300 border border-rose-500/40">
                            <AlertTriangle className="h-3 w-3 text-rose-400" />
                            HARDWARE FAULT REPORTED
                          </span>
                        )}
                        {reading.sensor_health.mpu6050_status === "ok" &&
                          reading.sensor_health.hc_sr04_status === "ok" && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/30">
                              <CheckCircle className="h-3 w-3" />
                              HW OK
                            </span>
                          )}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold tracking-wider border ${
                          isLowTrust
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : isModerateTrust
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {isLowTrust
                          ? "LOW TRUST"
                          : isModerateTrust
                          ? "MODERATE TRUST"
                          : "HIGH TRUST"}
                      </span>
                    </div>

                    {/* Overall Confidence Meter */}
                    <div className="mt-5 flex items-baseline justify-between">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-mono font-bold text-white">
                            {reading.sensor_confidence}%
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Data Reliability & Sensor Confidence
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-400">Stream Status:</span>
                        <p className="font-mono text-sm font-bold text-slate-200">
                          {reading.sensor_health.data_quality}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 h-2 w-full rounded-full bg-slate-800/90 overflow-hidden">
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

                    {/* Summary explanation */}
                    <div className="mt-4 rounded-xl bg-slate-900/60 p-3 border border-slate-800/80">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {getConfidenceSummary(reading)}
                      </p>
                    </div>

                    {/* Channels */}
                    <div className="mt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                        Individual Sensor Channels:
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 border border-slate-700/40 text-xs">
                          <span className="text-slate-300 font-medium">MPU6050 (Tilt & Gyro)</span>
                          {renderHealthBadge(reading.sensor_health.mpu6050)}
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 border border-slate-700/40 text-xs">
                          <span className="text-slate-300 font-medium">HC-SR04 (Ultrasonic)</span>
                          {renderHealthBadge(reading.sensor_health.hcsr04)}
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 border border-slate-700/40 text-xs">
                          <span className="text-slate-300 font-medium">Connectivity / Freshness</span>
                          {renderHealthBadge(reading.sensor_health.connectivity)}
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 border border-slate-700/40 text-xs">
                          <span className="text-slate-300 font-medium">Data Quality</span>
                          {renderHealthBadge(reading.sensor_health.data_quality)}
                        </div>
                        {(reading.sensor_health.mpu6050_status ||
                          reading.sensor_health.hc_sr04_status ||
                          reading.sensor_health.sensor_status) && (
                          <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 border border-slate-700/40 text-xs">
                            <span className="text-slate-300 font-medium">Firmware Telemetry Diagnostic</span>
                            {reading.sensor_health.mpu6050_status === "fault" ||
                            reading.sensor_health.hc_sr04_status === "fault" ||
                            reading.sensor_health.sensor_status === "fault" ? (
                              <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300 border border-rose-500/40">
                                <XCircle className="h-3.5 w-3.5" />
                                FAULT REPORTED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                                <CheckCircle className="h-3.5 w-3.5" />
                                HARDWARE OK
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Issues alert or Hardware Fault alert */}
                    {reading.sensor_health.mpu6050_status === "fault" ||
                    reading.sensor_health.hc_sr04_status === "fault" ||
                    reading.sensor_health.sensor_status === "fault" ? (
                      <div className="mt-4 rounded-lg bg-rose-500/15 p-2.5 border border-rose-500/30">
                        <p className="text-[11px] text-rose-300 flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-rose-400" />
                          <span>Hardware Fault Reported by Firmware Telemetry (Physical Transducer Degradation)</span>
                        </p>
                      </div>
                    ) : reading.sensor_health.issues && reading.sensor_health.issues.length > 0 ? (
                      <div className="mt-4 rounded-lg bg-amber-500/10 p-2.5 border border-amber-500/20">
                        <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                          <span>{reading.sensor_health.issues[0]}</span>
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Footer link to Node Detail */}
                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Telemetry: {new Date(reading.timestamp).toLocaleTimeString()}
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
