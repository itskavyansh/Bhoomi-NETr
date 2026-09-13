/**
 * Bhoomi-NETr | Vibration Index & Crack Index Detection Layer
 *
 * Frontend-only interpretation layer built on top of high-frequency
 * piezo vibration telemetry (ADS1115 channel A0) and macro vibration (MPU6050).
 *
 * Distinct from the subsidence risk engine:
 * - Macro Vibration Index detects bulk structural motion/ground vibration.
 * - Crack Index detects acoustic emissions and micro-fracturing shockwaves.
 * - Interpretation distinguishes mechanical resonance from crack propagation.
 */

export type VibrationLevel = "LOW" | "HIGH";
export type CrackActivityLevel = "LOW" | "HIGH" | "CALIBRATING" | "NO_DATA";

export type DetectionInterpretation =
  | "NORMAL"
  | "STRUCTURAL VIBRATION"
  | "POSSIBLE CRACK INITIATION"
  | "CRITICAL STRUCTURAL EVENT";

export interface NodePiezoBaseline {
  baseline_peak: number;
  baseline_rms: number;
  baseline_pp: number;
  sample_count: number;
  updated_at: string;
}

export interface DetectionResult {
  vibrationLevel: VibrationLevel;
  crackLevel: CrackActivityLevel;
  vibrationValue: number;
  crackIndexValue: number | null;
  rawInterpretation: DetectionInterpretation | null;
  interpretation: DetectionInterpretation | "CALIBRATING" | "NO_DATA";
  baselineStatus: "ESTABLISHED" | "CALIBRATING" | "NO_DATA";
  sampleCount: number;
  baseline: NodePiezoBaseline | null;
  peakRatio: number | null;
  rmsRatio: number | null;
  ppRatio: number | null;
}

// ---------------------------------------------------------------------------
// Constants & Configuration
// ---------------------------------------------------------------------------

/**
 * Target sample window to establish the node baseline.
 * ~25 consecutive valid telemetry points provides stable ambient floor averaging.
 */
export const TARGET_BASELINE_SAMPLES = 25;

/**
 * Small epsilon floor to avoid division by zero when calculating ratios
 * if the baseline voltages are near zero.
 */
export const BASELINE_EPSILON_VOLTS = 0.0001;

/**
 * Vibration Index Threshold (g):
 * Aligns with VIBRATION_WARNING in analysisAdapter.ts.
 * Vibration < 1.0g -> "LOW", >= 1.0g -> "HIGH"
 */
export const VIBRATION_INDEX_HIGH_THRESHOLD_G = 1.0;

/**
 * Crack Index Prototype Threshold:
 * A 50% composite increase (1.50×) across high-frequency peak amplitude,
 * peak-to-peak deviation, and RMS energy signifies acoustic shock emission
 * and micro-fracture propagation distinct from normal ambient mechanical noise.
 */
export const CRACK_INDEX_HIGH_THRESHOLD = 1.5;

// Weight coefficients for the composite Crack Index formula
const WEIGHT_PEAK = 0.45;
const WEIGHT_PP = 0.30;
const WEIGHT_RMS = 0.25;

// ---------------------------------------------------------------------------
// In-Memory State: Persistence Filters & Rolling Accumulators
// ---------------------------------------------------------------------------

// Rolling buffer of the last 3 raw classifications per node_id for the 2-of-3 filter
const rollingClassifications = new Map<string, DetectionInterpretation[]>();

// Last stable displayed interpretation per node_id
const lastStableInterpretations = new Map<string, DetectionInterpretation>();

// In-memory calibration sample accumulator for sessions before persisting to localStorage
const calibrationSamples = new Map<
  string,
  Array<{ peak: number; rms: number; pp: number }>
>();

// In-memory cache of established baselines (survives in session, falls back when localStorage is absent)
const inMemoryBaselines = new Map<string, NodePiezoBaseline>();

// ---------------------------------------------------------------------------
// Baseline Helpers (localStorage + in-memory fallback)
// ---------------------------------------------------------------------------

function getStorageKey(nodeId: string): string {
  return `bhoomi_baseline_${nodeId}`;
}

export function loadBaseline(nodeId: string): NodePiezoBaseline | null {
  if (inMemoryBaselines.has(nodeId)) {
    return inMemoryBaselines.get(nodeId)!;
  }
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(nodeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NodePiezoBaseline;
    if (
      typeof parsed.baseline_peak === "number" &&
      typeof parsed.baseline_rms === "number" &&
      typeof parsed.baseline_pp === "number" &&
      parsed.sample_count >= TARGET_BASELINE_SAMPLES
    ) {
      inMemoryBaselines.set(nodeId, parsed);
      return parsed;
    }
  } catch (err) {
    console.warn(`Failed to parse stored baseline for node ${nodeId}:`, err);
  }
  return null;
}

