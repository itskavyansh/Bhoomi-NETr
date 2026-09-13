import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, AlertTriangle, CheckCircle, Radio } from "lucide-react";
import { Breadcrumb } from "../components/Breadcrumb";
import { DataStatus } from "../components/DataStatus";
import { LiveIndicator } from "../components/LiveIndicator";
import { NodeCard } from "../components/NodeCard";
import {
  fetchLatestReadings,
  subscribeToReadings,
} from "../services/sensorService";
import type { SensorReading } from "../types/sensor";

export function Dashboard() {
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

  const totalNodes    = readings.length;
  const normalCount   = readings.filter((r) => r.status === "NORMAL").length;
  const warningCount  = readings.filter((r) => r.status === "WARNING").length;
  const criticalCount = readings.filter((r) => r.status === "CRITICAL").length;

  return (
    <main id="main-content" className="dashboard-shell py-10 lg:py-12" tabIndex={-1} style={{ outline: "none" }}>
      <Breadcrumb items={[{ label: "Monitoring" }, { label: "Live Dashboard" }]} />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow mb-2">Operations overview</p>
          <h1 className="page-title">Live Node Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Real-time view of structural movement, sensor health, and active site conditions.
          </p>
        </div>
        {!loading && !error && <LiveIndicator />}
      </div>

      {/* Summary stat bar */}
      {!loading && !error && totalNodes > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Nodes",  value: totalNodes,    icon: <Radio        className="h-4 w-4 text-[var(--icon-primary)]" />, accent: "border-l-[var(--brand-teal)]" },
            { label: "Normal",       value: normalCount,   icon: <CheckCircle  className="h-4 w-4 text-[var(--status-success)]" />,  accent: "border-l-[var(--status-success)]" },
            { label: "Warnings",     value: warningCount,  icon: <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" />, accent: "border-l-[var(--status-warning)]" },
            { label: "Critical",     value: criticalCount, icon: <AlertOctagon className="h-4 w-4 text-[var(--status-danger)]" />, accent: "border-l-[var(--status-danger)]" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`flex items-center gap-3 rounded-lg border border-[var(--border)] border-l-4 bg-[var(--surface)] px-4 py-3 shadow-xs transition-colors ${stat.accent}`}
              role="status"
              aria-label={`${stat.label}: ${stat.value}`}
            >
              {stat.icon}
              <div className="min-w-0">
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{stat.value}</p>
                <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <DataStatus loading={loading} error={error} />

      {!loading && !error && (
        <div className="mt-2 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {readings.map((reading) => (
            <Link
              key={reading.node_id}
              to={`/node/${reading.node_id}`}
              className="group block"
            >
              <NodeCard reading={reading} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
