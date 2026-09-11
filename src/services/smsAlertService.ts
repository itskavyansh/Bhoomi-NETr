// =============================================================================
// Bhoomi-NETr | SMS Alert Service (Production Fast2SMS Dev API Client)
// Quick SMS Route ("q") with state transition deduplication & cooldown.
// =============================================================================

import type { SensorReading } from "../types/sensor";

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

// In-memory alert state storage
export const alertStateStore = new Map<string, NodeAlertState>();

/**
 * Normalizes and validates an Indian mobile number.
 * Formats supported: "+919876543210", "919876543210", "+91 98765-43210", "09876543210", "9876543210".
 * Returns clean 10-digit number or null if invalid.
 */
export function normalizePhoneNumber(rawNumber?: string | null): string | null {
  if (!rawNumber || typeof rawNumber !== "string") {
    return null;
  }

  // Remove non-digits
  let digits = rawNumber.replace(/\D/g, "");

  // Strip international prefix +91 / 91
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  // Strip leading 0
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Indian mobile numbers must be 10 digits starting with 6, 7, 8, 9
  if (/^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  return null;
}

/**
 * Formats a concise, informative emergency SMS alert.
 */
export function buildAlertMessage(
  nodeId: string,
  status: string,
  riskScore: number,
  warnings: string[] = []
): string {
  const warningsFormatted =
    warnings.length > 0
      ? warnings.map((w) => w.replace(/_/g, " ")).join(", ")
      : "Multiple sensor thresholds breached";

  return `Bhoomi-NETr ALERT: Node ${nodeId} is at ${status} risk. Risk Score: ${riskScore}. (${warningsFormatted}). Immediate inspection required.`;
}

/**
 * Executes the Fast2SMS Quick SMS API request.
 * Strictly avoids leaking secrets or authorization headers in logs or output.
 */
export async function sendFast2SMS(
  apiKey: string,
  phoneNumber: string,
  message: string,
  fetchFn = fetch
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

    const response = await fetchFn(FAST2SMS_ENDPOINT, {
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
      responseData = (await response.json()) as Record<string, unknown>;
    } catch {
      return {
        success: false,
        error: `Fast2SMS HTTP ${response.status} (non-JSON response)`,
      };
    }

    if (response.ok && responseData.return === true) {
      const requestId = Array.isArray(responseData.request_id)
        ? String(responseData.request_id[0])
        : typeof responseData.request_id === "string"
        ? responseData.request_id
        : undefined;

      return {
        success: true,
        requestId,
      };
    }

    const apiMessage = Array.isArray(responseData.message)
      ? responseData.message.join(", ")
      : typeof responseData.message === "string"
      ? responseData.message
      : `HTTP ${response.status} error`;

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
 * Checks state-transition and cooldown eligibility.
 */
export function checkAlertEligibility(
  currentStatus: string,
  cooldownMinutes: number,
  previousState?: NodeAlertState | null,
  currentTimeMs: number = Date.now()
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

  // Node remains in CRITICAL: check cooldown
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const elapsedMs = currentTimeMs - previousState.lastAlertSentAt;

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

export interface ProcessAlertOptions {
  apiKey?: string;
  phoneNumber?: string;
  cooldownMinutes?: number;
  enabled?: boolean;
  fetchFn?: typeof fetch;
  currentTimeMs?: number;
}

/**
 * Core alert processing function for a evaluated sensor reading.
 */
export async function processRiskAlert(
  reading: Pick<SensorReading, "node_id" | "status" | "risk_score" | "warnings">,
  options: ProcessAlertOptions = {}
): Promise<SmsResult> {
  const enabled = options.enabled ?? true;
  const rawApiKey = options.apiKey;
  const rawPhone = options.phoneNumber;
  const cooldownMinutes = options.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.currentTimeMs ?? Date.now();

  const nodeId = reading.node_id;
  const currentStatus = reading.status;
  const isCritical =
    currentStatus === "CRITICAL" || (currentStatus as string) === "HIGH_RISK";

  const prevState = alertStateStore.get(nodeId) ?? null;

  const { shouldAlert, reason } = checkAlertEligibility(
    currentStatus,
    cooldownMinutes,
    prevState,
    now
  );

  // If node is NORMAL or WARNING, simply update state and return
  if (!isCritical) {
    alertStateStore.set(nodeId, {
      lastStatus: currentStatus,
      lastAlertSentAt: prevState?.lastAlertSentAt ?? 0,
      lastRiskScore: reading.risk_score,
    });

    return {
      attempted: false,
      success: true,
      status: "SKIPPED_NORMAL_OR_WARNING",
    };
  }

  // If CRITICAL but in cooldown
  if (!shouldAlert) {
    return {
      attempted: false,
      success: true,
      status: "SKIPPED_COOLDOWN",
      error: reason,
    };
  }

  // If SMS alerts are explicitly disabled
  if (!enabled) {
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
    const errorMsg = `Invalid or missing ALERT_PHONE_NUMBER: "${rawPhone ?? ""}"`;
    return {
      attempted: false,
      success: false,
      status: "SKIPPED_INVALID_CONFIG",
      error: errorMsg,
    };
  }

  // Validate API key
  if (!rawApiKey || rawApiKey.trim() === "") {
    const errorMsg = "FAST2SMS_API_KEY is missing from configuration.";
    return {
      attempted: false,
      success: false,
      status: "SKIPPED_INVALID_CONFIG",
      error: errorMsg,
    };
  }

  // Dispatch SMS
  const message = buildAlertMessage(
    nodeId,
    currentStatus,
    reading.risk_score,
    reading.warnings
  );

  const sendResult = await sendFast2SMS(
    rawApiKey.trim(),
    normalizedPhone,
    message,
    fetchFn
  );

  const alertStatus = sendResult.success
    ? "SMS_REQUEST_ACCEPTED"
    : "SMS_ALERT_FAILED";

  // Update node state
  alertStateStore.set(nodeId, {
    lastStatus: currentStatus,
    lastAlertSentAt: sendResult.success ? now : prevState?.lastAlertSentAt ?? 0,
    lastRiskScore: reading.risk_score,
  });

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
