import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataStatus } from "../components/DataStatus";
import { LiveIndicator } from "../components/LiveIndicator";
import { StatusBadge } from "../components/StatusBadge";
import { AlertHistoryPanel } from "../components/AlertHistoryPanel";
import { fetchLatestReadings, subscribeToReadings } from "../services/sensorService";
import type { SensorReading } from "../types/sensor";

function countByStatus(
  readings: SensorReading[],
  status: SensorReading["status"],
): number {
  return readings.filter((reading) => reading.status === status).length;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  accentClass: string;
}

function StatCard({ label, value, icon, accentClass }: StatCardProps) {
  return (
    <div className={`rounded-xl border border-surface-border bg-surface-card p-5 shadow-lg shadow-black/40 ${accentClass}`}>
      <div className="mb-3">{icon}</div>
      <p className="text-3xl font-mono font-bold text-white">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

export function Home() {
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
        if (cancelled) {
          return;
        }
        setReadings(latest);
        unsubscribe = subscribeToReadings((updated) => {
          if (!cancelled) {
            setReadings(updated);
          }
        });
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Failed to load nodes.",
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
  }, []);

  const totalNodes = readings.length;
  const normalCount = countByStatus(readings, "NORMAL");
  const warningCount = countByStatus(readings, "WARNING");
  const criticalCount = countByStatus(readings, "CRITICAL");

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Left Column: Main Content */}
        <div className="flex-1 min-w-0">
          <section className="relative rounded-2xl border border-surface-border bg-surface-card px-6 py-12 text-center shadow-lg shadow-black/40 sm:px-12 animate-grid-flow">
            <h1 className="text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
              Mine Subsidence Monitoring System
            </h1>
            <div className="mt-4 flex justify-center">
              <LiveIndicator />
            </div>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium text-slate-400 md:text-base">
              Real-time structural health monitoring for underground mine sites
            </p>
            <Link
              to="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:scale-105 hover:bg-teal-500"
            >
              Open Live Dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

          <DataStatus loading={loading} error={error} />

          {!loading && !error && (
            <>
              <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Nodes"
                  value={totalNodes}
                  accentClass="border-l-4 border-l-teal-600"
                  icon={
                    <Activity className="h-6 w-6 text-teal-600" aria-hidden="true" />
                  }
                />
                <StatCard
                  label="Normal"
                  value={normalCount}
                  accentClass="border-l-4 border-l-green-500"
                  icon={
                    <CheckCircle
                      className="h-6 w-6 text-green-600"
                      aria-hidden="true"
                    />
                  }
                />
                <StatCard
                  label="Warnings"
                  value={warningCount}
                  accentClass="border-l-4 border-l-yellow-500"
                  icon={
                    <AlertTriangle
                      className="h-6 w-6 text-yellow-600"
                      aria-hidden="true"
                    />
                  }
                />
                <StatCard
                  label="Critical"
                  value={criticalCount}
                  accentClass="border-l-4 border-l-red-500"
                  icon={
                    <AlertOctagon className="h-6 w-6 text-red-600" aria-hidden="true" />
                  }
                />
              </section>

              <section className="mt-12">
                <h2 className="mb-5 text-xl font-bold tracking-tight text-slate-100">Nodes</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {readings.map((reading) => {
                    const borderClass = 
                      reading.status === "CRITICAL" ? "border-l-status-critical" : 
                      reading.status === "WARNING" ? "border-l-status-watch" : 
                      "border-l-surface-border";

                    return (
                      <Link
                        key={reading.node_id}
                        to={`/node/${reading.node_id}`}
                        className={`flex items-center justify-between rounded-xl border border-surface-border border-l-4 bg-surface-card px-5 py-4 shadow-lg shadow-black/40 transition-colors hover:bg-white/5 ${borderClass}`}
                      >
                        <span className="text-sm font-bold tracking-wider text-slate-100">
                          NODE {reading.node_id}
                        </span>
                        <StatusBadge status={reading.status} />
                      </Link>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Right Column: Alert History */}
        <div className="lg:w-[30%] lg:flex-none lg:ml-auto h-[800px] lg:h-[calc(100vh-6rem)] lg:sticky lg:top-8 text-left">
          <AlertHistoryPanel showFilters={true} />
        </div>
      </div>
    </main>
  );
}
