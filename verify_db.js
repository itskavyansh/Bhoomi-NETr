const BASE = "https://bnnrikqlhvcqpuqsujsf.supabase.co/rest/v1";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubnJpa3FsaHZjcXB1cXN1anNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU4Nzg5MCwiZXhwIjoyMTA0MTYzODkwfQ.3ffdNWfb2g0GmC1UqEE_Vma-nLsgXSjXkWJPAqPAM7M";

const H = {
  "Content-Type": "application/json",
  "apikey": KEY,
  "Authorization": "Bearer " + KEY,
  "Prefer": "return=representation"
};

async function run() {
  // STEP 1 — check table exists
  let r = await fetch(BASE + "/sensor_readings?limit=0", { headers: H });
  if (r.status === 200) {
    console.log("STEP1: TABLE_EXISTS (HTTP 200)");
  } else {
    const t = await r.text();
    console.log("STEP1: FAIL HTTP=" + r.status + " body=" + t);
    process.exit(1);
  }

  // STEP 2 — insert data-contract test row
  const payload = {
    node_id: "NODE_01",
    timestamp: new Date().toISOString(),
    tilt_x: 7.2,
    tilt_y: 3.8,
    vibration: 0.34,
    distance: 18.4
  };
  r = await fetch(BASE + "/sensor_readings", {
    method: "POST",
    headers: H,
    body: JSON.stringify(payload)
  });
  const ins = await r.json();
  const row = Array.isArray(ins) ? ins[0] : ins;
  if (r.status === 200 || r.status === 201) {
    console.log("STEP2: INSERT_OK HTTP=" + r.status);
    console.log("  id         = " + row.id);
    console.log("  node_id    = " + row.node_id);
    console.log("  timestamp  = " + row.timestamp);
    console.log("  tilt_x     = " + row.tilt_x);
    console.log("  tilt_y     = " + row.tilt_y);
    console.log("  vibration  = " + row.vibration);
    console.log("  distance   = " + row.distance);
    console.log("  created_at = " + row.created_at);
  } else {
    console.log("STEP2: INSERT_FAIL HTTP=" + r.status + " body=" + JSON.stringify(ins));
    process.exit(1);
  }

  // STEP 3 — read back latest for NODE_01
  r = await fetch(BASE + "/sensor_readings?node_id=eq.NODE_01&order=timestamp.desc&limit=1", { headers: H });
  const rows = await r.json();
  if (r.status === 200 && rows.length > 0) {
    const rb = rows[0];
    console.log("STEP3: READ_BACK_OK");
    console.log("  id         = " + rb.id);
    console.log("  node_id    = " + rb.node_id);
    console.log("  tilt_x     = " + rb.tilt_x + "  (expected 7.2)");
    console.log("  tilt_y     = " + rb.tilt_y + "  (expected 3.8)");
    console.log("  vibration  = " + rb.vibration + "  (expected 0.34)");
    console.log("  distance   = " + rb.distance + "  (expected 18.4)");
  } else {
    console.log("STEP3: FAIL HTTP=" + r.status + " rows=" + JSON.stringify(rows));
    process.exit(1);
  }

  console.log("ALL CHECKS PASSED");
}

run().catch(function (e) { console.log("FATAL: " + e.message); });
