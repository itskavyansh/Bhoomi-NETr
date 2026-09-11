// =============================================================================
// Bhoomi-NETr | SMS Alert System Test Suite
// Executes all 11 required test cases for the Fast2SMS alert integration.
// Run: node tests/test_sms.js
// =============================================================================

import {
  normalizePhoneNumber,
  buildAlertMessage,
  sendFast2SMS,
  processRiskAlert,
  alertStateStore,
  FAST2SMS_ENDPOINT,
} from "../src/services/smsAlertService.ts";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${message}`);
  }
}

async function runTests() {
  console.log("============================================================");
  console.log("  Bhoomi-NETr SMS Alert System — Comprehensive Test Suite   ");
  console.log("============================================================\n");

  const DUMMY_KEY = "test_fast2sms_secret_key_abcdef123456";
  const VALID_PHONE = "+91 98765 43210";
  const NORMALIZED_PHONE = "9876543210";

  // Helper mock fetch creator
  function createMockFetch(responseConfig) {
    return async function mockFetch(url, init) {
      if (url !== FAST2SMS_ENDPOINT) {
        throw new Error(`Unexpected endpoint: ${url}`);
      }

      if (responseConfig.networkError) {
        throw new Error("Simulated network timeout/disconnect");
      }

      const body = JSON.parse(init.body);
      const auth = init.headers.Authorization;

      if (responseConfig.authFailure || !auth || auth === "invalid_key") {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            return: false,
            status_code: 401,
            message: "Invalid Authorization Key",
          }),
        };
      }

      if (responseConfig.apiError) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            return: false,
            status_code: 400,
            message: responseConfig.apiError,
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          return: true,
          request_id: "req_test_847291038",
          message: ["SMS sent successfully."],
        }),
      };
    };
  }

  // ---------------------------------------------------------------------------
  // TEST 1: NORMAL -> no SMS
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: NORMAL status -> no SMS sent ---");
  alertStateStore.clear();
  let callCount = 0;
  const mockFetchT1 = async () => {
    callCount++;
    return { ok: true, json: async () => ({ return: true }) };
  };

  const resT1 = await processRiskAlert(
    { node_id: "NODE_01", status: "NORMAL", risk_score: 15, warnings: [] },
    { apiKey: DUMMY_KEY, phoneNumber: VALID_PHONE, fetchFn: mockFetchT1 }
  );

  assert(resT1.attempted === false, "SMS was not attempted");
  assert(resT1.status === "SKIPPED_NORMAL_OR_WARNING", "Status correctly marked SKIPPED_NORMAL_OR_WARNING");
  assert(callCount === 0, "Fast2SMS API was not called");

  // ---------------------------------------------------------------------------
  // TEST 2: WARNING -> no SMS
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: WARNING status -> no SMS sent ---");
  alertStateStore.clear();
  callCount = 0;
  const mockFetchT2 = async () => {
    callCount++;
    return { ok: true, json: async () => ({ return: true }) };
  };

  const resT2 = await processRiskAlert(
    { node_id: "NODE_01", status: "WARNING", risk_score: 55, warnings: ["HIGH_VIBRATION"] },
    { apiKey: DUMMY_KEY, phoneNumber: VALID_PHONE, fetchFn: mockFetchT2 }
  );

  assert(resT2.attempted === false, "SMS was not attempted");
  assert(resT2.status === "SKIPPED_NORMAL_OR_WARNING", "Status correctly marked SKIPPED_NORMAL_OR_WARNING");
  assert(callCount === 0, "Fast2SMS API was not called");

  // ---------------------------------------------------------------------------
  // TEST 3: CRITICAL -> SMS attempted
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: CRITICAL status -> SMS attempted ---");
  alertStateStore.clear();
  callCount = 0;
  let sentPayload = null;
  const mockFetchT3 = async (url, init) => {
    callCount++;
    sentPayload = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ return: true, request_id: "req_12345", message: ["SMS sent successfully."] }),
    };
  };

  const resT3 = await processRiskAlert(
    {
      node_id: "NODE_01",
      status: "CRITICAL",
      risk_score: 92,
      warnings: ["EXCESSIVE_TILT", "HIGH_VIBRATION"],
    },
    { apiKey: DUMMY_KEY, phoneNumber: VALID_PHONE, fetchFn: mockFetchT3 }
  );

  assert(resT3.attempted === true, "SMS was attempted");
  assert(resT3.success === true, "SMS request succeeded");
  assert(resT3.status === "SMS_REQUEST_ACCEPTED", "Status is SMS_REQUEST_ACCEPTED");
  assert(callCount === 1, "Fast2SMS API was called exactly once");
  assert(sentPayload?.route === "q", "Payload uses route 'q' for Quick SMS");
  assert(sentPayload?.numbers === NORMALIZED_PHONE, "Recipient number normalized to 10 digits");

  // ---------------------------------------------------------------------------
  // TEST 4: HIGH_RISK alias -> SMS attempted
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: HIGH_RISK status -> SMS attempted ---");
  alertStateStore.clear();
  callCount = 0;
  const mockFetchT4 = createMockFetch({});

  const resT4 = await processRiskAlert(
    {
      node_id: "NODE_02",
      status: "HIGH_RISK",
      risk_score: 85,
      warnings: ["ABNORMAL_DISPLACEMENT", "EXCESSIVE_TILT"],
    },
    { apiKey: DUMMY_KEY, phoneNumber: VALID_PHONE, fetchFn: mockFetchT4 }
  );

  assert(resT4.attempted === true, "SMS was attempted for HIGH_RISK");
  assert(resT4.status === "SMS_REQUEST_ACCEPTED", "Status is SMS_REQUEST_ACCEPTED");

  // ---------------------------------------------------------------------------
  // TEST 5: CRITICAL repeated 10 times -> only ONE SMS (deduplication)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: CRITICAL repeated 10 times -> only ONE SMS ---");
  alertStateStore.clear();
  callCount = 0;
  const mockFetchT5 = async () => {
    callCount++;
    return {
      ok: true,
      status: 200,
      json: async () => ({ return: true, request_id: "req_dup_test", message: ["SMS sent."] }),
    };
  };

  const readingCritical = {
    node_id: "NODE_01",
    status: "CRITICAL",
    risk_score: 95,
    warnings: ["EXCESSIVE_TILT", "HIGH_VIBRATION"],
  };

  // Dispatch 10 consecutive readings in the same minute
  for (let i = 0; i < 10; i++) {
    await processRiskAlert(readingCritical, {
      apiKey: DUMMY_KEY,
      phoneNumber: VALID_PHONE,
      fetchFn: mockFetchT5,
      cooldownMinutes: 15,
      currentTimeMs: 1000000 + i * 1000, // 1 second intervals
    });
  }

  assert(callCount === 1, `Fast2SMS API was called only 1 time across 10 repeated readings (actual: ${callCount})`);

  // ---------------------------------------------------------------------------
  // TEST 6: CRITICAL -> NORMAL -> CRITICAL -> TWO SMS alerts (state transition)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: CRITICAL -> NORMAL -> CRITICAL -> TWO SMS alerts ---");
  alertStateStore.clear();
  callCount = 0;
  const mockFetchT6 = async () => {
    callCount++;
    return {
      ok: true,
      status: 200,
      json: async () => ({ return: true, request_id: `req_${callCount}`, message: ["SMS sent."] }),
    };
  };

  // Step 1: Initial transition to CRITICAL -> 1st SMS
  await processRiskAlert(
    { node_id: "NODE_01", status: "CRITICAL", risk_score: 90, warnings: ["EXCESSIVE_TILT", "HIGH_VIBRATION"] },
    { apiKey: DUMMY_KEY, phoneNumber: VALID_PHONE, fetchFn: mockFetchT6, currentTimeMs: 1000 }
  );

  // Step 2: Node resolves to NORMAL -> 0 SMS
  await processRiskAlert(
    { node_id: "NODE_01", status: "NORMAL", risk_score: 10, warnings: [] },
    { apiKey: DUMMY_KEY, phoneNumber: VALID_PHONE, fetchFn: mockFetchT6, currentTimeMs: 2000 }
  );

  // Step 3: Node escalates back to CRITICAL -> 2nd SMS
  await processRiskAlert(
    { node_id: "NODE_01", status: "CRITICAL", risk_score: 94, warnings: ["ABNORMAL_DISPLACEMENT", "HIGH_VIBRATION"] },
    { apiKey: DUMMY_KEY, phoneNumber: VALID_PHONE, fetchFn: mockFetchT6, currentTimeMs: 3000 }
  );

  assert(callCount === 2, `State transition triggered exactly 2 SMS alerts (actual: ${callCount})`);

  // ---------------------------------------------------------------------------
  // TEST 7: Fast2SMS API failure -> risk pipeline still succeeds without crashing
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7: Fast2SMS API failure -> pipeline does not crash ---");
  alertStateStore.clear();
  const failingFetch = createMockFetch({ networkError: true });

  let threwException = false;
  let resT7 = null;
  try {
    resT7 = await processRiskAlert(
      { node_id: "NODE_01", status: "CRITICAL", risk_score: 91, warnings: ["EXCESSIVE_TILT", "HIGH_VIBRATION"] },
      { apiKey: DUMMY_KEY, phoneNumber: VALID_PHONE, fetchFn: failingFetch }
    );
  } catch {
    threwException = true;
  }

  assert(threwException === false, "processRiskAlert did not throw an exception");
  assert(resT7 !== null && resT7.success === false, "Gracefully captured API failure in result");
  assert(resT7?.status === "SMS_ALERT_FAILED", "Status correctly marked SMS_ALERT_FAILED");

  // ---------------------------------------------------------------------------
  // TEST 8: Missing API key -> configuration error, no crash
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 8: Missing API key -> configuration error, no crash ---");
  alertStateStore.clear();
  const resT8 = await processRiskAlert(
    { node_id: "NODE_01", status: "CRITICAL", risk_score: 88, warnings: ["EXCESSIVE_TILT", "HIGH_VIBRATION"] },
    { apiKey: "", phoneNumber: VALID_PHONE, fetchFn: createMockFetch({}) }
  );

  assert(resT8.attempted === false, "SMS was not attempted without API key");
  assert(resT8.status === "SKIPPED_INVALID_CONFIG", "Marked SKIPPED_INVALID_CONFIG");
  assert(resT8.error?.includes("FAST2SMS_API_KEY"), "Clear configuration error message reported");

  // ---------------------------------------------------------------------------
  // TEST 9: Invalid phone number -> SMS not attempted
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 9: Invalid phone number -> SMS not attempted ---");
  alertStateStore.clear();
  const invalidPhones = ["12345", "abcdefghij", "+1-555-0199", "1234567890123"];

  for (const badPhone of invalidPhones) {
    const resT9 = await processRiskAlert(
      { node_id: "NODE_01", status: "CRITICAL", risk_score: 90, warnings: ["EXCESSIVE_TILT", "HIGH_VIBRATION"] },
      { apiKey: DUMMY_KEY, phoneNumber: badPhone, fetchFn: createMockFetch({}) }
    );
    assert(resT9.attempted === false, `SMS not attempted for invalid number: ${badPhone}`);
    assert(resT9.status === "SKIPPED_INVALID_CONFIG", "Marked SKIPPED_INVALID_CONFIG");
  }

  // ---------------------------------------------------------------------------
  // TEST 10: API returns an error -> logged correctly
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 10: API returns an error -> logged correctly ---");
  alertStateStore.clear();
  const apiErrorFetch = createMockFetch({ apiError: "Insufficient Account Balance" });

  const resT10 = await processRiskAlert(
    { node_id: "NODE_01", status: "CRITICAL", risk_score: 92, warnings: ["EXCESSIVE_TILT", "HIGH_VIBRATION"] },
    { apiKey: DUMMY_KEY, phoneNumber: VALID_PHONE, fetchFn: apiErrorFetch }
  );

  assert(resT10.attempted === true, "SMS call was attempted");
  assert(resT10.success === false, "Result marked as failure");
  assert(resT10.error?.includes("Insufficient Account Balance"), "Preserved safe diagnostic API error description");

  // ---------------------------------------------------------------------------
  // TEST 11: API key must NEVER appear in logs or output
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 11: Security check: API key never appears in outputs ---");
  const secretKey = "SECRET_SUPER_CONFIDENTIAL_KEY_999";
  let capturedLogOutput = "";

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  try {
    console.log = (...args) => { capturedLogOutput += " " + args.join(" "); originalLog(...args); };
    console.warn = (...args) => { capturedLogOutput += " " + args.join(" "); originalWarn(...args); };
    console.error = (...args) => { capturedLogOutput += " " + args.join(" "); originalError(...args); };

    // Run multiple actions with the secret key
    await sendFast2SMS(secretKey, NORMALIZED_PHONE, "Test Alert", createMockFetch({ authFailure: true }));
    await sendFast2SMS(secretKey, NORMALIZED_PHONE, "Test Alert", createMockFetch({ apiError: "General Error" }));
    await sendFast2SMS(secretKey, NORMALIZED_PHONE, "Test Alert", createMockFetch({ networkError: true }));
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }

  const keyLeaked = capturedLogOutput.includes(secretKey);
  assert(keyLeaked === false, "Secret API key NEVER appeared in logs or console output");

  // ---------------------------------------------------------------------------
  // Additional Unit Checks: Phone Normalization & Message Formatting
  // ---------------------------------------------------------------------------
  console.log("\n--- Additional Unit Checks ---");
  assert(normalizePhoneNumber("+91 98765 43210") === "9876543210", "+91 with spaces normalized");
  assert(normalizePhoneNumber("919876543210") === "9876543210", "91 prefix normalized");
  assert(normalizePhoneNumber("09876543210") === "9876543210", "Leading 0 normalized");
  assert(normalizePhoneNumber("98765-43210") === "9876543210", "Hyphenated number normalized");
  assert(normalizePhoneNumber("12345") === null, "Short number rejected");
  assert(normalizePhoneNumber("5987654321") === null, "Invalid prefix rejected");

  const sampleMsg = buildAlertMessage("NODE_01", "CRITICAL", 92, ["EXCESSIVE_TILT", "HIGH_VIBRATION"]);
  assert(sampleMsg.includes("NODE_01"), "Message contains node ID");
  assert(sampleMsg.includes("CRITICAL"), "Message contains risk status");
  assert(sampleMsg.includes("92"), "Message contains risk score");
  assert(sampleMsg.includes("EXCESSIVE TILT"), "Message contains formatted warnings");

  console.log("\n============================================================");
  console.log(`Results: ${passedTests} passed, ${failedTests} failed, out of ${totalTests} checks.`);
  console.log("============================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
