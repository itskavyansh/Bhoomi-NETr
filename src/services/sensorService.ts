import type { RawSensorRow, SensorReading, TimePoint } from "../types/sensor";
import { analyzeReading } from "./analysisAdapter";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

const LATEST_ROW_WINDOW = 200;
export const LIVE_HISTORY_LIMIT = 20;

// Default baseline distance in cm (HC-SR04 baseline when ground is undisturbed)
const DEFAULT_BASELINE_DISTANCE = 20.0;

function baselineForNode(_nodeId: string): number {
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
      analyzeReading(row, baselineForNode(row.node_id)),
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

/**
 * Fetch historical time points for a specific node_id.
 * Queries recent rows descending by timestamp, then reverses them so charts
 * render in chronological order (oldest to newest).
 */
export async function fetchNodeHistory(
  nodeId: string,
  limit = 20,
): Promise<TimePoint[]> {
  if (!isSupabaseConfigured || supabase === null) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("sensor_readings")
      .select("id, node_id, timestamp, tilt_x, tilt_y, vibration, distance")
      .eq("node_id", nodeId)
      .lte("timestamp", new Date().toISOString())
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const baseline = baselineForNode(nodeId);
    // Reverse rows so time ascends left-to-right on trend charts
    const chronologicallyOrdered = parseRawRows(data).reverse();

    return chronologicallyOrdered.map((row) => ({
      timestamp: row.timestamp,
      tilt_x: row.tilt_x,
      vibration: row.vibration,
      displacement: Number((baseline - row.distance).toFixed(2)),
    }));
  } catch (error) {
    console.error("fetchNodeHistory failed:", error);
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
  if (isSupabaseConfigured && supabase !== null) {
    const client = supabase;
    realtimeListeners.add(onUpdate);

    if (realtimeChannel === null) {
      realtimeChannel = client
        .channel("sensor_readings_realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sensor_readings" },
          (payload) => {
            const raw = payload.new;
            if (isRawSensorRow(raw)) {
              const analyzed = analyzeReading(raw, baselineForNode(raw.node_id));
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

    return () => {
      realtimeListeners.delete(onUpdate);
      if (realtimeListeners.size === 0 && realtimeChannel !== null) {
        void client.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    };
  }

  // No-op if Supabase is not configured
  return () => {};
}
