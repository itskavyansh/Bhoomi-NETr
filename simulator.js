// =============================================================================
// Bhoomi-NETr  |  Sensor Simulator (fake ESP32)
// Usage:
//   node simulator.js                            # normal, all nodes
//   node simulator.js --scenario=normal          # same as above
//   node simulator.js --scenario=excessive_tilt  # ramp tilt_x → 25-30°
//   node simulator.js --scenario=high_vibration  # ramp vibration → 1.5-2.0 g
//   node simulator.js --scenario=critical        # ramp tilt + vibration + distance drop
//   node simulator.js --scenario=critical --node=NODE_02  # target one node only
//
// Reads from .env — never hardcodes secrets.
// =============================================================================

// ---------------------------------------------------------------------------
// Load .env manually (no external deps — pure Node.js)
// ---------------------------------------------------------------------------
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    try {
        const raw = readFileSync(resolve(__dirname, ".env"), "utf8");
        for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx === -1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            if (!process.env[key]) process.env[key] = val;
        }
    } catch {
        console.warn("[WARN] Could not read .env — falling back to process environment.");
    }
}
loadEnv();

// ---------------------------------------------------------------------------
// Config & CLI arg parsing
// ---------------------------------------------------------------------------
const NODES = ["NODE_01", "NODE_02", "NODE_03"];

const args = process.argv.slice(2);
const getFlag = (name) => {
    const match = args.find((a) => a.startsWith(`--${name}=`));
    return match ? match.split("=")[1] : null;
};

// Interval between ticks in milliseconds: default 1000ms (1s), or customizable via --interval=<ms>
const parsedInterval = Number(getFlag("interval"));
const INTERVAL = !Number.isNaN(parsedInterval) && parsedInterval > 0 ? parsedInterval : 1000;

const ENDPOINT = process.env.SUPABASE_URL
    ? `${process.env.SUPABASE_URL}/functions/v1/sensor-data`
    : null;
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? null;

if (!ENDPOINT || !ANON_KEY) {
    console.error("[FATAL] SUPABASE_URL or SUPABASE_ANON_KEY missing from .env");
    process.exit(1);
}

const SCENARIO = getFlag("scenario") ?? "normal";
const TARGET_NODE = getFlag("node") ?? null;
const SENSOR_STATUS_ARG = getFlag("sensor-status") ?? null;

const VALID_SCENARIOS = ["normal", "excessive_tilt", "high_vibration", "critical", "progressive_failure", "hardware_fault"];
if (!VALID_SCENARIOS.includes(SCENARIO)) {
    console.error(`[FATAL] Unknown scenario "${SCENARIO}". Valid: ${VALID_SCENARIOS.join(", ")}`);
    process.exit(1);
}

const ACTIVE_NODES = TARGET_NODE ? [TARGET_NODE] : NODES;

// ---------------------------------------------------------------------------
// Baseline sensor ranges (normal, calm conditions)
// ---------------------------------------------------------------------------
const BASELINE = {
    tilt_x: { center: 4.0, range: 2.0 },   // 2–6°
    tilt_y: { center: 4.0, range: 2.0 },   // 2–6°
    vibration: { center: 0.12, range: 0.08 }, // 0.05–0.2 g
    distance: { center: 20.0, range: 1.0 },  // 19–21 cm
};

// ---------------------------------------------------------------------------
// Scenario thresholds (aligned with Person 2's analysis contract)
// CRITICAL thresholds:  tilt ≥ 25°, vibration ≥ 1.5 g
// (distance drop is a proxy for displacement — tracked separately in Phase 2)
// ---------------------------------------------------------------------------
const SCENARIO_TARGETS = {
    normal: null, // no ramp — pure drift

    excessive_tilt: {
        tilt_x: { target: 27.0, rampSteps: 10 },
        tilt_y: { target: 12.0, rampSteps: 10 },
        vibration: null,
        distance: null,
    },

    high_vibration: {
        tilt_x: null,
        tilt_y: null,
        vibration: { target: 1.75, rampSteps: 10 },
        distance: null,
    },

    critical: {
        tilt_x: { target: 28.0, rampSteps: 10 },  // well above 25° threshold
        tilt_y: { target: 14.0, rampSteps: 10 },
        vibration: { target: 1.85, rampSteps: 10 },  // well above 1.5 g threshold
        distance: { target: 12.0, rampSteps: 12 },  // sharp drop from 20→12 cm
    },

    // Progressive Subsidence Failure: smooth gradual ramp demonstrating early predictive detection
    // before the final critical threshold is reached
    progressive_failure: {
        tilt_x: { target: 16.5, rampSteps: 25 },    // gradually ramps past 15° warning toward critical
        tilt_y: { target: 8.0, rampSteps: 25 },
        vibration: { target: 1.15, rampSteps: 25 },  // gradually ramps past 1.0 g warning
        distance: { target: 17.2, rampSteps: 25 },   // drops from 20cm -> 17.2cm (displacement = 2.8cm)
    },
};

