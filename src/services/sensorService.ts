import { mockReadings } from "../data/mockData";
import { generateHistory } from "../data/mockHistory";
import type { RawSensorRow, SensorReading, TimePoint } from "../types/sensor";
import {
  analyzeReading,
  DISPLACEMENT_CRITICAL,
  DISPLACEMENT_WARNING,
  TILT_CRITICAL,
  TILT_WARNING,
  VIBRATION_CRITICAL,
  VIBRATION_WARNING,
} from "./analysisAdapter";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

const MOCK_DELAY_MS = 250;
const LATEST_ROW_WINDOW = 200;
const LIVE_INTERVAL_MS = 3000;
export const LIVE_HISTORY_LIMIT = 20;

// Default baseline distance in cm (HC-SR04 baseline when ground is undisturbed)
const DEFAULT_BASELINE_DISTANCE = 20.0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

function cloneReadings(readings: SensorReading[]): SensorReading[] {
  return readings.map((reading) => ({
    ...reading,
    warnings: [...reading.warnings],
  }));
}

// In-memory cache of the latest readings per node to provide instantaneous Realtime updates
const cachedLatestReadings = new Map<string, SensorReading>();

// Realtime subscription management
const realtimeListeners = new Set<(readings: SensorReading[]) => void>();
let realtimeChannel: RealtimeChannel | null = null;

// =============================================================================
// Mock / Fallback Logic (used ONLY when Supabase credentials are not configured)
// =============================================================================
function round3(value: number): number {
  return Number(value.toFixed(3));
}

function randomJitterFactor(): number {
  const magnitude = 0.05 + Math.random() * 0.05;
  return Math.random() < 0.5 ? 1 - magnitude : 1 + magnitude;
}

const mockBaselines = new Map(
  mockReadings.map((reading) => [
    reading.node_id,
    reading.distance + reading.displacement,
  ]),
);

let liveMockReadings = cloneReadings(mockReadings);
const liveListeners = new Set<(readings: SensorReading[]) => void>();
let liveIntervalId: ReturnType<typeof setInterval> | null = null;

function mockBaselineForNode(nodeId: string): number {
  return mockBaselines.get(nodeId) ?? DEFAULT_BASELINE_DISTANCE;
}

function toRawRow(reading: SensorReading, timestamp: string): RawSensorRow {
  return {
    id: reading.node_id,
    node_id: reading.node_id,
    timestamp,
    tilt_x: reading.tilt_x,
    tilt_y: reading.tilt_y,
    vibration: reading.vibration,
    distance: reading.distance,
  };
}

function nudgeTowardLiveValues(reading: SensorReading): SensorReading {
  const timestamp = new Date().toISOString();
  const baseline = mockBaselineForNode(reading.node_id);
  const displacement = reading.displacement * randomJitterFactor();

  return analyzeReading(
    {
      ...toRawRow(reading, timestamp),
      tilt_x: round3(reading.tilt_x * randomJitterFactor()),
      tilt_y: round3(reading.tilt_y * randomJitterFactor()),
      vibration: Math.max(0, round3(reading.vibration * randomJitterFactor())),
      distance: round3(baseline - displacement),
    },
    baseline,
  );
}

function pushNodePastThreshold(reading: SensorReading): SensorReading {
  const timestamp = new Date().toISOString();
  const baseline = mockBaselineForNode(reading.node_id);
  const mode = Math.floor(Math.random() * 3);

  if (mode === 0) {
    return analyzeReading(
      {
        ...toRawRow(reading, timestamp),
        tilt_x: round3(2 + Math.random()),
        tilt_y: round3(-1 + Math.random()),
        vibration: round3(0.15 + Math.random() * 0.1),
        distance: round3(baseline - 0.2),
      },
      baseline,
    );
  }

  if (mode === 1) {
    return analyzeReading(
      {
        ...toRawRow(reading, timestamp),
        tilt_x: round3(TILT_WARNING + 1 + Math.random()),
        tilt_y: round3(reading.tilt_y * randomJitterFactor()),
        vibration: round3(VIBRATION_WARNING * 0.5),
        distance: round3(baseline - DISPLACEMENT_WARNING * 0.4),
      },
      baseline,
    );
  }

  return analyzeReading(
    {
      ...toRawRow(reading, timestamp),
      tilt_x: round3(TILT_CRITICAL + Math.random() * 3),
      tilt_y: round3(reading.tilt_y * randomJitterFactor()),
      vibration: round3(VIBRATION_CRITICAL + Math.random() * 0.3),
      distance: round3(baseline - (DISPLACEMENT_CRITICAL + Math.random())),
    },
    baseline,
  );
}

function tickLiveMockReadings(): void {
  const shouldSpike = Math.random() < 0.2;
  const spikeIndex = shouldSpike
    ? Math.floor(Math.random() * liveMockReadings.length)
    : -1;

  liveMockReadings = liveMockReadings.map((reading, index) =>
    index === spikeIndex
      ? pushNodePastThreshold(reading)
      : nudgeTowardLiveValues(reading),
  );
}

function startMockLiveInterval(): void {
  if (liveIntervalId !== null) {
    return;
  }

  liveIntervalId = setInterval(() => {
    tickLiveMockReadings();
    liveListeners.forEach((listener) => {
      listener(cloneReadings(liveMockReadings));
    });
  }, LIVE_INTERVAL_MS);
}

function subscribeToMockReadings(
  onUpdate: (readings: SensorReading[]) => void,
): () => void {
  liveListeners.add(onUpdate);
  startMockLiveInterval();

  return () => {
    liveListeners.delete(onUpdate);
    if (liveListeners.size === 0 && liveIntervalId !== null) {
      clearInterval(liveIntervalId);
      liveIntervalId = null;
    }
  };
}

function mockHistoryForNode(nodeId: string, limit: number): TimePoint[] {
  const baseReading =
    mockReadings.find((reading) => reading.node_id === nodeId) ??
    mockReadings[0];

  if (!baseReading) {
    return [];
  }

  return generateHistory(nodeId, baseReading).slice(-limit);
}

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
    await delay(MOCK_DELAY_MS);
    return cloneReadings(liveMockReadings);
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
    console.error("fetchLatestReadings failed; using fallback.", error);
    return mockReadings;
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
    await delay(MOCK_DELAY_MS);
    return mockHistoryForNode(nodeId, limit);
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
    console.error("fetchNodeHistory failed; using mock history.", error);
    return mockHistoryForNode(nodeId, limit);
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

  // Fallback to client-side mock if Supabase is not configured
  return subscribeToMockReadings(onUpdate);
}
