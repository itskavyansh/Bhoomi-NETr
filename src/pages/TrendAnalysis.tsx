import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, RefreshCw } from "lucide-react";
import { DataStatus } from "../components/DataStatus";
import { LiveIndicator } from "../components/LiveIndicator";
import { TrendChart } from "../components/TrendChart";
import { TrendSummaryTile } from "../components/TrendSummaryTile";
import { PredictiveStatusCard } from "../components/PredictiveStatusCard";
import {
  fetchLatestReadings,
  fetchNodeHistory,
  subscribeToReadings,
  type TimeRange,
} from "../services/sensorService";
import {
  performTrendAnalysis,
  type PredictiveAnalysisResult,
} from "../services/trendAnalysis";
import type { TimePoint } from "../types/sensor";
import {
  DISPLACEMENT_WARNING,
  DISPLACEMENT_CRITICAL,
  TILT_WARNING,
  TILT_CRITICAL,
  VIBRATION_WARNING,
  VIBRATION_CRITICAL,
} from "../services/analysisAdapter";

const DEFAULT_NODES = ["NODE_01", "NODE_02", "NODE_03"];

const TIME_RANGES: { id: TimeRange; label: string }[] = [
  { id: "recent", label: "Recent (Live)" },
  { id: "1h", label: "1 Hour" },
  { id: "6h", label: "6 Hours" },
  { id: "24h", label: "24 Hours" },
  { id: "7d", label: "7 Days" },
];

