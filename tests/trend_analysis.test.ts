import test from "node:test";
import assert from "node:assert/strict";

import {
  performTrendAnalysis,
  sanitizeHistory,
  projectTimeToThreshold,
} from "../src/services/trendAnalysis.ts";
import type { TimePoint } from "../src/types/sensor.ts";
import { DISPLACEMENT_WARNING } from "../src/services/analysisAdapter.ts";

function createPoint(
  timestamp: string,
  displacement: number,
  tilt = 4.0,
  vibration = 0.1,
  distance = 20.0 - displacement,
  risk_score = 10
): TimePoint {
  return {
    timestamp,
    displacement,
    distance,
    tilt_x: tilt,
    tilt_y: 2.0,
    vibration,
    risk_score,
  };
}

// -----------------------------------------------------------------------------
// SCENARIO 1: Stable readings
// -----------------------------------------------------------------------------
test("Scenario 1: Stable readings — nominal baseline operation", () => {
  const baseTime = new Date("2026-09-11T12:00:00Z").getTime();
  const history: TimePoint[] = [];

  for (let i = 0; i < 10; i++) {
    const ts = new Date(baseTime + i * 5000).toISOString();
    // Minor noise +/- 0.02
    const disp = 0.25 + (i % 2 === 0 ? 0.01 : -0.01);
    history.push(createPoint(ts, disp, 3.5, 0.12, 19.75, 5));
  }

  const result = performTrendAnalysis("NODE_01", history);

  assert.equal(result.status, "STABLE");
  assert.equal(result.displacement.direction, "STABLE");
  assert.equal(result.displacement.classification, "NORMAL_BASELINE");
  assert.equal(result.displacement.isProgressive, false);
  assert.equal(result.projection.isExceeded, false);
  assert.equal(result.projection.isMovingToward, false);
});

// -----------------------------------------------------------------------------
// SCENARIO 2: Increasing displacement
// -----------------------------------------------------------------------------
test("Scenario 2: Increasing displacement — positive velocity and progressive classification", () => {
  const baseTime = new Date("2026-09-11T12:00:00Z").getTime();
  const history: TimePoint[] = [];

  // Steadily rising displacement over 10 points
  for (let i = 0; i < 10; i++) {
    const ts = new Date(baseTime + i * 10000).toISOString();
    const disp = Number((0.4 + i * 0.12).toFixed(2)); // 0.40 -> 1.48
    history.push(createPoint(ts, disp, 4.0, 0.12));
  }

  const result = performTrendAnalysis("NODE_01", history);

  assert.equal(result.displacement.direction, "INCREASING");
  assert.ok((result.displacement.velocityCmPerMin ?? 0) > 0.05);
  assert.equal(result.displacement.isProgressive, true);
  assert.equal(result.displacement.classification, "PROGRESSIVE_MOVEMENT");
  assert.ok(result.status === "WARNING_IMMINENT" || result.status === "WATCH");
});

// -----------------------------------------------------------------------------
// SCENARIO 3: Accelerating displacement
// -----------------------------------------------------------------------------
test("Scenario 3: Accelerating displacement — positive acceleration detected", () => {
  const baseTime = new Date("2026-09-11T12:00:00Z").getTime();
  const history: TimePoint[] = [];

  // Non-linear, quadratic growth: d(t) = 0.2 + 0.01*t + 0.003*t^2
  const values = [0.2, 0.25, 0.35, 0.55, 0.85, 1.25, 1.8];
  for (let i = 0; i < values.length; i++) {
    const ts = new Date(baseTime + i * 10000).toISOString();
    history.push(createPoint(ts, values[i], 4.0, 0.15));
  }

  const result = performTrendAnalysis("NODE_01", history);

  assert.equal(result.displacement.direction, "INCREASING");
  assert.ok((result.displacement.accelerationCmPerSec2 ?? 0) > 0);
  assert.equal(result.displacement.isAccelerating, true);
});

