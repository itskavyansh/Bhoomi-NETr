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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
        <h1 className="text-center text-2xl font-bold tracking-wide text-slate-800 sm:text-3xl">
          MINE SUBSIDENCE MONITORING
        </h1>
        {!loading && !error && <LiveIndicator />}
      </div>
      <DataStatus loading={loading} error={error} />
      {!loading && !error && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
