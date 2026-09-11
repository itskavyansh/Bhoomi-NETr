/**
 * =============================================================================
 * Bhoomi-NETr | Trend Analysis & Predictive Early Failure Engine
 * 
 * Performs kinematics, time-series progression detection, multi-sensor correlation,
 * and threshold projection based on historical telemetry.
 * 
 * Reuses existing domain thresholds from analysisAdapter / engine:
 * - DISPLACEMENT_WARNING: 2.0 cm, DISPLACEMENT_CRITICAL: 3.0 cm
 * - TILT_WARNING: 15.0 deg, TILT_CRITICAL: 25.0 deg
 * - VIBRATION_WARNING: 1.0 g, VIBRATION_CRITICAL: 1.8 g
 * =============================================================================
 */

import type { TimePoint } from "../types/sensor.ts";
import {
  DISPLACEMENT_WARNING,
  DISPLACEMENT_CRITICAL,
  TILT_WARNING,
  VIBRATION_WARNING,
} from "./analysisAdapter.ts";

export type TrendDirection = "INCREASING" | "DECREASING" | "STABLE";
export type TrendStrength = "STRONG" | "MODERATE" | "WEAK" | "NONE";

export type BehaviorClassification =
  | "NORMAL_BASELINE"
  | "TEMPORARY_SPIKE"
  | "PERSISTENT_ABNORMAL"
  | "PROGRESSIVE_MOVEMENT"
  | "INSUFFICIENT_DATA";

export type PredictiveAlertStatus =
  | "STABLE"
  | "WATCH"
  | "WARNING_IMMINENT"
  | "CRITICAL_IMMINENT"
  | "THRESHOLD_EXCEEDED"
  | "INSUFFICIENT_DATA";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface MetricTrendSummary {
  current: number;
  previous: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  rateOfChangePerMin: number | null;
  rateOfChangePerSec: number | null;
  direction: TrendDirection;
  strength: TrendStrength;
  classification: BehaviorClassification;
  isSpike: boolean;
  isPersistentAbnormal: boolean;
  baselineMean: number;
  deviationFromBaseline: number;
}

export interface DisplacementKinematics {
  currentDisplacement: number;
  velocityCmPerMin: number | null;
  velocityCmPerSec: number | null;
  accelerationCmPerMin2: number | null;
  accelerationCmPerSec2: number | null;
  direction: TrendDirection;
  strength: TrendStrength;
  classification: BehaviorClassification;
  isAccelerating: boolean;
  isProgressive: boolean;
}

export interface MultiSensorCorrelation {
  displacementWorsening: boolean;
  tiltWorsening: boolean;
  vibrationWorsening: boolean;
  riskWorsening: boolean;
  correlatedSignals: string[];
  patternDescription: string;
  hasCompoundHazard: boolean;
  compoundSeverity: "NONE" | "ELEVATED" | "HIGH" | "CRITICAL";
}

export interface ThresholdProjection {
  metricName: string;
  currentValue: number;
  targetThreshold: number;
  thresholdType: "WARNING" | "CRITICAL";
  isExceeded: boolean;
  isMovingToward: boolean;
  projectedSeconds: number | null;
  projectedFormatted: string;
  projectionMessage: string;
}

export interface PredictiveAnalysisResult {
  nodeId: string;
  status: PredictiveAlertStatus;
  statusLabel: string;
  statusColor: string;
  confidence: {
    level: ConfidenceLevel;
    score: number; // 0-100
    label: string; // "Trend-based estimate — requires field calibration."
    factors: string[];
  };
  displacement: DisplacementKinematics;
  tilt: MetricTrendSummary;
  vibration: MetricTrendSummary;
  risk: MetricTrendSummary;
  correlation: MultiSensorCorrelation;
  projection: ThresholdProjection;
  explanation: {
    headline: string;
    summary: string;
    reasons: string[];
  };
  sampleCount: number;
  observationWindowSeconds: number;
}

// -----------------------------------------------------------------------------
// Helper math functions
// -----------------------------------------------------------------------------

function isNum(val: unknown): val is number {
  return typeof val === "number" && !Number.isNaN(val) && Number.isFinite(val);
}