// -----------------------------------------------------------------------------
// SCENARIO 4: Temporary vibration spike
// -----------------------------------------------------------------------------
test("Scenario 4: Temporary vibration spike — classifies as spike and does not predict failure", () => {
  const baseTime = new Date("2026-09-11T12:00:00Z").getTime();
  const history: TimePoint[] = [
    createPoint(new Date(baseTime + 0).toISOString(), 0.3, 4.0, 0.12),
    createPoint(new Date(baseTime + 10000).toISOString(), 0.3, 4.0, 0.15),
    createPoint(new Date(baseTime + 20000).toISOString(), 0.3, 4.0, 1.75), // Spike above 1.0g
    createPoint(new Date(baseTime + 30000).toISOString(), 0.3, 4.0, 0.2),  // Drops back to calm
    createPoint(new Date(baseTime + 40000).toISOString(), 0.3, 4.0, 0.14),
  ];

  const result = performTrendAnalysis("NODE_01", history);

  assert.equal(result.vibration.isSpike, true);
  assert.equal(result.vibration.classification, "TEMPORARY_SPIKE");
  assert.equal(result.displacement.isProgressive, false);
  assert.notEqual(result.status, "CRITICAL_IMMINENT");
  assert.ok(result.explanation.reasons.some((r) => r.includes("temporary") || r.includes("spike")));
});

// -----------------------------------------------------------------------------
// SCENARIO 5: Persistent abnormal readings
// -----------------------------------------------------------------------------
test("Scenario 5: Persistent abnormal readings — elevated condition held without runaway", () => {
  const baseTime = new Date("2026-09-11T12:00:00Z").getTime();
  const history: TimePoint[] = [];

  // Tilt stays above 15° warning for 6 consecutive readings
  for (let i = 0; i < 6; i++) {
    const ts = new Date(baseTime + i * 10000).toISOString();
    history.push(createPoint(ts, 0.4, 18.5 + (i % 2 === 0 ? 0.2 : -0.2), 0.15));
  }

  const result = performTrendAnalysis("NODE_01", history);

  assert.equal(result.tilt.isPersistentAbnormal, true);
  assert.equal(result.tilt.classification, "PERSISTENT_ABNORMAL");
  assert.ok(result.status === "WATCH" || result.status === "WARNING_IMMINENT");
});

// -----------------------------------------------------------------------------
// SCENARIO 6: Multi-sensor worsening
// -----------------------------------------------------------------------------
test("Scenario 6: Multi-sensor worsening — compound hazard escalates concern", () => {
  const baseTime = new Date("2026-09-11T12:00:00Z").getTime();
  const history: TimePoint[] = [];

  // Displacement, tilt, and vibration all escalating together
  for (let i = 0; i < 8; i++) {
    const ts = new Date(baseTime + i * 10000).toISOString();
    const disp = 0.5 + i * 0.15; // 0.5 -> 1.55 cm
    const tilt = 5.0 + i * 1.5;   // 5.0 -> 15.5 deg
    const vib = 0.2 + i * 0.12;   // 0.2 -> 1.04 g
    history.push(createPoint(ts, disp, tilt, vib, 20.0 - disp, 20 + i * 8));
  }

  const result = performTrendAnalysis("NODE_01", history);

  assert.equal(result.correlation.hasCompoundHazard, true);
  assert.equal(result.correlation.displacementWorsening, true);
  assert.equal(result.correlation.tiltWorsening, true);
  assert.equal(result.correlation.vibrationWorsening, true);
  assert.equal(result.correlation.compoundSeverity, "CRITICAL");
  assert.ok(result.status === "CRITICAL_IMMINENT" || result.status === "WARNING_IMMINENT");
});

// -----------------------------------------------------------------------------
// SCENARIO 7: Threshold already exceeded
// -----------------------------------------------------------------------------
test("Scenario 7: Threshold already exceeded — handles critical state accurately", () => {
  const baseTime = new Date("2026-09-11T12:00:00Z").getTime();
  const history: TimePoint[] = [
    createPoint(new Date(baseTime).toISOString(), 2.8, 14.0, 0.4),
    createPoint(new Date(baseTime + 10000).toISOString(), 3.2, 16.0, 0.8), // Past 3.0cm critical
  ];

  const result = performTrendAnalysis("NODE_01", history);

  assert.equal(result.status, "THRESHOLD_EXCEEDED");
  assert.equal(result.projection.isExceeded, true);
  assert.equal(result.projection.projectedFormatted, "Exceeded");
});

