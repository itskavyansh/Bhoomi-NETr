// =============================================================================
// Bhoomi-NETr | Backend Risk Assessment Module
// Evaluates raw telemetry against authoritative thresholds.
// Logic mirrors engine/risk.py and src/services/analysisAdapter.ts.
// =============================================================================

export interface RawSensorReading {
  node_id: string;
  timestamp?: string;
  tilt_x: number;
  tilt_y: number;
  vibration: number;
  distance: number;
}

export interface EvaluatedRisk {
  node_id: string;
  timestamp: string;
  tilt_x: number;
  tilt_y: number;
  vibration: number;
  distance: number;
  displacement: number;
  status: "NORMAL" | "WARNING" | "CRITICAL";
  risk_score: number;
  warnings: string[];
}

export const DEFAULT_BASELINE_DISTANCE = 20.0; // cm
export const TILT_THRESHOLD_DEG = 15.0;         // degrees
export const VIBRATION_THRESHOLD_G = 1.0;        // g
export const DISPLACEMENT_THRESHOLD_CM = 2.0;    // cm

export function evaluateRisk(
  reading: RawSensorReading,
  baselineDistance = DEFAULT_BASELINE_DISTANCE
): EvaluatedRisk {
  const displacement = Number(
    Math.abs(baselineDistance - reading.distance).toFixed(2)
  );
  const tiltMagnitude = Math.max(
    Math.abs(reading.tilt_x),
    Math.abs(reading.tilt_y)
  );

  const warnings: string[] = [];
  if (tiltMagnitude >= TILT_THRESHOLD_DEG) {
    warnings.push("EXCESSIVE_TILT");
  }
  if (reading.vibration >= VIBRATION_THRESHOLD_G) {
    warnings.push("HIGH_VIBRATION");
  }
  if (displacement >= DISPLACEMENT_THRESHOLD_CM) {
    warnings.push("ABNORMAL_DISPLACEMENT");
  }

  // Exact rule from engine/risk.py:
  // CRITICAL if 2 or more warnings
  // WARNING if 1 warning
  // NORMAL if 0 warnings
  let status: "NORMAL" | "WARNING" | "CRITICAL" = "NORMAL";
  if (warnings.length >= 2) {
    status = "CRITICAL";
  } else if (warnings.length === 1) {
    status = "WARNING";
  } else {
    status = "NORMAL";
  }

  // Risk score heuristic matching engine/risk.py
  const tiltRatio = tiltMagnitude / TILT_THRESHOLD_DEG;
  const vibrationRatio = reading.vibration / VIBRATION_THRESHOLD_G;
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
    node_id: reading.node_id,
    timestamp: reading.timestamp ?? new Date().toISOString(),
    tilt_x: reading.tilt_x,
    tilt_y: reading.tilt_y,
    vibration: reading.vibration,
    distance: reading.distance,
    displacement,
    status,
    risk_score,
    warnings,
  };
}
