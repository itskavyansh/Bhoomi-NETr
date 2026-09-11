import type { RawSensorRow, SensorReading, TimePoint } from "../types/sensor";
import { analyzeReading } from "./analysisAdapter";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

const LATEST_ROW_WINDOW = 200;
export const LIVE_HISTORY_LIMIT = 20;

// Default baseline distance in cm (HC-SR04 baseline when ground is undisturbed)
const DEFAULT_BASELINE_DISTANCE = 20.0;

function baselineForNode(): number {
  return DEFAULT_BASELINE_DISTANCE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRawSensorRow(value: unknown): value is RawSensorRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (typeof value.id === "string" || typeof value.id === "number") &&
    typeof value.node_id === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.tilt_x === "number" &&
    typeof value.tilt_y === "number" &&
    typeof value.vibration === "number" &&
    typeof value.distance === "number"
  );
}

function parseRawRows(data: unknown): RawSensorRow[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isRawSensorRow);
}

function latestRowPerNode(rows: RawSensorRow[]): RawSensorRow[] {
  const latestByNode = new Map<string, RawSensorRow>();
  for (const row of rows) {
    if (!latestByNode.has(row.node_id)) {
      latestByNode.set(row.node_id, row);
    }
  }
  return Array.from(latestByNode.values());
}

// In-memory cache of the latest readings per node to provide instantaneous Realtime updates
const cachedLatestReadings = new Map<string, SensorReading>();

// Realtime subscription management
const realtimeListeners = new Set<(readings: SensorReading[]) => void>();
let realtimeChannel: RealtimeChannel | null = null;
let removeChannelTimeout: ReturnType<typeof setTimeout> | null = null;

// =============================================================================
// Live Supabase Production Service
// =============================================================================

/**
 * Fetch the most recent reading for each distinct node_id from Supabase.
 * On initial page load, this populates the dashboard immediately without waiting
 * for a new Realtime row insert.
 */
export async function fetchLatestReadings(): Promise<SensorReading[]> {
  if (!isSupabaseConfigured || supabase === null) {
    return Array.from(cachedLatestReadings.values());
  }

  try {
    const { data, error } = await supabase
      .from("sensor_readings")
      .select("id, node_id, timestamp, tilt_x, tilt_y, vibration, distance")
      .lte("timestamp", new Date().toISOString())
      .order("timestamp", { ascending: false })
      .limit(LATEST_ROW_WINDOW);

    if (error) {
      throw error;
    }

    const latestRows = latestRowPerNode(parseRawRows(data));
    const analyzedReadings = latestRows.map((row) =>
      analyzeReading(row, baselineForNode()),
    );

    // Keep cached map in sync
    for (const reading of analyzedReadings) {
      cachedLatestReadings.set(reading.node_id, reading);
    }

    return analyzedReadings;
  } catch (error) {
    console.error("fetchLatestReadings failed:", error);
    return Array.from(cachedLatestReadings.values());
  }
}

export type TimeRange = "recent" | "1h" | "6h" | "24h" | "7d";

/**
 * Fetch historical time points for a specific node_id.
 * Queries recent rows descending by timestamp, then reverses them so charts
 * render in chronological order (oldest to newest).
 * Supports numeric limit or named TimeRange ("recent", "1h", "6h", "24h", "7d").
 */
