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
import { Breadcrumb } from "../components/Breadcrumb";
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
      <span className="inline-flex items-center gap-1 rounded bg-[var(--status-success-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-success)] border border-[var(--status-success)]/30">
        <CheckCircle className="h-3.5 w-3.5" />
        GOOD
      </span>
    );
  }
  if (status === "UNSTABLE" || status === "DEGRADED") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-[var(--status-warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-warning)] border border-[var(--status-warning)]/30">
        <AlertTriangle className="h-3.5 w-3.5" />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[var(--status-danger-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-danger)] border border-[var(--status-danger)]/30">
      <XCircle className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

function getConfidenceSummary(reading: SensorReading): string {
  const isFault =
    reading.sensor_health?.mpu6050_status === "fault" ||
    reading.sensor_health?.hc_sr04_status === "fault";

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
    <main id="main-content" className="dashboard-shell py-10 lg:py-12" tabIndex={-1} style={{ outline: "none" }}>
      <Breadcrumb items={[{ label: "Analysis" }, { label: "Structural Health" }]} />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow mb-2">Telemetry integrity</p>
          <h1 className="page-title">Structural &amp; Sensor Health</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Real-time telemetry quality, transducer plausibility, and operational reliability across all sensor nodes.
          </p>
        </div>
        {!loading && !error && <LiveIndicator />}
      </div>

      <DataStatus loading={loading} error={error} />

      {!loading && !error && (
        <>
          {/* Fleet Summary Stats */}
          <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xs border-l-4 border-l-[var(--brand-teal)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Total Monitored Nodes
                </p>
                <ShieldCheck className="h-5 w-5 text-[var(--brand-teal)]" />
              </div>
              <p className="text-3xl font-mono font-bold text-[var(--text-primary)]">{totalNodes}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Active hardware nodes</p>
            </div>

            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xs border-l-4 border-l-[var(--status-success)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  High Confidence
                </p>
                <CheckCircle className="h-5 w-5 text-[var(--status-success)]" />
              </div>
              <p className="text-3xl font-mono font-bold text-[var(--text-primary)]">{highTrustNodes}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Confidence ≥ 85%</p>
            </div>

            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xs border-l-4 border-l-[var(--status-warning)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Degraded Quality
                </p>
                <AlertTriangle className="h-5 w-5 text-[var(--status-warning)]" />
              </div>
              <p className="text-3xl font-mono font-bold text-[var(--text-primary)]">{moderateTrustNodes}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Confidence 60–84%</p>
            </div>

            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xs border-l-4 border-l-[var(--status-danger)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Fleet Avg Confidence
                </p>
                <ShieldAlert className="h-5 w-5 text-[var(--status-danger)]" />
              </div>
              <p className="text-3xl font-mono font-bold text-[var(--text-primary)]">{avgConfidence}%</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
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
                  className="flex flex-col justify-between rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 sm:p-6 shadow-xs transition-all duration-200 hover:border-[var(--brand-green)]"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold tracking-wider text-[var(--text-primary)]">
                          {reading.node_id}
                        </h2>
                        {(reading.sensor_health.mpu6050_status === "fault" ||
                          reading.sensor_health.hc_sr04_status === "fault" ||
                          reading.sensor_health.ads1115_status === "fault") && (
                          <span className="inline-flex items-center gap-1 rounded bg-[var(--status-danger-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--status-danger)] border border-[var(--status-danger)]/30">
                            <AlertTriangle className="h-3 w-3 text-[var(--status-danger)]" />
                            HARDWARE FAULT
                          </span>
                        )}
                        {reading.sensor_health.mpu6050_status === "ok" &&
                          reading.sensor_health.hc_sr04_status === "ok" &&
                          (reading.sensor_health.ads1115_status === "ok" || reading.sensor_health.ads1115_status == null) && (
                            <span className="inline-flex items-center gap-1 rounded bg-[var(--status-success-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--status-success)] border border-[var(--status-success)]/30">
                              <CheckCircle className="h-3 w-3 text-[var(--status-success)]" />
                              HW OK
                            </span>
                          )}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold tracking-wider border ${
                          isLowTrust
                            ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger)]/30"
                            : isModerateTrust
                            ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]/30"
                            : "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]/30"
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
                          <span className="text-4xl font-mono font-bold text-[var(--text-primary)]">
                            {reading.sensor_confidence}%
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                          Data Reliability & Sensor Confidence
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">Stream Status:</span>
                        <p className="font-mono text-sm font-bold text-[var(--text-primary)]">
                          {reading.sensor_health.data_quality}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 h-2 w-full rounded-full bg-[var(--surface-muted)] border border-[var(--border)] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          reading.sensor_confidence >= 85
                            ? "bg-[var(--status-success)]"
                            : reading.sensor_confidence >= 60
                            ? "bg-[var(--status-warning)]"
                            : "bg-[var(--status-danger)]"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, reading.sensor_confidence))}%` }}
                      />
                    </div>

                    {/* Summary explanation */}
                    <div className="mt-4 rounded-lg bg-[var(--surface-alt)] p-3.5 border border-[var(--border)]">
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {getConfidenceSummary(reading)}
                      </p>
                    </div>

                    {/* Channels */}
                    <div className="mt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                        Individual Sensor Channels:
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-3 py-2 border border-[var(--border)] text-xs">
                          <span className="text-[var(--text-primary)] font-medium">MPU6050 (Tilt & Gyro)</span>
                          {renderHealthBadge(reading.sensor_health.mpu6050)}
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-3 py-2 border border-[var(--border)] text-xs">
                          <span className="text-[var(--text-primary)] font-medium">HC-SR04 (Ultrasonic)</span>
                          {renderHealthBadge(reading.sensor_health.hcsr04)}
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-3 py-2 border border-[var(--border)] text-xs">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-[var(--text-primary)] font-medium">ADS1115 (Piezo/ADC)</span>
                            {(reading.piezo_peak != null || reading.piezo_rms != null) && (
                              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                                Peak: {reading.piezo_peak != null ? `${reading.piezo_peak.toFixed(4)}V` : "—"} · RMS: {reading.piezo_rms != null ? `${reading.piezo_rms.toFixed(4)}V` : "—"}
                              </span>
                            )}
                          </div>
                          {renderHealthBadge(reading.sensor_health.ads1115)}
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-3 py-2 border border-[var(--border)] text-xs">
                          <span className="text-[var(--text-primary)] font-medium">Connectivity / Freshness</span>
                          {renderHealthBadge(reading.sensor_health.connectivity)}
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-3 py-2 border border-[var(--border)] text-xs">
                          <span className="text-[var(--text-primary)] font-medium">Data Quality</span>
                          {renderHealthBadge(reading.sensor_health.data_quality)}
                        </div>
                        {(reading.sensor_health.mpu6050_status ||
                          reading.sensor_health.hc_sr04_status ||
                          reading.sensor_health.ads1115_status) && (
                          <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-3 py-2 border border-[var(--border)] text-xs">
                            <span className="text-[var(--text-primary)] font-medium">Firmware Telemetry Diagnostic</span>
                            {reading.sensor_health.mpu6050_status === "fault" ||
                            reading.sensor_health.hc_sr04_status === "fault" ||
                            reading.sensor_health.ads1115_status === "fault" ? (
                              <span className="inline-flex items-center gap-1 rounded bg-[var(--status-danger-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-danger)] border border-[var(--status-danger)]/30">
                                <XCircle className="h-3.5 w-3.5 text-[var(--status-danger)]" />
                                FAULT REPORTED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-[var(--status-success-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-success)] border border-[var(--status-success)]/30">
                                <CheckCircle className="h-3.5 w-3.5 text-[var(--status-success)]" />
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
                    reading.sensor_health.ads1115_status === "fault" ? (
                      <div className="mt-4 rounded-lg bg-[var(--alert-critical-bg)] p-2.5 border border-[var(--alert-critical-border)]">
                        <p className="text-[11px] text-[var(--alert-critical-text)] flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-[var(--status-danger)]" />
                          <span>Hardware Fault Reported by Firmware Telemetry</span>
                        </p>
                      </div>
                    ) : reading.sensor_health.issues && reading.sensor_health.issues.length > 0 ? (
                      <div className="mt-4 rounded-lg bg-[var(--alert-warning-bg)] p-2.5 border border-[var(--alert-warning-border)]">
                        <p className="text-[11px] text-[var(--alert-warning-text)] flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-[var(--status-warning)]" />
                          <span>{reading.sensor_health.issues[0]}</span>
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Footer link to Node Detail */}
                  <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Telemetry: {new Date(reading.timestamp).toLocaleTimeString()}
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
