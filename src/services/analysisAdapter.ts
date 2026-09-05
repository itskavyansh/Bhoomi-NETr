// Analysis adapter synchronizing Person 2's Python engine thresholds and risk logic
// directly with the frontend dashboard until the live backend analysis table/queue is wired.
// Contract: { node_id, status, risk_score, warnings, displacement }

import type { RawSensorRow, SensorReading } from "../types/sensor";

// Demonstration thresholds matching engine/thresholds.py
export const TILT_THRESHOLD_DEG = 15.0;
export const VIBRATION_THRESHOLD_G = 1.0;
export const DISPLACEMENT_THRESHOLD_CM = 2.0;

// Aliases for compatibility
export const TILT_WARNING = TILT_THRESHOLD_DEG;
export const TILT_CRITICAL = 25.0;
export const VIBRATION_WARNING = VIBRATION_THRESHOLD_G;
export const VIBRATION_CRITICAL = 1.8;
export const DISPLACEMENT_WARNING = DISPLACEMENT_THRESHOLD_CM;
export const DISPLACEMENT_CRITICAL = 3.0;

export function analyzeReading(
  raw: RawSensorRow,
  baselineDistance: number,
): SensorReading {
  const displacement = Number((baselineDistance - raw.distance).toFixed(2));
  const tiltMagnitude = Math.max(Math.abs(raw.tilt_x), Math.abs(raw.tilt_y));

  const warnings: string[] = [];
  if (tiltMagnitude >= TILT_THRESHOLD_DEG) {
    warnings.push("EXCESSIVE_TILT");
  }
  if (raw.vibration >= VIBRATION_THRESHOLD_G) {
    warnings.push("HIGH_VIBRATION");
  }
  if (displacement >= DISPLACEMENT_THRESHOLD_CM) {
    warnings.push("ABNORMAL_DISPLACEMENT");
  }

  // Exact rule from engine/risk.py:
  // CRITICAL if 2 or more warnings
  // WARNING if 1 warning
  // NORMAL if 0 warnings
  let status: SensorReading["status"] = "NORMAL";
  if (warnings.length >= 2) {
    status = "CRITICAL";
  } else if (warnings.length === 1) {
    status = "WARNING";
  } else {
    status = "NORMAL";
  }

  // Exact risk score heuristic from engine/risk.py
  const tiltRatio = tiltMagnitude / TILT_THRESHOLD_DEG;
  const vibrationRatio = raw.vibration / VIBRATION_THRESHOLD_G;
  const displacementRatio = displacement / DISPLACEMENT_THRESHOLD_CM;
  const maxRatio = Math.max(tiltRatio, vibrationRatio, displacementRatio);

  let risk_score: number;
  if (status === "NORMAL") {
    const score = Math.round(Math.min(Math.max(maxRatio, 0.0), 1.0) * 20);
    risk_score = Math.min(20, Math.max(0, score));
  } else if (status === "WARNING") {
    const excess = Math.max(0.0, maxRatio - 1.0);
    const score = Math.round(40 + Math.min(excess, 1.0) * 30);
    risk_score = Math.min(70, Math.max(40, score));
  } else {
    const base = warnings.length === 2 ? 80 : 90;
    const excess = Math.max(0.0, maxRatio - 1.0);
    const score = Math.round(base + Math.min(excess, 1.0) * 10);
    risk_score = Math.min(100, Math.max(80, score));
  }

  return {
    node_id: raw.node_id,
    timestamp: raw.timestamp,
    tilt_x: raw.tilt_x,
    tilt_y: raw.tilt_y,
    vibration: raw.vibration,
    distance: raw.distance,
    displacement,
    status,
    warnings,
    risk_score,
  };
}