// -----------------------------------------------------------------------------
// SCENARIO 8: Insufficient historical data
// -----------------------------------------------------------------------------
test("Scenario 8: Insufficient historical data — graceful fallback without errors", () => {
  // Empty history
  const emptyResult = performTrendAnalysis("NODE_01", []);
  assert.equal(emptyResult.status, "INSUFFICIENT_DATA");
  assert.equal(emptyResult.sampleCount, 0);
  assert.equal(emptyResult.displacement.velocityCmPerMin, null);
  assert.equal(emptyResult.projection.projectedFormatted, "—");

  // Single point
  const singlePoint = [createPoint("2026-09-11T12:00:00Z", 0.5)];
  const singleResult = performTrendAnalysis("NODE_01", singlePoint);
  assert.equal(singleResult.status, "INSUFFICIENT_DATA");
  assert.equal(singleResult.sampleCount, 1);
  assert.equal(singleResult.displacement.currentDisplacement, 0.5);
  assert.equal(singleResult.displacement.velocityCmPerMin, null);
});

// -----------------------------------------------------------------------------
// SCENARIO 9: Invalid and duplicate timestamps
// -----------------------------------------------------------------------------
test("Scenario 9: Invalid timestamps — handles duplicate and unordered timestamps safely", () => {
  const historyWithDuplicates: TimePoint[] = [
    createPoint("2026-09-11T12:00:10Z", 0.5),
    createPoint("2026-09-11T12:00:00Z", 0.4), // Out of order
    createPoint("2026-09-11T12:00:10Z", 0.55), // Duplicate timestamp
    createPoint("invalid-date-string", 0.6),   // Invalid timestamp
    createPoint("2026-09-11T12:00:20Z", 0.7),
  ];

  const sanitized = sanitizeHistory(historyWithDuplicates);

  // Must be sorted ascending and deduplicated
  assert.equal(sanitized.length, 3);
  assert.equal(sanitized[0].timestamp, "2026-09-11T12:00:00Z");
  assert.equal(sanitized[1].timestamp, "2026-09-11T12:00:10Z");
  assert.equal(sanitized[2].timestamp, "2026-09-11T12:00:20Z");

  // Trend analysis must execute safely without throwing or NaN
  const result = performTrendAnalysis("NODE_01", historyWithDuplicates);
  assert.ok(Number.isFinite(result.displacement.currentDisplacement));
  assert.ok(result.displacement.velocityCmPerMin !== null);
  assert.ok(!Number.isNaN(result.displacement.velocityCmPerMin));
});

// -----------------------------------------------------------------------------
// SCENARIO 10: Time-to-threshold projection
// -----------------------------------------------------------------------------
test("Scenario 10: Time-to-threshold calculation — accurate estimation", () => {
  // Current displacement = 1.0 cm, target warning = 2.0 cm (remaining = 1.0 cm)
  // Velocity = 0.05 cm/s => expected time = 1.0 / 0.05 = 20 seconds
  const kinematics = {
    currentDisplacement: 1.0,
    velocityCmPerSec: 0.05,
    velocityCmPerMin: 3.0,
    accelerationCmPerSec2: 0,
    accelerationCmPerMin2: 0,
    direction: "INCREASING" as const,
    strength: "STRONG" as const,
    classification: "PROGRESSIVE_MOVEMENT" as const,
    isAccelerating: false,
    isProgressive: true,
  };

  const projection = projectTimeToThreshold(kinematics);

  assert.equal(projection.isExceeded, false);
  assert.equal(projection.isMovingToward, true);
  assert.equal(projection.targetThreshold, DISPLACEMENT_WARNING);
  assert.equal(projection.thresholdType, "WARNING");
  assert.equal(projection.projectedSeconds, 20);
  assert.equal(projection.projectedFormatted, "~20 seconds");
  assert.ok(projection.projectionMessage.includes("warning threshold (2.00 cm)"));
});
