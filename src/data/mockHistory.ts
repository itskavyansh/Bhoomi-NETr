import type { SensorReading, TimePoint } from "../types/sensor";

const HISTORY_POINTS = 20;
const INTERVAL_MS = 2000;
const JITTER = 0.1;

function hashNodeId(nodeId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < nodeId.length; i += 1) {
    hash ^= nodeId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function jitter(value: number, random: () => number): number {
  const factor = 1 + (random() * 2 - 1) * JITTER;
  return Number((value * factor).toFixed(3));
}

export function generateHistory(
  nodeId: string,
  baseReading: SensorReading,
): TimePoint[] {
  const random = createRng(hashNodeId(nodeId));
  const now = Date.now();

  const points: TimePoint[] = Array.from({ length: HISTORY_POINTS }, (_, index) => ({
    timestamp: new Date(now - index * INTERVAL_MS).toISOString(),
    tilt_x: jitter(baseReading.tilt_x, random),
    vibration: jitter(baseReading.vibration, random),
    displacement: jitter(baseReading.displacement, random),
  }));

  return points.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