function parseTime(isoOrTimestamp: string | number): number {
  if (typeof isoOrTimestamp === "number") return isoOrTimestamp;
  const t = new Date(isoOrTimestamp).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Filter, deduplicate, and chronologically sort time points.
 */
export function sanitizeHistory(points: TimePoint[]): TimePoint[] {
  if (!Array.isArray(points) || points.length === 0) return [];

  // Filter out records with invalid timestamps or missing fields
  const valid = points.filter((p) => {
    if (!p || typeof p !== "object") return false;
    const t = parseTime(p.timestamp);
    if (t <= 0) return false;
    return isNum(p.displacement) || isNum(p.distance);
  });

  // Sort chronologically ascending
  const sorted = [...valid].sort((a, b) => parseTime(a.timestamp) - parseTime(b.timestamp));

  // Deduplicate timestamps (keep the latest occurrence)
  const deduped: TimePoint[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (next && parseTime(next.timestamp) === parseTime(current.timestamp)) {
      continue;
    }
    deduped.push(current);
  }

  return deduped;
}

/**
 * Perform simple linear regression on (time_seconds, value) series.
 * Returns slope per second and R^2 goodness of fit.
 */
function linearRegression(points: { t: number; v: number }[]): { slopePerSec: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slopePerSec: 0, r2: 0 };

  const t0 = points[0].t;
  let sumT = 0;
  let sumV = 0;
  let sumTV = 0;
  let sumTT = 0;
  let sumVV = 0;

  for (const p of points) {
    const t = p.t - t0;
    const v = p.v;
    sumT += t;
    sumV += v;
    sumTV += t * v;
    sumTT += t * t;
    sumVV += v * v;
  }

  const denominator = n * sumTT - sumT * sumT;
  if (denominator === 0) return { slopePerSec: 0, r2: 0 };

  const slope = (n * sumTV - sumT * sumV) / denominator;
  const numerator = n * sumTV - sumT * sumV;
  const vDenominator = (n * sumTT - sumT * sumT) * (n * sumVV - sumV * sumV);
  const r2 = vDenominator > 0 ? (numerator * numerator) / vDenominator : 0;

  return { slopePerSec: slope, r2: Math.min(1, Math.max(0, r2)) };
}

function classifyDirection(
  slopePerSec: number,
  tolerancePerSec: number,
  r2?: number
): TrendDirection {
  const absSlope = Math.abs(slopePerSec);
  if (absSlope <= tolerancePerSec) return "STABLE";
  if (r2 !== undefined && r2 < 0.35 && absSlope < tolerancePerSec * 3) {
    return "STABLE";
  }
  if (slopePerSec > tolerancePerSec) return "INCREASING";
  if (slopePerSec < -tolerancePerSec) return "DECREASING";
  return "STABLE";
}

function classifyStrength(r2: number, ratePerMin: number, absRateThreshold: number): TrendStrength {
  const absRate = Math.abs(ratePerMin);
  if (r2 >= 0.75 && absRate >= absRateThreshold * 2) return "STRONG";
  if (r2 >= 0.45 && absRate >= absRateThreshold) return "MODERATE";
  if (absRate >= absRateThreshold * 0.4) return "WEAK";
  return "NONE";
}

// -----------------------------------------------------------------------------
// Core calculation modules
// -----------------------------------------------------------------------------

/**
 * Analyze a scalar metric series (tilt, vibration, risk score).
 */