export function saveBaseline(nodeId: string, baseline: NodePiezoBaseline): void {
  inMemoryBaselines.set(nodeId, baseline);
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(getStorageKey(nodeId), JSON.stringify(baseline));
  } catch (err) {
    console.warn(`Failed to save baseline for node ${nodeId}:`, err);
  }
}

export function clearBaseline(nodeId: string): void {
  inMemoryBaselines.delete(nodeId);
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(getStorageKey(nodeId));
  }
  calibrationSamples.delete(nodeId);
  rollingClassifications.delete(nodeId);
  lastStableInterpretations.delete(nodeId);
}

// ---------------------------------------------------------------------------
// Core Calculation & Persistence Filter
// ---------------------------------------------------------------------------

/**
 * Applies a 2-of-3 majority consensus filter to prevent noise spikes from
 * jittering the displayed state.
 * Only updates the displayed interpretation if 2 of the last 3 raw states agree.
 */
function applyPersistenceFilter(
  nodeId: string,
  rawState: DetectionInterpretation
): DetectionInterpretation {
  if (!rollingClassifications.has(nodeId)) {
    rollingClassifications.set(nodeId, []);
  }
  const buffer = rollingClassifications.get(nodeId)!;
  buffer.push(rawState);
  if (buffer.length > 3) {
    buffer.shift();
  }

  // If we don't have enough history yet, show current raw state
  if (buffer.length < 2) {
    lastStableInterpretations.set(nodeId, rawState);
    return rawState;
  }

  // Count occurrences in the last 2-3 items
  const counts = new Map<DetectionInterpretation, number>();
  for (const item of buffer) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }

  for (const [state, count] of counts.entries()) {
    if (count >= 2) {
      lastStableInterpretations.set(nodeId, state);
      return state;
    }
  }

  // If no 2-of-3 agreement, maintain the previous stable state (or fall back to current)
  return lastStableInterpretations.get(nodeId) ?? rawState;
}

/**
 * Evaluates the Vibration Index, Crack Index, and Interpretation for a given reading.
 */
