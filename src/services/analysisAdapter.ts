// =============================================================================
// WARNING / SYNC RISK:
// These threshold values and risk algorithms are synchronized with engine/thresholds.py,
// engine/risk.py, and engine/sensor_health.py.
// =============================================================================
// Analysis adapter synchronizing Person 2's Python engine thresholds and risk logic
// directly with the frontend dashboard until the live backend analysis table/queue is wired.
// Contract: { node_id, status, risk_score, warnings, displacement, risk_level, risk_factors, sensor_confidence, sensor_health, confidence_warning }

import type {
  DataQualityStatus,
  RawSensorRow,
  RiskLevel,
  SensorHealthState,
  SensorReading,
  TimePoint,
} from "../types/sensor";

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

// Physical sensor limits matching engine/sensor_health.py
const TILT_MIN_DEG = -90.0;
const TILT_MAX_DEG = 90.0;
const VIBRATION_MIN_G = 0.0;
const VIBRATION_MAX_G = 16.0;
const HCSR04_MIN_DIST_CM = 2.0;
const HCSR04_MAX_DIST_CM = 400.0;

function isValidNumber(val: unknown): val is number {
  return typeof val === "number" && !Number.isNaN(val) && Number.isFinite(val);
}

export function evaluateSensorHealth(
  raw: RawSensorRow,
  history?: (TimePoint | RawSensorRow)[],
): {
  sensor_confidence: number;
  sensor_health: SensorHealthState;
  confidence_warning: string | null;
} {
  const issues: string[] = [];
  let penalty = 0;

  let mpuStatus: "GOOD" | "UNSTABLE" | "INVALID" = "GOOD";
  let hcsr04Status: "GOOD" | "UNSTABLE" | "INVALID" = "GOOD";
  let connectivityStatus: "GOOD" | "UNSTABLE" | "OFFLINE" = "GOOD";
  let dataQualityStatus: DataQualityStatus = "GOOD";

  // 1. MPU6050 Tilt validation
  if (!isValidNumber(raw.tilt_x) || !isValidNumber(raw.tilt_y)) {
    mpuStatus = "INVALID";
    penalty += 35;
    issues.push("MPU6050 tilt telemetry missing or non-numeric");
  } else {
    if (
      raw.tilt_x < TILT_MIN_DEG ||
      raw.tilt_x > TILT_MAX_DEG ||
      raw.tilt_y < TILT_MIN_DEG ||
      raw.tilt_y > TILT_MAX_DEG
    ) {
      mpuStatus = "INVALID";
      penalty += 30;
      issues.push(`Tilt angle out of physical limits ([-90°, 90°]): X=${raw.tilt_x}°, Y=${raw.tilt_y}°`);
    } else if (Math.abs(raw.tilt_x) > 75.0 || Math.abs(raw.tilt_y) > 75.0) {
      if (mpuStatus === "GOOD") mpuStatus = "UNSTABLE";
      penalty += 10;
      issues.push("Tilt angle near physical tipping limit");
    }
  }

  // 2. Vibration validation
  if (!isValidNumber(raw.vibration)) {
    if (mpuStatus !== "INVALID") mpuStatus = "UNSTABLE";
    penalty += 20;
    issues.push("Vibration metric missing or non-numeric");
  } else if (raw.vibration < VIBRATION_MIN_G || raw.vibration > VIBRATION_MAX_G) {
    mpuStatus = "INVALID";
    penalty += 25;
    issues.push(`Vibration (${raw.vibration}g) exceeds sensor physical scale (0-16g)`);
  }

  // 3. HC-SR04 Distance validation
  if (!isValidNumber(raw.distance)) {
    hcsr04Status = "INVALID";
    penalty += 35;
    issues.push("HC-SR04 distance metric missing or non-numeric");
  } else if (raw.distance < HCSR04_MIN_DIST_CM || raw.distance > HCSR04_MAX_DIST_CM) {
    hcsr04Status = "INVALID";
    penalty += 30;
    issues.push(`HC-SR04 distance (${raw.distance}cm) outside operational range (2-400cm)`);
  } else if (raw.distance <= 3.0 || raw.distance >= 380.0) {
    if (hcsr04Status === "GOOD") hcsr04Status = "UNSTABLE";
    penalty += 10;
    issues.push("HC-SR04 distance approaching transducer boundary limits");
  }

  // 4. Historical consistency
  if (history && history.length >= 3) {
    const recentDists = history.slice(-3).map((h) => h.distance).filter(isValidNumber);
    if (recentDists.length === 3 && recentDists.every((d) => d === raw.distance)) {
      if (hcsr04Status === "GOOD") hcsr04Status = "UNSTABLE";
      penalty += 10;
      issues.push("HC-SR04 reported identical repeated readings across consecutive intervals");
    }

    if (recentDists.length >= 1 && isValidNumber(raw.distance)) {
      const prevDist = recentDists[recentDists.length - 1];
      if (Math.abs(raw.distance - prevDist) > 50.0) {
        if (hcsr04Status === "GOOD") hcsr04Status = "UNSTABLE";
        penalty += 15;
        issues.push("Abnormal ultrasonic distance spike detected between consecutive samples");
      }
    }
  }

  // 5. Connectivity validation
  if (!raw.timestamp || typeof raw.timestamp !== "string") {
    connectivityStatus = "UNSTABLE";
    penalty += 10;
    issues.push("Timestamp absent or malformed");
  }

  // Overall Data Quality
  if (mpuStatus === "INVALID" || hcsr04Status === "INVALID") {
    dataQualityStatus = "INVALID";
  } else if (mpuStatus === "UNSTABLE" || hcsr04Status === "UNSTABLE" || connectivityStatus === "UNSTABLE") {
    dataQualityStatus = "DEGRADED";
  } else {
    dataQualityStatus = "GOOD";
  }

  const confidenceScore = Math.max(0, Math.min(100, 100 - penalty));

  let confidenceWarning: string | null = null;
  if (confidenceScore < 60) {
    confidenceWarning = `LOW SENSOR CONFIDENCE: ${issues[0] || "Unreliable sensor telemetry"}`;
  }

  return {
    sensor_confidence: confidenceScore,
    sensor_health: {
      mpu6050: mpuStatus,
      hcsr04: hcsr04Status,
      connectivity: connectivityStatus,
      data_quality: dataQualityStatus,
      issues,
    },
    confidence_warning: confidenceWarning,
  };
}