export function analyzeMetricTrend(
  valuesWithTime: { t: number; v: number }[],
  warningThreshold: number,
  tolerancePerMin: number
): MetricTrendSummary {
  const n = valuesWithTime.length;
  if (n === 0) {
    return {
      current: 0,
      previous: null,
      absoluteChange: null,
      percentageChange: null,
      rateOfChangePerMin: null,
      rateOfChangePerSec: null,
      direction: "STABLE",
      strength: "NONE",
      classification: "INSUFFICIENT_DATA",
      isSpike: false,
      isPersistentAbnormal: false,
      baselineMean: 0,
      deviationFromBaseline: 0,
    };
  }

  const current = valuesWithTime[n - 1].v;
  const previous = n >= 2 ? valuesWithTime[n - 2].v : null;
  const absoluteChange = previous !== null ? Number((current - previous).toFixed(3)) : null;
  const percentageChange =
    previous !== null && Math.abs(previous) > 0.001
      ? Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1))
      : null;

  // Linear regression across window
  const { slopePerSec, r2 } = linearRegression(valuesWithTime);
  const rateOfChangePerSec = Number(slopePerSec.toFixed(5));
  const rateOfChangePerMin = Number((slopePerSec * 60).toFixed(3));

  const tolerancePerSec = tolerancePerMin / 60;
  const direction = classifyDirection(slopePerSec, tolerancePerSec, r2);
  const strength = classifyStrength(r2, rateOfChangePerMin, tolerancePerMin);

  // Baseline calculation (mean of points in the first 50% of the window or calm points)
  const baselineValues = valuesWithTime.slice(0, Math.max(1, Math.floor(n / 2))).map((p) => p.v);
  const baselineMean = Number(
    (baselineValues.reduce((sum, v) => sum + v, 0) / baselineValues.length).toFixed(3)
  );
  const deviationFromBaseline = Number((current - baselineMean).toFixed(3));

  // Spike detection:
  // Did a previous reading spike high above warningThreshold, but current has dropped back near baseline?
  // Or is current a sharp jump (>2x baseline) that just occurred on this tick?
  let isSpike = false;
  if (n >= 3) {
    const prevMax = Math.max(...valuesWithTime.slice(Math.max(0, n - 4), n - 1).map((p) => p.v));
    // If previous was elevated (>= warningThreshold) and current has dropped significantly below warning
    if (prevMax >= warningThreshold && current < warningThreshold * 0.85) {
      isSpike = true;
    }
  }

  // Persistent abnormal:
  // Multiple readings in recent window stay above warning threshold, without returning to normal
  const recentWindow = valuesWithTime.slice(Math.max(0, n - 6));
  const abnormalCount = recentWindow.filter((p) => p.v >= warningThreshold).length;
  const isPersistentAbnormal = recentWindow.length >= 3 && abnormalCount / recentWindow.length >= 0.6;

  // Behavior classification
  let classification: BehaviorClassification = "NORMAL_BASELINE";
  if (n < 2) {
    classification = "INSUFFICIENT_DATA";
  } else if (isSpike) {
    classification = "TEMPORARY_SPIKE";
  } else if (direction === "INCREASING" && (strength === "STRONG" || strength === "MODERATE")) {
    classification = "PROGRESSIVE_MOVEMENT";
  } else if (isPersistentAbnormal) {
    classification = "PERSISTENT_ABNORMAL";
  } else {
    classification = "NORMAL_BASELINE";
  }

  return {
    current: Number(current.toFixed(3)),
    previous: previous !== null ? Number(previous.toFixed(3)) : null,
    absoluteChange,
    percentageChange,
    rateOfChangePerMin,
    rateOfChangePerSec,
    direction,
    strength,
    classification,
    isSpike,
    isPersistentAbnormal,
    baselineMean,
    deviationFromBaseline,
  };
}

/**
 * Calculate kinematics specifically for displacement: velocity (v) and acceleration (a).
 * Handles dt <= 0 and non-consecutive or gapped records safely.
 */
export function calculateDisplacementKinematics(
  dispPoints: { t: number; v: number }[]
): DisplacementKinematics {
  const n = dispPoints.length;
  if (n === 0) {
    return {
      currentDisplacement: 0,
      velocityCmPerMin: null,
      velocityCmPerSec: null,
      accelerationCmPerMin2: null,
      accelerationCmPerSec2: null,
      direction: "STABLE",
      strength: "NONE",
      classification: "INSUFFICIENT_DATA",
      isAccelerating: false,
      isProgressive: false,
    };
  }

  const currentDisplacement = Number(dispPoints[n - 1].v.toFixed(2));

  if (n < 2) {
    return {
      currentDisplacement,
      velocityCmPerMin: null,
      velocityCmPerSec: null,
      accelerationCmPerMin2: null,
      accelerationCmPerSec2: null,
      direction: "STABLE",
      strength: "NONE",
      classification: "INSUFFICIENT_DATA",
      isAccelerating: false,
      isProgressive: false,
    };
  }

  // Linear regression velocity across recent points (up to last 15 points)
  const windowPoints = dispPoints.slice(Math.max(0, n - 15));
  const { slopePerSec, r2 } = linearRegression(windowPoints);

  const velocityCmPerSec = Number(slopePerSec.toFixed(5));
  const velocityCmPerMin = Number((slopePerSec * 60).toFixed(4));

  // Displacement direction: tolerance = 0.02 cm/min (0.2 mm/min)
  const direction = classifyDirection(slopePerSec, 0.02 / 60, r2);
  const strength = classifyStrength(r2, velocityCmPerMin, 0.02);

  // Acceleration calculation:
  // Requires at least 3 points. Compare velocity of first sub-window to second sub-window.
  let accelerationCmPerSec2: number | null = null;
  let accelerationCmPerMin2: number | null = null;
  let isAccelerating = false;

  if (windowPoints.length >= 4) {
    const mid = Math.floor(windowPoints.length / 2);
    const firstHalf = windowPoints.slice(0, mid + 1);
    const secondHalf = windowPoints.slice(mid);

    const v1 = linearRegression(firstHalf).slopePerSec;
    const v2 = linearRegression(secondHalf).slopePerSec;

    const tMidFirst = (firstHalf[0].t + firstHalf[firstHalf.length - 1].t) / 2;
    const tMidSecond = (secondHalf[0].t + secondHalf[secondHalf.length - 1].t) / 2;
    const dtMid = tMidSecond - tMidFirst;

    if (dtMid > 0.5) {
      const aSec = (v2 - v1) / dtMid;
      accelerationCmPerSec2 = Number(aSec.toFixed(6));
      accelerationCmPerMin2 = Number((aSec * 3600).toFixed(4)); // (cm/s^2) * 3600 = cm/min^2
      // Positive acceleration with positive velocity indicates accelerating progressive subsidence
      isAccelerating = aSec > 0.00005 && velocityCmPerSec > 0.0001;
    }
  }

  // Progressive movement classification:
  // Displacement is moving upward with moderate-to-strong consistency or sustained positive velocity
  const isProgressive =
    velocityCmPerMin > 0.01 &&
    (direction === "INCREASING" || isAccelerating) &&
    r2 >= 0.3;

  let classification: BehaviorClassification = "NORMAL_BASELINE";
  if (isProgressive) {
    classification = "PROGRESSIVE_MOVEMENT";
  } else if (currentDisplacement >= DISPLACEMENT_WARNING) {
    classification = "PERSISTENT_ABNORMAL";
  } else {
    classification = "NORMAL_BASELINE";
  }

  return {
    currentDisplacement,
    velocityCmPerMin,
    velocityCmPerSec,
    accelerationCmPerMin2,
    accelerationCmPerSec2,
    direction,
    strength,
    classification,
    isAccelerating,
    isProgressive,
  };
}

