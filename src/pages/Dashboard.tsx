import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

  return (
    <main className="dashboard-shell py-10 lg:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow mb-2">Operations overview</p>
          <h1 className="page-title">Live node dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">A real-time view of structural movement, sensor health, and active site conditions.</p>
        </div>
        {!loading && !error && <LiveIndicator />}
      </div>
      <DataStatus loading={loading} error={error} />
      {!loading && !error && (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
