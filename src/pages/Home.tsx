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
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${accentClass}`}>
      <div className="mb-3">{icon}</div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-gray-500">{label}</p>
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
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm sm:px-12">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
          Mine Subsidence Monitoring System
        </h1>
        <div className="mt-3 flex justify-center">
          <LiveIndicator />
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-gray-500 sm:text-lg">
          Real-time structural health monitoring for underground mine sites
        </p>
        <Link
          to="/dashboard"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
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

          <section className="mt-10">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Nodes</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {readings.map((reading) => (
                <Link
                  key={reading.node_id}
                  to={`/node/${reading.node_id}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-teal-200 hover:shadow-md"
                >
                  <span className="text-sm font-semibold tracking-wide text-slate-800">
                    NODE {reading.node_id}
                  </span>
                  <StatusBadge status={reading.status} />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