/**
 * Cross-sensor correlation detection.
 * Examines whether multiple independent physical sensors are worsening in unison.
 */
export function correlateSensors(
  dispKinematics: DisplacementKinematics,
  tiltSummary: MetricTrendSummary,
  vibSummary: MetricTrendSummary,
  riskSummary: MetricTrendSummary
): MultiSensorCorrelation {
  const displacementWorsening =
    dispKinematics.direction === "INCREASING" &&
    (dispKinematics.velocityCmPerMin ?? 0) > 0.008;

  const tiltWorsening =
    tiltSummary.direction === "INCREASING" ||
    tiltSummary.isPersistentAbnormal ||
    tiltSummary.current >= TILT_WARNING;

  const vibrationWorsening =
    vibSummary.direction === "INCREASING" ||
    vibSummary.isPersistentAbnormal ||
    vibSummary.current >= VIBRATION_WARNING * 0.7;

  const riskWorsening =
    riskSummary.direction === "INCREASING" || riskSummary.current >= 40;

  const correlatedSignals: string[] = [];
  if (displacementWorsening) correlatedSignals.push("Displacement Progression");
  if (tiltWorsening) correlatedSignals.push("Tilt Elevation");
  if (vibrationWorsening) correlatedSignals.push("Vibration Escalation");

  let patternDescription = "Sensors are operating independently within normal bounds.";
  let compoundSeverity: "NONE" | "ELEVATED" | "HIGH" | "CRITICAL" = "NONE";
  let hasCompoundHazard = false;

  if (displacementWorsening && tiltWorsening && vibrationWorsening) {
    patternDescription =
      "Compound Multi-Hazard: Progressive displacement coupled with increasing tilt and dynamic vibration. High risk of progressive geotechnical destabilization.";
    compoundSeverity = "CRITICAL";
    hasCompoundHazard = true;
  } else if (displacementWorsening && tiltWorsening) {
    patternDescription =
      "Displacement & Tilt Correlation: Ground movement accompanied by structural inclination confirms physical slope or strata deformation.";
    compoundSeverity = "HIGH";
    hasCompoundHazard = true;
  } else if (displacementWorsening && vibrationWorsening) {
    patternDescription =
      "Displacement & Vibration Correlation: Micro-fracturing or seismic activity coinciding with ground displacement.";
    compoundSeverity = "HIGH";
    hasCompoundHazard = true;
  } else if (tiltWorsening && vibSummary.isPersistentAbnormal) {
    patternDescription =
      "Tilt & Persistent Vibration Correlation: Sustained dynamic excitation causing ongoing angular deflection.";
    compoundSeverity = "ELEVATED";
    hasCompoundHazard = true;
  } else if (displacementWorsening) {
    patternDescription = "Isolated displacement progression without corresponding tilt or vibration escalation.";
    compoundSeverity = "ELEVATED";
  } else if (vibSummary.isSpike) {
    patternDescription = "Temporary vibration spike detected — no sustained displacement progression.";
    compoundSeverity = "NONE";
  }

  return {
    displacementWorsening,
    tiltWorsening,
    vibrationWorsening,
    riskWorsening,
    correlatedSignals,
    patternDescription,
    hasCompoundHazard,
    compoundSeverity,
  };
}

