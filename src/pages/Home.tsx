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
    <div className={`rounded-xl border border-surface-border bg-surface-card/90 p-5 shadow-[0_12px_28px_rgba(0,0,0,0.16)] ${accentClass}`}>
      <div className="mb-5 flex items-center justify-between">{icon}<span className="font-mono text-[0.65rem] text-slate-600">LIVE</span></div>
      <p className="text-3xl font-mono font-bold tracking-tight text-slate-100">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
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
    <main className="dashboard-shell py-10 lg:py-12">
      <div className="mx-auto max-w-5xl">
          <section className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface-card/90 px-6 py-14 text-center shadow-[0_20px_50px_rgba(0,0,0,0.22)] sm:px-12 animate-grid-flow">
            <p className="eyebrow mb-4">Operational intelligence for safer ground</p>
            <h1 className="page-title mx-auto max-w-2xl">
              Know what the ground is doing before it becomes a problem.
            </h1>
            <div className="mt-4 flex justify-center">
              <LiveIndicator />
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
              A calm, live view of movement, sensor reliability, and subsidence risk across your underground site.
            </p>
            <Link
              to="/dashboard"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-teal-400 px-5 py-2.5 text-sm font-bold text-[#06202a] shadow-[0_8px_20px_rgba(59,195,190,0.16)] transition hover:bg-teal-300"
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
                <div className="mb-5 flex items-end justify-between gap-4"><div><p className="eyebrow mb-1">Current fleet</p><h2 className="text-xl font-bold tracking-tight text-slate-100">Monitored nodes</h2></div><span className="text-xs text-slate-500">Select a node for details</span></div>
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
    </main>
  );
}
