// =============================================================================
// Bhoomi-NETr  |  Edge Function Test Suite
// Tests the DEPLOYED function at: https://bnnrikqlhvcqpuqsujsf.supabase.co/functions/v1/sensor-data
//
// Run: node test_function.js
// Change BASE_URL to http://127.0.0.1:54321/functions/v1 for local testing.
// =============================================================================

// Toggle between local and deployed:
// const BASE_URL = "http://127.0.0.1:54321/functions/v1";  // local (supabase functions serve)
const BASE_URL = "https://bnnrikqlhvcqpuqsujsf.supabase.co/functions/v1";

// The anon key is enough to call the function (it handles auth internally)
// Hardware (ESP32) should use this same key in its Authorization header.
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubnJpa3FsaHZjcXB1cXN1anNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODc4OTAsImV4cCI6MjEwNDE2Mzg5MH0.sUK2HXu-_2u6AaEdNiyaVb9HXS_Or1pVB58rUReYGdI";

const HEADERS = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + ANON_KEY,
    "apikey": ANON_KEY,
};

async function post(label, payload) {
    console.log("\n--- " + label + " ---");
    console.log("Sending:", JSON.stringify(payload));
    try {
        const r = await fetch(BASE_URL + "/sensor-data", {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify(payload),
        });
        const body = await r.json();
        console.log("HTTP Status:", r.status, r.status === 201 ? "(PASS - expected 201)" : r.status === 400 ? "(PASS - expected 400)" : "(CHECK)");
        console.log("Response:", JSON.stringify(body, null, 2));
        return { status: r.status, body };
    } catch (e) {
        console.log("FETCH ERROR:", e.message);
    }
}

async function wrongMethod(label) {
    console.log("\n--- " + label + " ---");
    try {
        const r = await fetch(BASE_URL + "/sensor-data", { method: "GET", headers: HEADERS });
        const body = await r.json();
        console.log("HTTP Status:", r.status, r.status === 405 ? "(PASS - expected 405)" : "(FAIL)");
        console.log("Response:", JSON.stringify(body, null, 2));
    } catch (e) {
        console.log("FETCH ERROR:", e.message);
    }
}

async function main() {
    console.log("Target:", BASE_URL + "/sensor-data");
    console.log("=".repeat(60));

    // TEST 1: Valid payload — should return 201 + inserted row
    await post(
        "TEST 1: Valid payload (data-contract example)",
        {
            node_id: "NODE_01",
            timestamp: new Date().toISOString(),
            tilt_x: 7.2,
            tilt_y: 3.8,
            vibration: 0.34,
            distance: 18.4
        }
    );

    // TEST 2: Missing tilt_x — should return 400 with field error
    await post(
        "TEST 2: Missing tilt_x (expect 400)",
        {
            node_id: "NODE_01",
            timestamp: "2026-09-05T12:30:00Z",
            tilt_y: 3.8,
            vibration: 0.34,
            distance: 18.4
            // tilt_x intentionally omitted
        }
    );

    // TEST 3: Missing timestamp — should still return 201 (server defaults to now())
    await post(
        "TEST 3: Missing timestamp (expect 201 with server now())",
        {
            node_id: "NODE_02",
            tilt_x: 1.1,
            tilt_y: 2.2,
            vibration: 0.11,
            distance: 9.5
            // timestamp intentionally omitted
        }
    );

    // TEST 4: node_id is empty string — should return 400
    await post(
        "TEST 4: Empty node_id (expect 400)",
        {
            node_id: "",
            timestamp: "2026-09-05T12:30:00Z",
            tilt_x: 7.2,
            tilt_y: 3.8,
            vibration: 0.34,
            distance: 18.4
        }
    );

    // TEST 5: Numeric field passed as string (common ESP32 mistake) — should return 400
    await post(
        "TEST 5: tilt_x as string instead of number (expect 400)",
        {
            node_id: "NODE_01",
            timestamp: "2026-09-05T12:30:00Z",
            tilt_x: "7.2",   // string, not number
            tilt_y: 3.8,
            vibration: 0.34,
            distance: 18.4
        }
    );

    // TEST 6: Wrong HTTP method — should return 405
    await wrongMethod("TEST 6: GET request (expect 405)");

    console.log("\n" + "=".repeat(60));
    console.log("Test run complete. Check statuses above.");
}

main();