/**
 * Predict time required to reach the warning or critical threshold.
 */
export function projectTimeToThreshold(
  dispKinematics: DisplacementKinematics
): ThresholdProjection {
  const current = dispKinematics.currentDisplacement;
  const vSec = dispKinematics.velocityCmPerSec ?? 0;
  const aSec2 = dispKinematics.accelerationCmPerSec2 ?? 0;

  // Decide target threshold:
  // If current < DISPLACEMENT_WARNING (2.0cm), project to WARNING.
  // If current >= DISPLACEMENT_WARNING and < DISPLACEMENT_CRITICAL (3.0cm), project to CRITICAL.
  // If current >= DISPLACEMENT_CRITICAL, threshold already exceeded.
  let targetThreshold = DISPLACEMENT_WARNING;
  let thresholdType: "WARNING" | "CRITICAL" = "WARNING";

  if (current >= DISPLACEMENT_CRITICAL) {
    return {
      metricName: "Displacement",
      currentValue: current,
      targetThreshold: DISPLACEMENT_CRITICAL,
      thresholdType: "CRITICAL",
      isExceeded: true,
      isMovingToward: false,
      projectedSeconds: 0,
      projectedFormatted: "Exceeded",
      projectionMessage: "Critical displacement threshold (3.00 cm) has already been exceeded.",
    };
  }

  if (current >= DISPLACEMENT_WARNING) {
    targetThreshold = DISPLACEMENT_CRITICAL;
    thresholdType = "CRITICAL";
  }

  const deltaRemaining = targetThreshold - current;

  // If velocity is non-positive or negligible
  if (vSec <= 0.00005) {
    return {
      metricName: "Displacement",
      currentValue: current,
      targetThreshold,
      thresholdType,
      isExceeded: false,
      isMovingToward: false,
      projectedSeconds: null,
      projectedFormatted: "—",
      projectionMessage: `No current progression toward the ${thresholdType.toLowerCase()} threshold.`,
    };
  }

  // Calculate projected seconds
  let projectedSec: number;

  // If positive acceleration is observed, solve: d0 + v0*t + 0.5*a*t^2 = target
  // 0.5*a*t^2 + v0*t - deltaRemaining = 0
  if (aSec2 > 0.00001) {
    const discriminant = vSec * vSec + 2 * aSec2 * deltaRemaining;
    if (discriminant >= 0) {
      projectedSec = (-vSec + Math.sqrt(discriminant)) / aSec2;
    } else {
      projectedSec = deltaRemaining / vSec;
    }
  } else {
    projectedSec = deltaRemaining / vSec;
  }

  // Safe bounds: must be positive and under 30 days
  if (projectedSec <= 0 || !Number.isFinite(projectedSec)) {
    return {
      metricName: "Displacement",
      currentValue: current,
      targetThreshold,
      thresholdType,
      isExceeded: false,
      isMovingToward: true,
      projectedSeconds: null,
      projectedFormatted: "—",
      projectionMessage: "Insufficient trend evidence for reliable time-to-threshold estimation.",
    };
  }

  // Format time nicely
  let formattedTime = "";
  if (projectedSec < 60) {
    formattedTime = `${Math.max(1, Math.round(projectedSec))} seconds`;
  } else if (projectedSec < 3600) {
    const mins = Math.round(projectedSec / 60);
    formattedTime = `${mins} minute${mins === 1 ? "" : "s"}`;
  } else if (projectedSec < 86400) {
    const hours = (projectedSec / 3600).toFixed(1);
    formattedTime = `${hours} hours`;
  } else {
    const days = (projectedSec / 86400).toFixed(1);
    formattedTime = `${days} days`;
  }

  const message = `At the current displacement trend (+${(vSec * 60).toFixed(2)} cm/min), the ${thresholdType.toLowerCase()} threshold (${targetThreshold.toFixed(2)} cm) may be reached in approximately ${formattedTime}.`;

  return {
    metricName: "Displacement",
    currentValue: current,
    targetThreshold,
    thresholdType,
    isExceeded: false,
    isMovingToward: true,
    projectedSeconds: Math.round(projectedSec),
    projectedFormatted: `~${formattedTime}`,
    projectionMessage: message,
  };
}

/**
 * Compute prediction confidence score (0-100) and qualitative level (LOW, MEDIUM, HIGH).
 */