// ---------------------------------------------------------------------------
// Per-node state — persists between ticks so values drift continuously
// ---------------------------------------------------------------------------
function initState(nodeId) {
    return {
        nodeId,
        tick: 0,
        tilt_x: BASELINE.tilt_x.center + rand(-0.5, 0.5),
        tilt_y: BASELINE.tilt_y.center + rand(-0.5, 0.5),
        vibration: BASELINE.vibration.center + rand(-0.02, 0.02),
        distance: BASELINE.distance.center + rand(-0.3, 0.3),
    };
}

const nodeStates = {};
for (const n of ACTIVE_NODES) {
    nodeStates[n] = initState(n);
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function round(val, dp = 3) {
    return parseFloat(val.toFixed(dp));
}

// Smooth ramp: move current value toward target linearly over rampSteps,
// then hold at target ± small jitter so it doesn't freeze perfectly flat.
function applyRamp(current, rampSpec, tick) {
    if (!rampSpec) return null; // no ramp for this field in this scenario
    const { target, rampSteps } = rampSpec;
    if (tick >= rampSteps) {
        // Holding phase — small jitter so signal still looks alive
        return target + rand(-0.05, 0.05) * Math.abs(target) * 0.02;
    }
    // Ramp phase: lerp from current toward target
    const progress = tick / rampSteps;
    return current + (target - current) * progress * 0.35 + rand(-0.05, 0.05);
}

// ---------------------------------------------------------------------------
// Tick: compute next reading for one node
// ---------------------------------------------------------------------------
function nextReading(state) {
    const { tick } = state;
    const targets = SCENARIO_TARGETS[SCENARIO];

    let { tilt_x, tilt_y, vibration, distance } = state;

    if (!targets) {
        // ── NORMAL MODE: pure drift within baseline band ──────────────────────
        tilt_x = clamp(tilt_x + rand(-0.3, 0.3), 1.0, 8.0);
        tilt_y = clamp(tilt_y + rand(-0.3, 0.3), 1.0, 8.0);
        vibration = clamp(vibration + rand(-0.02, 0.02), 0.02, 0.25);
        distance = clamp(distance + rand(-0.2, 0.2), 18.0, 22.0);
    } else {
        // ── SCENARIO MODE: ramp toward target where specified ─────────────────
        const tx = applyRamp(tilt_x, targets.tilt_x, tick);
        const ty = applyRamp(tilt_y, targets.tilt_y, tick);
        const vb = applyRamp(vibration, targets.vibration, tick);
        const ds = applyRamp(distance, targets.distance, tick);

        tilt_x = tx !== null ? clamp(tx, 0, 35) : clamp(tilt_x + rand(-0.2, 0.2), 1, 8);
        tilt_y = ty !== null ? clamp(ty, 0, 35) : clamp(tilt_y + rand(-0.2, 0.2), 1, 8);
        vibration = vb !== null ? clamp(vb, 0, 3.0) : clamp(vibration + rand(-0.01, 0.01), 0.02, 0.25);
        distance = ds !== null ? clamp(ds, 5, 25) : clamp(distance + rand(-0.1, 0.1), 18, 22);
    }

    // Write back to state
    state.tilt_x = tilt_x;
    state.tilt_y = tilt_y;
    state.vibration = vibration;
    state.distance = distance;
    state.tick++;

    const sensorStatus =
        SENSOR_STATUS_ARG !== null
            ? SENSOR_STATUS_ARG
            : SCENARIO === "hardware_fault"
            ? "fault"
            : "ok";

    return {
        node_id: state.nodeId,
        timestamp: new Date().toISOString(),
        tilt_x: round(tilt_x, 2),
        tilt_y: round(tilt_y, 2),
        vibration: round(vibration, 3),
        distance: round(distance, 2),
        mpu6050_status: sensorStatus,
        hc_sr04_status: sensorStatus,
    };
}

// ---------------------------------------------------------------------------
// Send one reading to the Edge Function
// ---------------------------------------------------------------------------
async function sendReading(payload) {
    const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ANON_KEY}`,
            "apikey": ANON_KEY,
        },
        body: JSON.stringify(payload),
    });

    const status = res.status;
    let detail = "";
    if (!res.ok) {
        try {
            const body = await res.json();
            detail = ` — ${JSON.stringify(body)}`;
        } catch {
            detail = ` — (non-JSON error body)`;
        }
    }
    return { status, detail };
}

// ---------------------------------------------------------------------------
// Console log — one clean line per reading
// ---------------------------------------------------------------------------
function logLine(payload, status, detail, durationMs, deltaSec) {
    const ts = payload.timestamp.replace("T", " ").slice(0, 19);
    const ok = status >= 200 && status < 300;
    const icon = ok ? "✅" : "❌";
    const badge = ok ? `\x1b[32m${status}\x1b[0m` : `\x1b[31m${status}${detail}\x1b[0m`;
    const node = `\x1b[36m${payload.node_id}\x1b[0m`;
    const delta = `\x1b[90mΔ${deltaSec}s\x1b[0m`;
    const values = [
        `tilt_x=${payload.tilt_x.toFixed(2)}°`,
        `tilt_y=${payload.tilt_y.toFixed(2)}°`,
        `vib=${payload.vibration.toFixed(3)}g`,
        `dist=${payload.distance.toFixed(2)}cm`,
    ].join("  ");

    // Highlight values that cross CRITICAL thresholds
    const criticalFlags = [];
    if (payload.tilt_x >= 25) criticalFlags.push("TILT_X⚠");
    if (payload.tilt_y >= 25) criticalFlags.push("TILT_Y⚠");
    if (payload.vibration >= 1.5) criticalFlags.push("VIB⚠");
    if (payload.distance <= 13) criticalFlags.push("DIST_DROP⚠");

    const warn = criticalFlags.length
        ? `  \x1b[33m[${criticalFlags.join(" ")}]\x1b[0m`
        : "";

    console.log(`${icon} ${ts}  ${delta}  ${node}  ${values}  HTTP ${badge}  (${durationMs}ms)${warn}`);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const SCENARIO_LABEL = TARGET_NODE
    ? `scenario=${SCENARIO}  node=${TARGET_NODE}`
    : `scenario=${SCENARIO}  nodes=[${ACTIVE_NODES.join(", ")}]`;

console.log(`\n${"─".repeat(72)}`);
console.log(`  Bhoomi-NETr Simulator  |  ${SCENARIO_LABEL}`);
console.log(`  Endpoint : ${ENDPOINT}`);
console.log(`  Interval : ${INTERVAL / 1000}s   Press Ctrl+C to stop`);
console.log(`${"─".repeat(72)}\n`);

let nodeIndex = 0; // round-robin across active nodes
let lastTickMs = null;

function tick() {
    const now = Date.now();
    const deltaSec = lastTickMs ? ((now - lastTickMs) / 1000).toFixed(2) : "0.00";
    lastTickMs = now;

    const nodeId = ACTIVE_NODES[nodeIndex % ACTIVE_NODES.length];
    nodeIndex++;

    const state = nodeStates[nodeId];
    const payload = nextReading(state);

    const t0 = Date.now();

    // Fire and forget: Do not await the fetch. This guarantees the 
    // setInterval stays strictly on schedule even if the network hangs.
    sendReading(payload)
        .then(({ status, detail }) => {
            const durationMs = Date.now() - t0;
            logLine(payload, status, detail, durationMs, deltaSec);
        })
        .catch(err => {
            const durationMs = Date.now() - t0;
            logLine(payload, 0, ` — ${err.message}`, durationMs, deltaSec);
        });
}

// Kick off immediately, then repeat
tick();
const timer = setInterval(tick, INTERVAL);

// Graceful shutdown on Ctrl+C
process.on("SIGINT", () => {
    clearInterval(timer);
    console.log("\n\nSimulator stopped.\n");
    process.exit(0);
});