export function evaluateDetection(
  nodeId: string,
  vibration: number,
  piezoPeak?: number | null,
  piezoRms?: number | null,
  piezoPp?: number | null,
  historicalPoints?: Array<{
    piezo_peak?: number | null;
    piezo_rms?: number | null;
    piezo_peak_to_peak?: number | null;
  }>
): DetectionResult {
  const safeVib = typeof vibration === "number" && !isNaN(vibration) ? vibration : 0;
  const vibrationLevel: VibrationLevel =
    safeVib >= VIBRATION_INDEX_HIGH_THRESHOLD_G ? "HIGH" : "LOW";

  // Check if piezo telemetry is present on this reading
  const hasPiezo =
    piezoPeak !== null &&
    piezoPeak !== undefined &&
    piezoRms !== null &&
    piezoRms !== undefined &&
    !isNaN(piezoPeak) &&
    !isNaN(piezoRms);

  if (!hasPiezo) {
    return {
      vibrationLevel,
      crackLevel: "NO_DATA",
      vibrationValue: safeVib,
      crackIndexValue: null,
      rawInterpretation: null,
      interpretation: "NO_DATA",
      baselineStatus: "NO_DATA",
      sampleCount: 0,
      baseline: null,
      peakRatio: null,
      rmsRatio: null,
      ppRatio: null,
    };
  }

  const currentPeak = piezoPeak as number;
  const currentRms = piezoRms as number;
  const currentPp =
    piezoPp !== null && piezoPp !== undefined && !isNaN(piezoPp)
      ? piezoPp
      : currentPeak * 2;

  // Retrieve or compute baseline
  let baseline = loadBaseline(nodeId);

  if (!baseline) {
    // Attempt to seed from historical points if available
    if (historicalPoints && historicalPoints.length >= TARGET_BASELINE_SAMPLES) {
      const validHistorical = historicalPoints.filter(
        (p) =>
          p.piezo_peak != null &&
          p.piezo_rms != null &&
          !isNaN(p.piezo_peak) &&
          !isNaN(p.piezo_rms)
      );

      if (validHistorical.length >= TARGET_BASELINE_SAMPLES) {
        const sampleSlice = validHistorical.slice(0, TARGET_BASELINE_SAMPLES);
        const sumPeak = sampleSlice.reduce((acc, p) => acc + (p.piezo_peak ?? 0), 0);
        const sumRms = sampleSlice.reduce((acc, p) => acc + (p.piezo_rms ?? 0), 0);
        const sumPp = sampleSlice.reduce(
          (acc, p) => acc + (p.piezo_peak_to_peak ?? (p.piezo_peak ?? 0) * 2),
          0
        );

        baseline = {
          baseline_peak: Math.max(BASELINE_EPSILON_VOLTS, sumPeak / sampleSlice.length),
          baseline_rms: Math.max(BASELINE_EPSILON_VOLTS, sumRms / sampleSlice.length),
          baseline_pp: Math.max(BASELINE_EPSILON_VOLTS, sumPp / sampleSlice.length),
          sample_count: sampleSlice.length,
          updated_at: new Date().toISOString(),
        };
        saveBaseline(nodeId, baseline);
      }
    }
  }

  if (!baseline) {
    // Accumulate in-memory real-time samples
    if (!calibrationSamples.has(nodeId)) {
      calibrationSamples.set(nodeId, []);
    }
    const samples = calibrationSamples.get(nodeId)!;
    samples.push({ peak: currentPeak, rms: currentRms, pp: currentPp });

    if (samples.length >= TARGET_BASELINE_SAMPLES) {
      const sumPeak = samples.reduce((acc, s) => acc + s.peak, 0);
      const sumRms = samples.reduce((acc, s) => acc + s.rms, 0);
      const sumPp = samples.reduce((acc, s) => acc + s.pp, 0);

      baseline = {
        baseline_peak: Math.max(BASELINE_EPSILON_VOLTS, sumPeak / samples.length),
        baseline_rms: Math.max(BASELINE_EPSILON_VOLTS, sumRms / samples.length),
        baseline_pp: Math.max(BASELINE_EPSILON_VOLTS, sumPp / samples.length),
        sample_count: samples.length,
        updated_at: new Date().toISOString(),
      };
      saveBaseline(nodeId, baseline);
    } else {
      // Still calibrating baseline
      return {
        vibrationLevel,
        crackLevel: "CALIBRATING",
        vibrationValue: safeVib,
        crackIndexValue: null,
        rawInterpretation: null,
        interpretation: "CALIBRATING",
        baselineStatus: "CALIBRATING",
        sampleCount: samples.length,
        baseline: null,
        peakRatio: null,
        rmsRatio: null,
        ppRatio: null,
      };
    }
  }

  // Compute baseline-normalized scores with epsilon floors
  const basePeak = Math.max(BASELINE_EPSILON_VOLTS, baseline.baseline_peak);
  const baseRms = Math.max(BASELINE_EPSILON_VOLTS, baseline.baseline_rms);
  const basePp = Math.max(BASELINE_EPSILON_VOLTS, baseline.baseline_pp);

  const peakScore = currentPeak / basePeak;
  const rmsScore = currentRms / baseRms;
  const ppScore = currentPp / basePp;

  // Exact composite Crack Index formula
  const crackIndex =
    WEIGHT_PEAK * peakScore + WEIGHT_PP * ppScore + WEIGHT_RMS * rmsScore;

  const crackLevel: CrackActivityLevel =
    crackIndex >= CRACK_INDEX_HIGH_THRESHOLD ? "HIGH" : "LOW";

  // Decision matrix mapping
  let rawState: DetectionInterpretation;
  if (vibrationLevel === "LOW" && crackLevel === "LOW") {
    rawState = "NORMAL";
  } else if (vibrationLevel === "HIGH" && crackLevel === "LOW") {
    rawState = "STRUCTURAL VIBRATION";
  } else if (vibrationLevel === "LOW" && crackLevel === "HIGH") {
    rawState = "POSSIBLE CRACK INITIATION";
  } else {
    rawState = "CRITICAL STRUCTURAL EVENT";
  }

  const filteredInterpretation = applyPersistenceFilter(nodeId, rawState);

  return {
    vibrationLevel,
    crackLevel,
    vibrationValue: safeVib,
    crackIndexValue: Number(crackIndex.toFixed(2)),
    rawInterpretation: rawState,
    interpretation: filteredInterpretation,
    baselineStatus: "ESTABLISHED",
    sampleCount: baseline.sample_count,
    baseline,
    peakRatio: Number(peakScore.toFixed(2)),
    rmsRatio: Number(rmsScore.toFixed(2)),
    ppRatio: Number(ppScore.toFixed(2)),
  };
}