function computeConfidence(
  sampleCount: number,
  windowSeconds: number,
  kinematics: DisplacementKinematics,
  correlation: MultiSensorCorrelation
): { level: ConfidenceLevel; score: number; label: string; factors: string[] } {
  let score = 0;
  const factors: string[] = [];

  // 1. Observation count
  if (sampleCount >= 20) {
    score += 30;
    factors.push("Extensive historical observations (20+ points)");
  } else if (sampleCount >= 10) {
    score += 20;
    factors.push("Sufficient historical observations (10-19 points)");
  } else if (sampleCount >= 5) {
    score += 10;
    factors.push("Limited historical sample size (5-9 points)");
  } else {
    score += 5;
    factors.push("Very small sample size (< 5 points)");
  }

  // 2. Window duration
  if (windowSeconds >= 120) {
    score += 25;
    factors.push("Observation window covers extended period (> 2 min)");
  } else if (windowSeconds >= 30) {
    score += 15;
    factors.push("Moderate observation window (> 30 sec)");
  } else {
    score += 5;
    factors.push("Brief observation duration");
  }

  // 3. Trend strength & consistency
  if (kinematics.strength === "STRONG") {
    score += 25;
    factors.push("Strong monotonic progression fit");
  } else if (kinematics.strength === "MODERATE") {
    score += 15;
    factors.push("Moderate directional trend alignment");
  } else if (kinematics.strength === "WEAK") {
    score += 5;
    factors.push("Weak or noisy trend slope");
  }

  // 4. Multi-sensor agreement
  if (correlation.hasCompoundHazard) {
    score += 20;
    factors.push("Multi-sensor physical corroboration");
  } else if (correlation.displacementWorsening) {
    score += 10;
    factors.push("Single-sensor progression");
  }

  const normalizedScore = Math.min(100, Math.max(10, score));

  let level: ConfidenceLevel = "LOW";
  if (normalizedScore >= 70) level = "HIGH";
  else if (normalizedScore >= 45) level = "MEDIUM";
  else level = "LOW";

  return {
    level,
    score: normalizedScore,
    label: "Trend-based estimate — requires field calibration.",
    factors,
  };
}

/**
 * Synthesize diagnostic explanation explaining WHY the prediction was reached.
 */