export async function fetchNodeHistory(
  nodeId: string,
  limitOrRange: number | TimeRange = 20,
): Promise<TimePoint[]> {
  if (!isSupabaseConfigured || supabase === null) {
    return [];
  }

  try {
    let query = supabase
      .from("sensor_readings")
      .select("id, node_id, timestamp, tilt_x, tilt_y, vibration, distance")
      .eq("node_id", nodeId)
      .lte("timestamp", new Date().toISOString())
      .order("timestamp", { ascending: false });

    if (typeof limitOrRange === "number") {
      query = query.limit(limitOrRange);
    } else {
      const now = Date.now();
      switch (limitOrRange) {
        case "1h":
          query = query.gte("timestamp", new Date(now - 3600 * 1000).toISOString()).limit(300);
          break;
        case "6h":
          query = query.gte("timestamp", new Date(now - 6 * 3600 * 1000).toISOString()).limit(600);
          break;
        case "24h":
          query = query.gte("timestamp", new Date(now - 24 * 3600 * 1000).toISOString()).limit(1200);
          break;
        case "7d":
          query = query.gte("timestamp", new Date(now - 7 * 86400 * 1000).toISOString()).limit(2500);
          break;
        case "recent":
        default:
          query = query.limit(30);
          break;
      }
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const baseline = baselineForNode();
    // Reverse rows so time ascends left-to-right on trend charts
    const chronologicallyOrdered = parseRawRows(data).reverse();

    return chronologicallyOrdered.map((row) => {
      const analyzed = analyzeReading(row, baseline);
      return {
        timestamp: row.timestamp,
        tilt_x: row.tilt_x,
        tilt_y: row.tilt_y,
        vibration: row.vibration,
        distance: row.distance,
        displacement: analyzed.displacement,
        risk_score: analyzed.risk_score,
      };
    });
  } catch (error) {
    console.error("fetchNodeHistory failed:", error);
    return [];
  }
}

export interface AlertTransition {
  id: string;
  node_id: string;
  timestamp: string;
  from_status: "NORMAL" | "WARNING" | "CRITICAL";
  to_status: "NORMAL" | "WARNING" | "CRITICAL";
  warnings: string[];
}

export async function fetchAlertHistory(limit = 1000): Promise<AlertTransition[]> {
  if (!isSupabaseConfigured || supabase === null) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("sensor_readings")
      .select("id, node_id, timestamp, tilt_x, tilt_y, vibration, distance")
      .lte("timestamp", new Date().toISOString())
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = parseRawRows(data).reverse();
    const baseline = baselineForNode();
    
    // Group by node
    const nodeHistories = new Map<string, SensorReading[]>();
    for (const row of rows) {
      if (!nodeHistories.has(row.node_id)) {
        nodeHistories.set(row.node_id, []);
      }
      nodeHistories.get(row.node_id)!.push(analyzeReading(row, baseline));
    }

    const transitions: AlertTransition[] = [];
    
    // Find transitions
    for (const [nodeId, readings] of nodeHistories.entries()) {
      let currentStatus: "NORMAL" | "WARNING" | "CRITICAL" = "NORMAL";
      for (const reading of readings) {
        if (reading.status !== currentStatus) {
          transitions.push({
            id: `${nodeId}-${reading.timestamp}`,
            node_id: nodeId,
            timestamp: reading.timestamp,
            from_status: currentStatus,
            to_status: reading.status,
            warnings: reading.warnings,
          });
          currentStatus = reading.status;
        }
      }
    }

    // Sort all transitions descending by timestamp
    transitions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return transitions;
  } catch (error) {
    console.error("fetchAlertHistory failed:", error);
    return [];
  }
}

/**
 * Subscribes to live sensor updates.
 * When Supabase is configured, uses Supabase Realtime (postgres_changes)
 * listening for INSERT events on public.sensor_readings.
 */
export function subscribeToReadings(
  onUpdate: (readings: SensorReading[]) => void,
): () => void {
  if (!isSupabaseConfigured || supabase === null) {
    return () => {};
  }

  const client = supabase;
  realtimeListeners.add(onUpdate);

  if (removeChannelTimeout !== null) {
    clearTimeout(removeChannelTimeout);
    removeChannelTimeout = null;
  }

  if (realtimeChannel === null) {
    const existing = client.getChannels().find(
      (ch) => ch.topic === "realtime:sensor_readings_realtime",
    );

    if (existing && (existing.state === "joined" || existing.state === "joining")) {
      realtimeChannel = existing;
    } else {
      if (existing) {
        void client.removeChannel(existing);
      }

      realtimeChannel = client
        .channel("sensor_readings_realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sensor_readings" },
          (payload) => {
            const raw = payload.new;
            if (isRawSensorRow(raw)) {
              const analyzed = analyzeReading(raw, baselineForNode());
              cachedLatestReadings.set(raw.node_id, analyzed);
              const updatedList = Array.from(cachedLatestReadings.values());
              realtimeListeners.forEach((listener) => {
                listener(updatedList);
              });
            } else {
              // Fallback: re-fetch if payload structure is partial
              fetchLatestReadings()
                .then((latest) => {
                  realtimeListeners.forEach((listener) => {
                    listener(latest);
                  });
                })
                .catch(console.error);
            }
          },
        )
        .subscribe();
    }
  }

  return () => {
    realtimeListeners.delete(onUpdate);
    if (realtimeListeners.size === 0) {
      if (removeChannelTimeout !== null) {
        clearTimeout(removeChannelTimeout);
      }
      removeChannelTimeout = setTimeout(() => {
        removeChannelTimeout = null;
        if (realtimeListeners.size === 0 && realtimeChannel !== null) {
          const ch = realtimeChannel;
          realtimeChannel = null;
          void client.removeChannel(ch);
        }
      }, 1000);
    }
  };
}
