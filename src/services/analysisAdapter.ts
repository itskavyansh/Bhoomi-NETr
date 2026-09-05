// PLACEHOLDER — mirrors Person 2's threshold logic locally so the dashboard
// works end-to-end before the real analysis engine/output exists.
// Person 2's real output shape is: { node_id, status, risk_score, warnings }
// When that's available (via a Supabase table or Edge Function), replace
// the body of this function with a fetch/lookup of that result — do NOT
// change this function's signature or return type, so nothing upstream breaks.

import type { RawSensorRow, SensorReading } from "../types/sensor";

export const TILT_WARNING = 15;
export const TILT_CRITICAL = 25;
export const VIBRATION_WARNING = 0.8;
export const VIBRATION_CRITICAL = 1.5;
export const DISPLACEMENT_WARNING = 1.0;
export const DISPLACEMENT_CRITICAL = 2.5;

export function analyzeReading(
  raw: RawSensorRow,
  baselineDistance: number,
): SensorReading {
  const displacement = baselineDistance - raw.distance;
  const tiltMagnitude = Math.max(Math.abs(raw.tilt_x), Math.abs(raw.tilt_y));
  const absDisplacement = Math.abs(displacement);

  const warnings: string[] = [];
  if (tiltMagnitude >= TILT_WARNING) {
    warnings.push("EXCESSIVE_TILT");
  }
  if (raw.vibration >= VIBRATION_WARNING) {
    warnings.push("HIGH_VIBRATION");
  }
  if (absDisplacement >= DISPLACEMENT_WARNING) {
    warnings.push("ABNORMAL_DISPLACEMENT");
  }

  const isCritical =
    tiltMagnitude >= TILT_CRITICAL ||
    raw.vibration >= VIBRATION_CRITICAL ||
    absDisplacement >= DISPLACEMENT_CRITICAL;

  const status: SensorReading["status"] = isCritical
    ? "CRITICAL"
    : warnings.length > 0
      ? "WARNING"
      : "NORMAL";

  // Placeholder for Person 2's real scoring: average of (value / critical) * 100, capped at 100.
  const tiltScore = Math.min(100, (tiltMagnitude / TILT_CRITICAL) * 100);
  const vibrationScore = Math.min(100, (raw.vibration / VIBRATION_CRITICAL) * 100);
  const displacementScore = Math.min(
    100,
    (absDisplacement / DISPLACEMENT_CRITICAL) * 100,
  );
  const risk_score = Math.round((tiltScore + vibrationScore + displacementScore) / 3);

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
