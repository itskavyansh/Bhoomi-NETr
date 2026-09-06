import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DataStatus } from "../components/DataStatus";
import { LiveIndicator } from "../components/LiveIndicator";
import { MetricTile } from "../components/MetricTile";
import { StatusBadge } from "../components/StatusBadge";
import { TrendChart } from "../components/TrendChart";
import { AlertHistoryPanel } from "../components/AlertHistoryPanel";
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
    vibration: reading.vibration,
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
            <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
                NODE {reading.node_id}
              </h1>
              <div className="flex items-center gap-4">
                <LiveIndicator />
                <StatusBadge status={reading.status} />
              </div>
            </header>

            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              <MetricTile 
                label="Tilt" 
                value={reading.tilt_x} 
                unit="°" 
                size="lg" 
                activeFlags={reading.warnings.filter(w => w === "EXCESSIVE_TILT")} 
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
                <ul className="mt-6 list-disc space-y-1 pl-5 text-sm font-medium text-status-critical text-left">
                  {unmappedWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              );
            })()}

            <section className="mt-16">
              <h2 className="mb-6 text-xl font-bold tracking-tight text-slate-100 text-left">
                Historical Trends
              </h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <TrendChart
                  data={history}
                  dataKey="tilt_x"
                  label="Tilt"
                  unit="°"
                  color="#2563eb"
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
