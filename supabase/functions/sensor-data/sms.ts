// =============================================================================
// Bhoomi-NETr | SMS Alert Service
// Integrates Fast2SMS Dev API (Quick SMS route "q") with state-transition
// deduplication, cooldown controls, phone normalization, and resilient logging.
// =============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EvaluatedRisk } from "./risk.ts";

export const FAST2SMS_ENDPOINT = "https://www.fast2sms.com/dev/bulkV2";
export const DEFAULT_COOLDOWN_MINUTES = 15;

export interface SmsResult {
  attempted: boolean;
  success: boolean;
  status:
    | "SMS_REQUEST_ACCEPTED"
    | "SMS_ALERT_FAILED"
    | "SKIPPED_NORMAL_OR_WARNING"
    | "SKIPPED_COOLDOWN"
    | "SKIPPED_DISABLED"
    | "SKIPPED_INVALID_CONFIG";
  requestId?: string;
  error?: string;
  recipient?: string;
  message?: string;
}

export interface NodeAlertState {
  lastStatus: string;
  lastAlertSentAt: number; // epoch ms
  lastRiskScore: number;
}

// In-memory fallback for state deduplication across requests
const memoryState = new Map<string, NodeAlertState>();

/**
 * Normalizes and validates an Indian phone number.
 * Accepts formats: "+919876543210", "919876543210", "+91 98765-43210", "09876543210", "9876543210"
 * Returns clean 10-digit mobile number, or null if invalid.
 */
