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
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Top Header & Node / Time Range Selectors */}
      <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
              TREND ANALYSIS & PREDICTION
            </h1>
            <LiveIndicator />
          </div>
          <p className="mt-1 text-sm font-medium text-slate-400">
            Advanced subsidence kinematics, progression detection, and early warning projection
          </p>
        </div>

        {/* Controls: Node Selector & Time Range */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Node Selector Pills */}
          <div className="flex items-center rounded-xl border border-surface-border bg-surface-card p-1 shadow-inner">
            {availableNodes.map((nodeId) => {
              const active = nodeId === selectedNode;
              return (
                <button
                  key={nodeId}
                  onClick={() => handleSelectNode(nodeId)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                    active
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {nodeId}
                </button>
              );
            })}
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center rounded-xl border border-surface-border bg-surface-card p-1 shadow-inner">
            {TIME_RANGES.map((r) => {
              const active = r.id === timeRange;
              return (
                <button
                  key={r.id}
                  onClick={() => setTimeRange(r.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? "bg-white/10 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              setIsRefreshing(true);
              void loadHistory(selectedNode, timeRange);
            }}
            title="Refresh historical data"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-border bg-surface-card text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-teal-400" : ""}`} />
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
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-500" />
                Kinematics & Rate-of-Change Summary
              </h2>
              <span className="font-mono text-xs text-slate-500">
                {analysis.sampleCount} observations over {analysis.observationWindowSeconds}s window
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {/* Tile 1: Displacement */}
              <TrendSummaryTile
                label="Displacement"
                value={analysis.displacement.currentDisplacement.toFixed(2)}
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Multi-Sensor Historical Trends & Operating Envelopes
              </h2>
              <span className="text-xs font-mono text-slate-500">
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