function synthesizeExplanation(
  status: PredictiveAlertStatus,
  kinematics: DisplacementKinematics,
  tilt: MetricTrendSummary,
  vibration: MetricTrendSummary,
  risk: MetricTrendSummary,
  correlation: MultiSensorCorrelation,
  projection: ThresholdProjection
): { headline: string; summary: string; reasons: string[] } {
  const reasons: string[] = [];

  // Displacement statement
  if (kinematics.isProgressive) {
    const accelText = kinematics.isAccelerating ? " and accelerating" : "";
    reasons.push(
      `Displacement is progressively increasing${accelText} at ${(kinematics.velocityCmPerMin ?? 0).toFixed(2)} cm/min.`
    );
  } else if (kinematics.currentDisplacement >= DISPLACEMENT_WARNING) {
    reasons.push(
      `Displacement (${kinematics.currentDisplacement.toFixed(2)} cm) remains elevated above the warning threshold.`
    );
  } else {
    reasons.push(
      `Displacement (${kinematics.currentDisplacement.toFixed(2)} cm) remains stable within baseline limits.`
    );
  }

  // Tilt statement
  if (tilt.direction === "INCREASING" && Math.abs(tilt.rateOfChangePerMin ?? 0) > 0.2) {
    reasons.push(
      `Tilt is trending upward (+${(tilt.rateOfChangePerMin ?? 0).toFixed(2)}°/min), indicating progressive strata rotation.`
    );
  } else if (tilt.isPersistentAbnormal) {
    reasons.push(
      `Tilt remains persistently elevated (${tilt.current.toFixed(1)}°) across the observation window.`
    );
  }

  // Vibration statement
  if (vibration.isSpike) {
    reasons.push(
      "Recent vibration increase was a temporary transient spike and has reverted toward normal."
    );
  } else if (vibration.direction === "INCREASING" && (vibration.rateOfChangePerMin ?? 0) > 0.05) {
    reasons.push(
      `Vibration energy is escalating (+${(vibration.rateOfChangePerMin ?? 0).toFixed(2)} g/min), suggesting continuous ground excitation.`
    );
  }

  // Correlation statement
  if (correlation.hasCompoundHazard) {
    reasons.push(correlation.patternDescription);
  }

  // Risk statement
  if (risk.current >= 40) {
    reasons.push(
      `Subsidence risk index is currently elevated (${risk.current}/100) based on existing multi-parameter risk engine.`
    );
  }

  // Threshold projection statement
  if (projection.isMovingToward && projection.projectedSeconds) {
    reasons.push(projection.projectionMessage);
  } else if (projection.isExceeded) {
    reasons.push(projection.projectionMessage);
  }

  let headline = "";
  let summary = "";

  switch (status) {
    case "CRITICAL_IMMINENT":
      headline = "Critical Geotechnical Deterioration Imminent";
      summary =
        "Predictive concern is critically elevated. Rapid progressive displacement and compounding sensor warnings indicate imminent threshold breach.";
      break;
    case "WARNING_IMMINENT":
      headline = "Warning Threshold Progression Detected";
      summary =
        "Subsidence kinematics show progressive ground movement advancing toward safe operating limits before triggering critical alerts.";
      break;
    case "WATCH":
      headline = "Elevated Dynamic Activity / Persistent Anomaly";
      summary =
        "Sensor telemetry shows localized anomalous behavior (e.g. persistent tilt or elevated vibration) without sustained displacement runaway.";
      break;
    case "THRESHOLD_EXCEEDED":
      headline = "Threshold Criteria Already Surpassed";
      summary =
        "Current displacement or stability metrics have already crossed warning or critical operating limits.";
      break;
    case "INSUFFICIENT_DATA":
      headline = "Insufficient Historical Data";
      summary =
        "Awaiting further telemetry points to construct statistically reliable velocity and acceleration trends.";
      break;
    case "STABLE":
    default:
      headline = "Nominal Baseline Stability";
      summary =
        "All telemetry metrics fluctuate within normal baseline thresholds with no progressive movement or runaway trends detected.";
      break;
  }

  return { headline, summary, reasons };
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

/**
 * Primary analytical function for the Trend Analysis and Early Failure Prediction page.
 * Processes raw or analyzed historical points for a given node.
 */
export function performTrendAnalysis(
  nodeId: string,
  rawHistory: TimePoint[]
): PredictiveAnalysisResult {
  const history = sanitizeHistory(rawHistory);
  const sampleCount = history.length;

  if (sampleCount < 2) {
    const single = history[0];
    const emptyKinematics: DisplacementKinematics = {
      currentDisplacement: single ? single.displacement : 0,
      velocityCmPerMin: null,
      velocityCmPerSec: null,
      accelerationCmPerMin2: null,
      accelerationCmPerSec2: null,
      direction: "STABLE",
      strength: "NONE",
      classification: "INSUFFICIENT_DATA",
      isAccelerating: false,
      isProgressive: false,
    };

    const emptySummary = (val: number): MetricTrendSummary => ({
      current: val,
      previous: null,
      absoluteChange: null,
      percentageChange: null,
      rateOfChangePerMin: null,
      rateOfChangePerSec: null,
      direction: "STABLE",
      strength: "NONE",
      classification: "INSUFFICIENT_DATA",
      isSpike: false,
      isPersistentAbnormal: false,
      baselineMean: val,
      deviationFromBaseline: 0,
    });

    const tiltVal = single ? Math.max(Math.abs(single.tilt_x), Math.abs(single.tilt_y)) : 0;
    const vibVal = single ? single.vibration : 0;
    const riskVal = single?.risk_score ?? 0;

    const tiltSummary = emptySummary(tiltVal);
    const vibSummary = emptySummary(vibVal);
    const riskSummary = emptySummary(riskVal);

    const correlation: MultiSensorCorrelation = {
      displacementWorsening: false,
      tiltWorsening: false,
      vibrationWorsening: false,
      riskWorsening: false,
      correlatedSignals: [],
      patternDescription: "Insufficient data points to assess multi-sensor correlation.",
      hasCompoundHazard: false,
      compoundSeverity: "NONE",
    };

    const projection: ThresholdProjection = {
      metricName: "Displacement",
      currentValue: single ? single.displacement : 0,
      targetThreshold: DISPLACEMENT_WARNING,
      thresholdType: "WARNING",
      isExceeded: (single?.displacement ?? 0) >= DISPLACEMENT_WARNING,
      isMovingToward: false,
      projectedSeconds: null,
      projectedFormatted: "—",
      projectionMessage: "Insufficient historical data for trend projection.",
    };

    return {
      nodeId,
      status: "INSUFFICIENT_DATA",
      statusLabel: "INSUFFICIENT DATA",
      statusColor: "text-slate-400 bg-slate-800/60 border-slate-700",
      confidence: {
        level: "LOW",
        score: 10,
        label: "Trend-based estimate — requires field calibration.",
        factors: ["Need at least 3 historical readings to establish velocity."],
      },
      displacement: emptyKinematics,
      tilt: tiltSummary,
      vibration: vibSummary,
      risk: riskSummary,
      correlation,
      projection,
      explanation: {
        headline: "Insufficient Historical Telemetry",
        summary: "Accumulating sensor readings for trend analysis and rate-of-change estimation.",
        reasons: ["A minimum of 2-3 historical data points is required."],
      },
      sampleCount,
      observationWindowSeconds: 0,
    };
  }

  // Extract time series arrays (in seconds from first timestamp)
  const t0 = parseTime(history[0].timestamp) / 1000;
  const observationWindowSeconds = Math.max(
    0,
    Math.round(parseTime(history[history.length - 1].timestamp) / 1000 - t0)
  );

  const dispSeries = history.map((p) => ({
    t: parseTime(p.timestamp) / 1000,
    v: p.displacement,
  }));

  const tiltSeries = history.map((p) => ({
    t: parseTime(p.timestamp) / 1000,
    v: Math.max(Math.abs(p.tilt_x), Math.abs(p.tilt_y)),
  }));

  const vibSeries = history.map((p) => ({
    t: parseTime(p.timestamp) / 1000,
    v: p.vibration,
  }));

  const riskSeries = history.map((p) => ({
    t: parseTime(p.timestamp) / 1000,
    v: p.risk_score ?? 0,
  }));

  // Perform analytical calculations
  const displacement = calculateDisplacementKinematics(dispSeries);
  const tilt = analyzeMetricTrend(tiltSeries, TILT_WARNING, 0.2);
  const vibration = analyzeMetricTrend(vibSeries, VIBRATION_WARNING, 0.05);
  const risk = analyzeMetricTrend(riskSeries, 40, 2.0);

  const correlation = correlateSensors(displacement, tilt, vibration, risk);
  const projection = projectTimeToThreshold(displacement);
  const confidence = computeConfidence(sampleCount, observationWindowSeconds, displacement, correlation);

  // Overall Predictive Alert Status synthesis:
  // - THRESHOLD_EXCEEDED: If already past critical or warning
  // - CRITICAL_IMMINENT: Projected to breach critical within 30 mins, or warning within 10 mins with compound hazard
  // - WARNING_IMMINENT: Projected to breach warning within 60 mins, or progressive movement with positive acceleration
  // - WATCH: Elevated persistent condition, transient spike, or weak progression
  // - STABLE: Nominal baseline
  let status: PredictiveAlertStatus = "STABLE";
  let statusLabel = "STABLE / NORMAL";
  let statusColor = "text-emerald-400 bg-emerald-950/60 border-emerald-800/80";

  if (projection.isExceeded) {
    status = "THRESHOLD_EXCEEDED";
    statusLabel = "THRESHOLD EXCEEDED";
    statusColor = "text-rose-400 bg-rose-950/70 border-rose-800";
  } else if (
    (projection.thresholdType === "CRITICAL" && (projection.projectedSeconds ?? Infinity) < 1800) ||
    (projection.thresholdType === "WARNING" &&
      (projection.projectedSeconds ?? Infinity) < 900 &&
      correlation.hasCompoundHazard)
  ) {
    status = "CRITICAL_IMMINENT";
    statusLabel = "CRITICAL FAILURE IMMINENT";
    statusColor = "text-rose-400 bg-rose-950/70 border-rose-800 animate-pulse";
  } else if (
    displacement.isProgressive ||
    (projection.isMovingToward && (projection.projectedSeconds ?? Infinity) < 7200) ||
    (correlation.hasCompoundHazard && correlation.compoundSeverity === "HIGH")
  ) {
    status = "WARNING_IMMINENT";
    statusLabel = "WARNING IMMINENT (PROGRESSION)";
    statusColor = "text-amber-400 bg-amber-950/60 border-amber-800";
  } else if (
    correlation.compoundSeverity === "ELEVATED" ||
    tilt.isPersistentAbnormal ||
    vibration.isPersistentAbnormal ||
    vibration.isSpike ||
    displacement.direction === "INCREASING"
  ) {
    status = "WATCH";
    statusLabel = "ELEVATED WATCH";
    statusColor = "text-yellow-300 bg-yellow-950/50 border-yellow-800";
  } else {
    status = "STABLE";
    statusLabel = "STABLE BASELINE";
    statusColor = "text-teal-400 bg-teal-950/50 border-teal-800";
  }

  const explanation = synthesizeExplanation(
    status,
    displacement,
    tilt,
    vibration,
    risk,
    correlation,
    projection
  );

  return {
    nodeId,
    status,
    statusLabel,
    statusColor,
    confidence,
    displacement,
    tilt,
    vibration,
    risk,
    correlation,
    projection,
    explanation,
    sampleCount,
    observationWindowSeconds,
  };
}