export function normalizePhoneNumber(rawNumber?: string | null): string | null {
  if (!rawNumber || typeof rawNumber !== "string") {
    return null;
  }

  // Remove all non-digit characters
  let digits = rawNumber.replace(/\D/g, "");

  // Remove leading international code (+91 / 91)
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  // Remove leading trunk zero (0)
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Valid Indian mobile numbers are 10 digits starting with 6, 7, 8, or 9
  if (/^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  return null;
}

/**
 * Formats a concise, professional emergency SMS message.
 */
export function buildAlertMessage(risk: EvaluatedRisk): string {
  const warningsFormatted =
    risk.warnings.length > 0
      ? risk.warnings.map((w) => w.replace(/_/g, " ")).join(", ")
      : "Multiple sensor thresholds breached";

  return `Bhoomi-NETr ALERT: Node ${risk.node_id} is at ${risk.status} risk. Risk Score: ${risk.risk_score}. (${warningsFormatted}). Immediate inspection required.`;
}

/**
 * Executes the Fast2SMS Quick SMS API request.
 * Strictly avoids leaking the API key in logs or error messages.
 */
export async function sendFast2SMS(
  apiKey: string,
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const payload = {
      route: "q",
      message,
      numbers: phoneNumber,
      sms_details: "1",
    };

    const response = await fetch(FAST2SMS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let responseData: Record<string, unknown> = {};
    try {
      responseData = await response.json();
    } catch {
      return {
        success: false,
        error: `Fast2SMS HTTP ${response.status} (non-JSON response)`,
      };
    }

    // Fast2SMS return: true indicates request accepted
    if (response.ok && responseData.return === true) {
      const requestId = Array.isArray(responseData.request_id)
        ? responseData.request_id[0]
        : typeof responseData.request_id === "string"
        ? responseData.request_id
        : undefined;

      return {
        success: true,
        requestId,
      };
    }

    // API rejected request or authentication/balance issue
    const apiMessage = Array.isArray(responseData.message)
      ? responseData.message.join(", ")
      : typeof responseData.message === "string"
      ? responseData.message
      : `HTTP ${response.status} rejected`;

    return {
      success: false,
      error: `Fast2SMS API error: ${apiMessage}`,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const errorMsg =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Request timed out after 10 seconds"
          : err.message
        : "Network error";

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Checks state-transition and cooldown to prevent SMS flooding.
 */
export function checkAlertEligibility(
  nodeId: string,
  currentStatus: string,
  cooldownMinutes: number,
  previousState?: NodeAlertState | null
): { shouldAlert: boolean; reason: string } {
  const isCritical =
    currentStatus === "CRITICAL" || currentStatus === "HIGH_RISK";

  if (!isCritical) {
    return {
      shouldAlert: false,
      reason: "Status is not CRITICAL",
    };
  }

  if (!previousState) {
    // First reading encountered for this node
    return {
      shouldAlert: true,
      reason: "Initial CRITICAL state detected",
    };
  }

  // State Transition: NORMAL or WARNING -> CRITICAL
  if (previousState.lastStatus !== "CRITICAL" && previousState.lastStatus !== "HIGH_RISK") {
    return {
      shouldAlert: true,
      reason: `Escalated from ${previousState.lastStatus} to ${currentStatus}`,
    };
  }

  // Node remains CRITICAL: check cooldown
  const now = Date.now();
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const elapsedMs = now - previousState.lastAlertSentAt;

  if (elapsedMs >= cooldownMs) {
    return {
      shouldAlert: true,
      reason: `Cooldown expired (${Math.round(elapsedMs / 60000)}m >= ${cooldownMinutes}m)`,
    };
  }

  return {
    shouldAlert: false,
    reason: `In cooldown (${Math.round((cooldownMs - elapsedMs) / 1000)}s remaining)`,
  };
}

/**
 * High-level orchestration for assessing risk and conditionally dispatching SMS.
 * Designed to be completely resilient: never throws or fails the parent ingestion flow.
 */
export async function processRiskAlert(
  supabase: SupabaseClient | null,
  risk: EvaluatedRisk,
  envOverride?: Record<string, string | undefined>
): Promise<SmsResult> {
  const getEnv = (key: string) =>
    envOverride?.[key] ??
    (typeof Deno !== "undefined" ? Deno.env.get(key) : undefined);

  const alertsEnabled =
    (getEnv("SMS_ALERTS_ENABLED") ?? "true").toLowerCase() !== "false";
  const rawApiKey = getEnv("FAST2SMS_API_KEY");
  const rawPhone = getEnv("ALERT_PHONE_NUMBER");
  const cooldownMinutes = Number(
    getEnv("ALERT_COOLDOWN_MINUTES") ?? DEFAULT_COOLDOWN_MINUTES
  );

  const nodeId = risk.node_id;
  const currentStatus = risk.status;
  const isCritical =
    currentStatus === "CRITICAL" || (currentStatus as string) === "HIGH_RISK";

  // 1. Fetch previous alert state (try DB, fallback to memory)
  let prevState: NodeAlertState | null = memoryState.get(nodeId) ?? null;

  if (supabase) {
    try {
      const { data } = await supabase
        .from("node_alert_states")
        .select("last_status, last_alert_sent_at, last_risk_score")
        .eq("node_id", nodeId)
        .maybeSingle();

      if (data) {
        prevState = {
          lastStatus: data.last_status,
          lastAlertSentAt: data.last_alert_sent_at
            ? new Date(data.last_alert_sent_at).getTime()
            : 0,
          lastRiskScore: data.last_risk_score ?? 0,
        };
      }
    } catch {
      // Ignore DB table lookup error, rely on memory fallback
    }
  }

  // 2. Determine eligibility
  const { shouldAlert, reason } = checkAlertEligibility(
    nodeId,
    currentStatus,
    isNaN(cooldownMinutes) ? DEFAULT_COOLDOWN_MINUTES : cooldownMinutes,
    prevState
  );

  // If node is NORMAL or WARNING, simply record the status transition
  if (!isCritical) {
    const updatedState: NodeAlertState = {
      lastStatus: currentStatus,
      lastAlertSentAt: prevState?.lastAlertSentAt ?? 0,
      lastRiskScore: risk.risk_score,
    };
    memoryState.set(nodeId, updatedState);

    if (supabase) {
      void supabase
        .from("node_alert_states")
        .upsert({
          node_id: nodeId,
          last_status: currentStatus,
          last_risk_score: risk.risk_score,
          updated_at: new Date().toISOString(),
        })
        .catch(() => {});
    }

    return {
      attempted: false,
      success: true,
      status: "SKIPPED_NORMAL_OR_WARNING",
    };
  }

  // If node is CRITICAL but in cooldown
  if (!shouldAlert) {
    return {
      attempted: false,
      success: true,
      status: "SKIPPED_COOLDOWN",
      error: reason,
    };
  }

  // If alerts are disabled via configuration
  if (!alertsEnabled) {
    console.log(
      `[SMS] Alerts disabled via SMS_ALERTS_ENABLED=false for node ${nodeId} (${currentStatus}).`
    );
    return {
      attempted: false,
      success: true,
      status: "SKIPPED_DISABLED",
      error: "SMS_ALERTS_ENABLED is false",
    };
  }

  // Validate phone number
  const normalizedPhone = normalizePhoneNumber(rawPhone);
  if (!normalizedPhone) {
    const errorMsg = `Invalid or missing ALERT_PHONE_NUMBER configuration: "${rawPhone ?? ""}"`;
    console.warn(`[SMS] ${errorMsg}`);
    return {
      attempted: false,
      success: false,
      status: "SKIPPED_INVALID_CONFIG",
      error: errorMsg,
    };
  }

  // Validate API key
  if (!rawApiKey || rawApiKey.trim() === "") {
    const errorMsg = "FAST2SMS_API_KEY is missing from environment secrets.";
    console.warn(`[SMS] ${errorMsg}`);
    return {
      attempted: false,
      success: false,
      status: "SKIPPED_INVALID_CONFIG",
      error: errorMsg,
    };
  }

  // 3. Build message and send SMS
  const message = buildAlertMessage(risk);
  console.log(
    `[SMS] Dispatching alert for node ${nodeId} (Status: ${currentStatus}, Score: ${risk.risk_score}) to ${normalizedPhone.slice(0, 3)}***${normalizedPhone.slice(-3)}`
  );

  const sendResult = await sendFast2SMS(
    rawApiKey.trim(),
    normalizedPhone,
    message
  );

  const now = Date.now();
  const alertStatus = sendResult.success
    ? "SMS_REQUEST_ACCEPTED"
    : "SMS_ALERT_FAILED";

  // 4. Update node alert state (on success or attempt)
  const newState: NodeAlertState = {
    lastStatus: currentStatus,
    lastAlertSentAt: sendResult.success ? now : prevState?.lastAlertSentAt ?? 0,
    lastRiskScore: risk.risk_score,
  };
  memoryState.set(nodeId, newState);

  if (supabase) {
    void supabase
      .from("node_alert_states")
      .upsert({
        node_id: nodeId,
        last_status: currentStatus,
        last_alert_sent_at: sendResult.success
          ? new Date(now).toISOString()
          : prevState?.lastAlertSentAt
          ? new Date(prevState.lastAlertSentAt).toISOString()
          : null,
        last_risk_score: risk.risk_score,
        updated_at: new Date().toISOString(),
      })
      .catch(() => {});

    // Record in audit log
    void supabase
      .from("alert_logs")
      .insert({
        node_id: nodeId,
        risk_level: currentStatus,
        risk_score: risk.risk_score,
        message,
        phone_number: normalizedPhone,
        sms_status: alertStatus,
        request_id: sendResult.requestId ?? null,
        error_detail: sendResult.error ?? null,
      })
      .catch(() => {});
  }

  if (sendResult.success) {
    console.log(
      `[SMS] SMS_REQUEST_ACCEPTED for node ${nodeId}. Request ID: ${sendResult.requestId ?? "N/A"}`
    );
  } else {
    console.error(
      `[SMS] SMS_ALERT_FAILED for node ${nodeId}: ${sendResult.error}`
    );
  }

  return {
    attempted: true,
    success: sendResult.success,
    status: alertStatus,
    requestId: sendResult.requestId,
    error: sendResult.error,
    recipient: normalizedPhone,
    message,
  };
}