export function TrendAnalysis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const nodeParam = searchParams.get("node");

  const [availableNodes, setAvailableNodes] = useState<string[]>(DEFAULT_NODES);
  const [selectedNode, setSelectedNode] = useState<string>(nodeParam || "NODE_01");
  const [timeRange, setTimeRange] = useState<TimeRange>("recent");
  const [history, setHistory] = useState<TimePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync selected node with URL parameter
  useEffect(() => {
    if (nodeParam && nodeParam !== selectedNode) {
      setSelectedNode(nodeParam);
    }
  }, [nodeParam, selectedNode]);

  const handleSelectNode = (nodeId: string) => {
    setSelectedNode(nodeId);
    setSearchParams({ node: nodeId });
  };

  // Initial load of latest nodes
  useEffect(() => {
    let cancelled = false;

    async function loadNodes() {
      try {
        const latest = await fetchLatestReadings();
        if (cancelled) return;
        if (latest.length > 0) {
          const discovered = Array.from(new Set(latest.map((r) => r.node_id))).sort();
          setAvailableNodes(discovered);
          if (!nodeParam && !discovered.includes(selectedNode)) {
            setSelectedNode(discovered[0]);
          }
        }
      } catch (e) {
        console.error("Failed to load node list:", e);
      }
    }

    void loadNodes();
    return () => {
      cancelled = true;
    };
  }, [nodeParam, selectedNode]);

  // Fetch historical data for selected node and time range
  const loadHistory = useCallback(
    async (nodeId: string, range: TimeRange) => {
      setLoading(true);
      setError(null);
      try {
        const points = await fetchNodeHistory(nodeId, range);
        setHistory(points);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load telemetry history.");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadHistory(selectedNode, timeRange);
  }, [selectedNode, timeRange, loadHistory]);

  // Realtime subscription: append incoming readings to history if relevant
  useEffect(() => {
    let cancelled = false;

    const unsubscribe = subscribeToReadings((updatedReadings) => {
      if (cancelled) return;

      // Check if our selected node received a new reading
      const matching = updatedReadings.find((r) => r.node_id === selectedNode);
      if (matching) {
        setHistory((prev) => {
          const newPoint: TimePoint = {
            timestamp: matching.timestamp,
            tilt_x: matching.tilt_x,
            tilt_y: matching.tilt_y,
            vibration: matching.vibration,
            distance: matching.distance,
            displacement: matching.displacement,
            risk_score: matching.risk_score,
          };

          // Filter out duplicates
          const filtered = prev.filter((p) => p.timestamp !== newPoint.timestamp);
          const merged = [...filtered, newPoint].sort((a, b) =>
            a.timestamp.localeCompare(b.timestamp)
          );

          // For 'recent', keep last 40 points
          if (timeRange === "recent" && merged.length > 40) {
            return merged.slice(merged.length - 40);
          }
          return merged;
        });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [selectedNode, timeRange]);

  // Calculate trend analysis and predictive metrics
  const analysis: PredictiveAnalysisResult = useMemo(() => {
    return performTrendAnalysis(selectedNode, history);
  }, [selectedNode, history]);

  return (
    <main className="dashboard-shell py-10 lg:py-12">
      <header className="mb-8 flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow mb-2">Telemetry intelligence</p>
            <h1 className="page-title">Trend analysis & prediction</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Explore subsidence kinematics, progression signals, and early-warning projections for one monitoring node at a time.</p>
          </div>
          {!loading && !error && <LiveIndicator />}
        </div>

        <div className="panel-surface flex flex-col gap-5 rounded-2xl p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <label className="block min-w-0 lg:w-56">
            <span className="eyebrow mb-2 block">Monitoring node</span>
            <select value={selectedNode} onChange={(event) => handleSelectNode(event.target.value)} className="w-full rounded-lg border border-surface-border bg-surface-tile px-3 py-2.5 font-mono text-sm font-semibold text-slate-100 outline-none transition focus:border-teal-300/60">
              {availableNodes.map((nodeId) => <option key={nodeId} value={nodeId}>{nodeId}</option>)}
            </select>
          </label>

          <div className="min-w-0 flex-1">
            <span className="eyebrow mb-2 block">Time window</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-surface-border bg-surface-tile p-1 sm:grid-cols-5">
              {TIME_RANGES.map((r) => {
                const active = r.id === timeRange;
                return <button key={r.id} onClick={() => setTimeRange(r.id)} className={`rounded-md px-2 py-2 text-xs font-semibold transition ${active ? "bg-teal-300/10 text-teal-200 shadow-sm" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"}`}>{r.label}</button>;
              })}
            </div>
          </div>

          <button onClick={() => { setIsRefreshing(true); void loadHistory(selectedNode, timeRange); }} title="Refresh historical data" className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface-tile px-3 text-xs font-semibold text-slate-300 transition hover:border-teal-300/30 hover:text-teal-200 lg:w-10 lg:px-0">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-teal-400" : ""}`} />
            <span className="lg:hidden">Refresh</span>
          </button>
        </div>
      </header>

      <DataStatus loading={loading} error={error} loadingLabel="Analyzing telemetry trends…" />

      {!loading && !error && (
        <div className="space-y-8">
          {/* Section 1: Predictive Failure & Early Warning */}
          <PredictiveStatusCard analysis={analysis} />

          {/* Section 2: Summary Kinematics & Rate of Change Tiles */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                <Activity className="h-5 w-5 text-teal-400" />
                Kinematics & Rate-of-Change Summary
              </h2>
              <span className="font-mono text-xs text-slate-400">
                {analysis.sampleCount} observations over {analysis.observationWindowSeconds}s window
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {/* Tile 1: Displacement */}
              <TrendSummaryTile
                label="Displacement"
                value={analysis.displacement.currentDisplacement.toFixed(2)}
                numericValue={analysis.displacement.currentDisplacement}
                decimals={2}
                unit="cm"
                direction={analysis.displacement.direction}
                classification={analysis.displacement.classification}
                isWarning={analysis.displacement.currentDisplacement >= DISPLACEMENT_WARNING}
                isCritical={analysis.displacement.currentDisplacement >= DISPLACEMENT_CRITICAL}
                rate={
                  analysis.displacement.velocityCmPerMin !== null
                    ? `${analysis.displacement.velocityCmPerMin > 0 ? "+" : ""}${analysis.displacement.velocityCmPerMin.toFixed(2)} cm/min`
                    : null
                }
                subtext={`Warning threshold: ${DISPLACEMENT_WARNING.toFixed(1)} cm`}
              />

              {/* Tile 2: Velocity */}
              <TrendSummaryTile
                label="Disp. Velocity"
                value={
                  analysis.displacement.velocityCmPerMin !== null
                    ? (analysis.displacement.velocityCmPerMin > 0 ? "+" : "") +
                      analysis.displacement.velocityCmPerMin.toFixed(3)
                    : "—"
                }
                numericValue={analysis.displacement.velocityCmPerMin}
                decimals={3}
                unit="cm/min"
                direction={analysis.displacement.direction}
                rate={
                  analysis.displacement.velocityCmPerSec !== null
                    ? `${(analysis.displacement.velocityCmPerSec * 10).toFixed(2)} mm/s`
                    : null
                }
                isWarning={(analysis.displacement.velocityCmPerMin ?? 0) > 0.05}
                isCritical={(analysis.displacement.velocityCmPerMin ?? 0) > 0.15}
                subtext="Rate of ground subsidence"
              />

              {/* Tile 3: Acceleration */}
              <TrendSummaryTile
                label="Disp. Acceleration"
                value={
                  analysis.displacement.accelerationCmPerMin2 !== null
                    ? (analysis.displacement.accelerationCmPerMin2 > 0 ? "+" : "") +
                      analysis.displacement.accelerationCmPerMin2.toFixed(3)
                    : "—"
                }
                numericValue={analysis.displacement.accelerationCmPerMin2}
                decimals={3}
                unit="cm/min²"
                direction={
                  (analysis.displacement.accelerationCmPerMin2 ?? 0) > 0.005
                    ? "INCREASING"
                    : (analysis.displacement.accelerationCmPerMin2 ?? 0) < -0.005
                    ? "DECREASING"
                    : "STABLE"
                }
                isCritical={analysis.displacement.isAccelerating}
                isWarning={(analysis.displacement.accelerationCmPerMin2 ?? 0) > 0.01}
                subtext={
                  analysis.displacement.isAccelerating
                    ? "Accelerating runaway movement"
                    : "Subsidence rate steady"
                }
              />

              {/* Tile 4: Tilt */}
              <TrendSummaryTile
                label="Max Tilt Angle"
                value={analysis.tilt.current.toFixed(1)}
                numericValue={analysis.tilt.current}
                decimals={1}
                unit="°"
                direction={analysis.tilt.direction}
                classification={analysis.tilt.classification}
                isWarning={analysis.tilt.current >= TILT_WARNING}
                isCritical={analysis.tilt.current >= TILT_CRITICAL}
                rate={
                  analysis.tilt.rateOfChangePerMin !== null
                    ? `${analysis.tilt.rateOfChangePerMin > 0 ? "+" : ""}${analysis.tilt.rateOfChangePerMin.toFixed(2)}°/min`
                    : null
                }
                subtext={`Warning threshold: ${TILT_WARNING.toFixed(0)}°`}
              />

              {/* Tile 5: Vibration */}
              <TrendSummaryTile
                label="Vibration"
                value={analysis.vibration.current.toFixed(3)}
                numericValue={analysis.vibration.current}
                decimals={3}
                unit="g"
                direction={analysis.vibration.direction}
                classification={analysis.vibration.classification}
                isWarning={analysis.vibration.current >= VIBRATION_WARNING}
                isCritical={analysis.vibration.current >= VIBRATION_CRITICAL}
                rate={
                  analysis.vibration.rateOfChangePerMin !== null
                    ? `${analysis.vibration.rateOfChangePerMin > 0 ? "+" : ""}${analysis.vibration.rateOfChangePerMin.toFixed(3)} g/min`
                    : null
                }
                subtext={
                  analysis.vibration.isSpike
                    ? "Spike normalized"
                    : `Warning threshold: ${VIBRATION_WARNING.toFixed(1)} g`
                }
              />

              {/* Tile 6: Risk Score */}
              <TrendSummaryTile
                label="Risk Score"
                value={analysis.risk.current}
                numericValue={analysis.risk.current}
                decimals={0}
                unit="/100"
                direction={analysis.risk.direction}
                isWarning={analysis.risk.current >= 40}
                isCritical={analysis.risk.current >= 80}
                rate={
                  analysis.risk.rateOfChangePerMin !== null
                    ? `${analysis.risk.rateOfChangePerMin > 0 ? "+" : ""}${analysis.risk.rateOfChangePerMin.toFixed(1)}/min`
                    : null
                }
                subtext="Existing multi-factor index"
              />
            </div>
          </section>

          {/* Section 3: Recharts Historical Trend Graphs with Threshold Lines */}
          <section>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-slate-100 text-left">
                Multi-Sensor Historical Trends & Operating Envelopes
              </h2>
              <span className="text-xs font-mono text-slate-400">
                Orange = Warning Threshold • Red = Critical Threshold
              </span>
            </div>


            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Graph 1: Displacement */}
              <TrendChart
                data={history}
                dataKey="displacement"
                label="Displacement (cm)"
                unit="cm"
                color="#f43f5e"
              />

              {/* Graph 2: Tilt (X & Y) */}
              <TrendChart
                data={history}
                dataKey="tilt_x"
                label="Tilt X Angle (°)"
                unit="°"
                color="#3b82f6"
              />

              {/* Graph 3: Vibration */}
              <TrendChart
                data={history}
                dataKey="vibration"
                label="Vibration Magnitude (g)"
                unit="g"
                color="#f59e0b"
              />

              {/* Graph 4: Risk Score */}
              <TrendChart
                data={history}
                dataKey="risk_score"
                label="Subsidence Risk Score (0-100)"
                unit=""
                color="#10b981"
              />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
