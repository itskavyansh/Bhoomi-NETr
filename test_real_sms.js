// =============================================================================
// Bhoomi-NETr | Single Controlled Live Fast2SMS Test
// Dispatches a single test SMS using credentials configured in .env.
// Never exposes the API key in output.
// =============================================================================

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  normalizePhoneNumber,
  sendFast2SMS,
  buildAlertMessage,
} from "./src/services/smsAlertService.ts";

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
    // Rely on existing environment
  }
}
loadEnv();

async function runLiveTest() {
  console.log("============================================================");
  console.log("  Bhoomi-NETr — Live Fast2SMS Controlled Single Test        ");
  console.log("============================================================\n");

  const apiKey = process.env.FAST2SMS_API_KEY;
  const rawPhone = process.env.ALERT_PHONE_NUMBER;

  if (!apiKey || apiKey.trim() === "" || apiKey.includes("<")) {
    console.log("⚠️ FAST2SMS_API_KEY is not configured in .env.");
    console.log("   To perform a live test, add your actual Fast2SMS Dev API key to .env:");
    console.log("   FAST2SMS_API_KEY=your_actual_key_here");
    console.log("   ALERT_PHONE_NUMBER=your_10_digit_mobile_number\n");
    return;
  }

  const normalizedPhone = normalizePhoneNumber(rawPhone);
  if (!normalizedPhone) {
    console.log(`⚠️ ALERT_PHONE_NUMBER is invalid or missing in .env (got "${rawPhone}").`);
    console.log("   Provide a valid 10-digit Indian mobile number (e.g. 9876543210).\n");
    return;
  }

  console.log(`Target Phone: ${normalizedPhone.slice(0, 3)}***${normalizedPhone.slice(-3)}`);
  console.log("Endpoint    : https://www.fast2sms.com/dev/bulkV2");
  console.log("Route       : q (Quick SMS)");

  const testMessage = buildAlertMessage("NODE_01", "CRITICAL", 92, [
    "EXCESSIVE_TILT",
    "HIGH_VIBRATION",
  ]);
  console.log(`Message     : "${testMessage}"\n`);
  console.log("Sending single live request to Fast2SMS...");

  const result = await sendFast2SMS(apiKey.trim(), normalizedPhone, testMessage);

  if (result.success) {
    console.log("\n✅ FAST2SMS REQUEST ACCEPTED");
    console.log(`   Request ID : ${result.requestId ?? "N/A"}`);
    console.log("   The emergency alert was accepted by Fast2SMS for delivery.\n");
  } else {
    console.log("\n❌ FAST2SMS REQUEST FAILED");
    console.log(`   Error : ${result.error}\n`);
  }
}

runLiveTest().catch((err) => {
  console.error("Live test execution error:", err.message);
});
