// =============================================================================
// Bhoomi-NETr  |  Edge Function: sensor-data
// Runtime: Deno (Supabase Edge Functions)
// Endpoint: POST /functions/v1/sensor-data
//
// Data contract (Phase 1 — do not add fields until team agrees):
//   node_id, timestamp, tilt_x, tilt_y, vibration, distance
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateRisk } from "./risk.ts";
import { processRiskAlert } from "./sms.ts";

// ---------------------------------------------------------------------------
// Environment variables (set via: supabase secrets set KEY=value)
// Never hardcode these — Edge Functions read them from Deno.env at runtime.
// ---------------------------------------------------------------------------
// NOTE: Keys cannot start with "SUPABASE_" (Supabase reserved prefix).
// Set via: supabase secrets set APP_DB_URL=... APP_DB_SERVICE_KEY=...
const SUPABASE_URL = Deno.env.get("APP_DB_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("APP_DB_SERVICE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("FATAL: APP_DB_URL or APP_DB_SERVICE_KEY env var is missing.");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SensorPayload {
    node_id: string;
    timestamp?: string;
    tilt_x: number;
    tilt_y: number;
    vibration: number;
    distance: number;
    displacement?: number;
    mpu6050_status: string;
    hc_sr04_status: string;
}

interface ValidationError {
    field: string;
    reason: string;
}

// ---------------------------------------------------------------------------
// Validation
// Returns an array of field errors. Empty array = valid.
// ---------------------------------------------------------------------------
function validate(body: Record<string, unknown>): ValidationError[] {
    const errors: ValidationError[] = [];

    // node_id: required, non-empty string
    if (body.node_id === undefined || body.node_id === null) {
        errors.push({ field: "node_id", reason: "required but missing" });
    } else if (typeof body.node_id !== "string" || body.node_id.trim() === "") {
        errors.push({ field: "node_id", reason: "must be a non-empty string" });
    }

    // timestamp: optional — if present, must be a valid ISO 8601 string
    if (body.timestamp !== undefined && body.timestamp !== null) {
        if (typeof body.timestamp !== "string") {
            errors.push({ field: "timestamp", reason: "must be an ISO 8601 string (e.g. 2026-09-05T12:30:00Z)" });
        } else {
            const d = new Date(body.timestamp);
            if (isNaN(d.getTime())) {
                errors.push({ field: "timestamp", reason: `"${body.timestamp}" is not a valid ISO 8601 date` });
            }
        }
    }
    // NOTE: if timestamp is missing, we default to server now() — do not reject.

    // displacement: optional numeric
    if (body.displacement !== undefined && body.displacement !== null) {
        if (typeof body.displacement !== "number" || isNaN(body.displacement)) {
            errors.push({ field: "displacement", reason: "must be a valid number if provided" });
        }
    }

    // Numeric sensor fields: required, must be actual numbers (not strings, not null)
    for (const field of ["tilt_x", "tilt_y", "vibration", "distance"] as const) {
        const val = body[field];
        if (val === undefined || val === null) {
            errors.push({ field, reason: "required but missing" });
        } else if (typeof val !== "number" || isNaN(val as number)) {
            errors.push({ field, reason: `must be a number, got ${typeof val} (${JSON.stringify(val)})` });
        }
    }

    for (const field of ["mpu6050_status", "hc_sr04_status"] as const) {
    const val = body[field];

    if (val === undefined || val === null) {
        errors.push({ field, reason: "required but missing" });
    } else if (
        typeof val !== "string" ||
        !["ok", "fault"].includes(val)
    ) {
        errors.push({
            field,
            reason: "must be either 'ok' or 'fault'",
            });
        }
    }

    return errors;
}

// ---------------------------------------------------------------------------
// Helper: structured JSON response
// ---------------------------------------------------------------------------
function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            // CORS headers so browser-based dashboards (Person 3) can call this later
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
    });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
    // Handle CORS preflight (browsers send OPTIONS before POST)
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            },
        });
    }

    // 405 — only POST is accepted
    if (req.method !== "POST") {
        return jsonResponse(
            { error: "Method not allowed. This endpoint only accepts POST requests." },
            405
        );
    }

    // Parse JSON body
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return jsonResponse(
            { error: "Invalid JSON body. Ensure Content-Type is application/json." },
            400
        );
    }

    // Validate payload against data contract
    const errors = validate(body);
    if (errors.length > 0) {
        return jsonResponse(
            {
                error: "Validation failed",
                fields: errors,
                // Helpful hint for hardware devs debugging ESP32 payloads
                hint: "All of tilt_x, tilt_y, vibration, distance must be JSON numbers (not strings). node_id must be a non-empty string.",
            },
            400
        );
    }

    // Build the DB row — use server now() if timestamp was not provided
    const payload = body as SensorPayload;
    const row = {
        node_id: payload.node_id.trim(),
        timestamp: payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString(),
        tilt_x: payload.tilt_x,
        tilt_y: payload.tilt_y,
        vibration: payload.vibration,
        distance: payload.distance,
        displacement: payload.displacement,
        mpu6050_status: payload.mpu6050_status,
        hc_sr04_status: payload.hc_sr04_status,
    };

    // Supabase client — service role bypasses RLS (safe because Edge Functions are server-side)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });

    const { data, error } = await supabase
        .from("sensor_readings")
        .insert(row)
        .select()
        .single();

    if (error) {
        console.error("DB insert error:", error);
        return jsonResponse(
            {
                error: "Database insert failed",
                detail: error.message,
                code: error.code,
            },
            500
        );
    }

    // Trigger authoritative risk assessment & automated SMS alert dispatch
    try {
        const risk = evaluateRisk(payload);
        await processRiskAlert(supabase, risk);
    } catch (alertErr) {
        // Guarantee that SMS alerting issues NEVER crash or block the ingestion pipeline
        console.error("Non-fatal SMS alert processing exception:", alertErr);
    }

    // 201 Created — return the inserted row so the caller can confirm the id/created_at
    return jsonResponse(data, 201);
});

