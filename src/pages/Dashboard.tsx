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
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
          MINE SUBSIDENCE MONITORING
        </h1>
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