export function classifyRiskIndexLevel(score: number): RiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

export function analyzeReading(
  raw: RawSensorRow,
  baselineDistance: number,
  history?: (TimePoint | RawSensorRow)[],
): SensorReading {
  const safeDistance = isValidNumber(raw.distance) ? raw.distance : baselineDistance;
  const displacement = Number(
    Math.abs(baselineDistance - safeDistance).toFixed(2),
  );
  const safeTiltX = isValidNumber(raw.tilt_x) ? raw.tilt_x : 0;
  const safeTiltY = isValidNumber(raw.tilt_y) ? raw.tilt_y : 0;
  const safeVib = isValidNumber(raw.vibration) ? raw.vibration : 0;

  const tiltMagnitude = Math.max(Math.abs(safeTiltX), Math.abs(safeTiltY));

  const warnings: string[] = [];
  if (tiltMagnitude >= TILT_THRESHOLD_DEG) {
    warnings.push("EXCESSIVE_TILT");
  }
  if (safeVib >= VIBRATION_THRESHOLD_G) {
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

  // Subsidence Risk Index (0-100) heuristic from engine/risk.py
  const tiltRatio = tiltMagnitude / TILT_THRESHOLD_DEG;
  const vibrationRatio = safeVib / VIBRATION_THRESHOLD_G;
  const displacementRatio = displacement / DISPLACEMENT_THRESHOLD_CM;
  const maxRatio = Math.max(tiltRatio, vibrationRatio, displacementRatio);

  const risk_factors: string[] = [];

  // Trend progression
  let trendFactor = 0;
  if (history && history.length >= 2) {
    const prev = history[history.length - 1];
    if (isValidNumber(prev.distance)) {
      const prevDisp = Math.abs(baselineDistance - prev.distance);
      const dispRate = displacement - prevDisp;
      if (dispRate > 0.2) {
        trendFactor = Math.min(10, Math.round(dispRate * 10));
        risk_factors.push(`Accelerating displacement progression (+${dispRate.toFixed(2)} cm/tick)`);
      }
    }
  }

  let risk_score: number;
  if (status === "NORMAL") {
    const score = Math.round(Math.min(Math.max(maxRatio, 0.0), 1.0) * 20);
    risk_score = Math.min(20, Math.max(0, score));
    risk_factors.push("All sensor metrics within normal baseline");
  } else if (status === "WARNING") {
    const excess = Math.max(0.0, maxRatio - 1.0);
    const score = Math.round(40 + Math.min(excess, 1.0) * 30) + trendFactor;
    risk_score = Math.min(70, Math.max(40, score));

    if (tiltMagnitude >= TILT_THRESHOLD_DEG) {
      risk_factors.push(`Excessive tilt detected (${tiltMagnitude.toFixed(1)}° ≥ ${TILT_THRESHOLD_DEG}°)`);
    }
    if (safeVib >= VIBRATION_THRESHOLD_G) {
      risk_factors.push(`High vibration anomaly (${safeVib.toFixed(2)}g ≥ ${VIBRATION_THRESHOLD_G}g)`);
    }
    if (displacement >= DISPLACEMENT_THRESHOLD_CM) {
      risk_factors.push(`Abnormal ground displacement (${displacement.toFixed(2)}cm ≥ ${DISPLACEMENT_THRESHOLD_CM}cm)`);
    }
  } else {
    const base = warnings.length === 2 ? 80 : 90;
    const excess = Math.max(0.0, maxRatio - 1.0);
    const score = Math.round(base + Math.min(excess, 1.0) * 10) + trendFactor;
    risk_score = Math.min(100, Math.max(80, score));

    if (tiltMagnitude >= TILT_THRESHOLD_DEG) {
      risk_factors.push(`Excessive tilt (${tiltMagnitude.toFixed(1)}°)`);
    }
    if (safeVib >= VIBRATION_THRESHOLD_G) {
      risk_factors.push(`High vibration (${safeVib.toFixed(2)}g)`);
    }
    if (displacement >= DISPLACEMENT_THRESHOLD_CM) {
      risk_factors.push(`Abnormal ground displacement (${displacement.toFixed(2)}cm)`);
    }
    risk_factors.push("Multi-sensor ground movement correlation detected");
  }

  const risk_level = classifyRiskIndexLevel(risk_score);

  // Evaluate Sensor Health & Confidence
  const healthEvaluation = evaluateSensorHealth(raw, history);

  return {
    node_id: raw.node_id,
    timestamp: raw.timestamp,
    tilt_x: safeTiltX,
    tilt_y: safeTiltY,
    vibration: safeVib,
    distance: safeDistance,
    displacement,
    status,
    warnings,
    risk_score,
    risk_level,
    risk_factors,
    sensor_confidence: healthEvaluation.sensor_confidence,
    sensor_health: healthEvaluation.sensor_health,
    confidence_warning: healthEvaluation.confidence_warning,
  };
}
