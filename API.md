# Bhoomi-NETr — Sensor Ingestion API Reference

## Live Endpoint
```http
POST https://bnnrikqlhvcqpuqsujsf.supabase.co/functions/v1/sensor-data
```

## Required Headers
Every request to the Edge Function must include the Supabase `anon` key to pass the API gateway.

```http
Content-Type: application/json
Authorization: Bearer <SUPABASE_ANON_KEY>
apikey: <SUPABASE_ANON_KEY>
```
> **Note:** Do not hardcode the anon key into frontend code unless restricted by RLS. Hardware (ESP32) needs this key flashed to its SPIFFS/EEPROM or compiled via compiler defines. For local development, find this key in the `.env` file under `SUPABASE_ANON_KEY`.

## Request Body Schema (JSON)

Strict adherence to the Phase 1 Data Contract is required.

| Field | Type | Required | Notes |
|---|---|---|---|
| `node_id` | String | **Yes** | Must be non-empty (e.g. `"NODE_01"`) |
| `timestamp` | String | No | ISO 8601 format. If missing, the server defaults to hardware `now()`. |
| `tilt_x` | Number | **Yes** | Must be a true JSON number, not a string |
| `tilt_y` | Number | **Yes** | Must be a true JSON number, not a string |
| `vibration`| Number | **Yes** | Must be a true JSON number, not a string |
| `distance` | Number | **Yes** | Must be a true JSON number, not a string |

---

## Example 1: Valid Request (201 Created)

**cURL:**
```bash
curl -X POST https://bnnrikqlhvcqpuqsujsf.supabase.co/functions/v1/sensor-data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -d '{"node_id":"NODE_01","timestamp":"2026-09-05T12:30:00Z","tilt_x":7.2,"tilt_y":3.8,"vibration":0.34,"distance":18.4}'
```

**Response (201 Created):**
The response returns the exact row inserted into Supabase, including the auto-generated `id` and `created_at`.
```json
{
  "id": 8,
  "node_id": "NODE_01",
  "timestamp": "2026-09-05T12:30:00+00:00",
  "tilt_x": 7.2,
  "tilt_y": 3.8,
  "vibration": 0.34,
  "distance": 18.4,
  "created_at": "2026-09-05T08:24:41.845+00:00"
}
```

---

## Error Responses

The API uses strict validation to prevent bad data from reaching the database.

### 400 Bad Request (Validation Failed)
If a field is missing, the wrong type, or empty, the API returns a structured error mapping out exactly what failed.

**Example (Missing `tilt_x` and `node_id` sent as empty string):**
```json
{
  "error": "Validation failed",
  "fields": [
    {
      "field": "node_id",
      "reason": "must be a non-empty string"
    },
    {
      "field": "tilt_x",
      "reason": "required but missing"
    }
  ],
  "hint": "All of tilt_x, tilt_y, vibration, distance must be JSON numbers (not strings). node_id must be a non-empty string."
}
```

### 405 Method Not Allowed
Occurs if you send a `GET`, `PUT`, or `DELETE` request.
```json
{
  "error": "Method not allowed. This endpoint only accepts POST requests."
}
```

### 500 Internal Server Error
Occurs if the Supabase database insert fails (e.g., database is paused).

---

## Data Access & Row Level Security (RLS)

- **Direct Table Queries:** Data analysts and dashboard developers can query the `sensor_readings` table directly using standard Supabase client libraries (JS, Python) via `supabase.from('sensor_readings').select('*')`.
- **RLS is OFF:** Row Level Security is explicitly disabled for Phase 1. This means you only need the `anon` key from `.env` to read all rows in the database.
- **WARNING:** Do not expose the `anon` key in public-facing client applications until Phase 2, when we implement RLS policies restricting write/delete access.

---

## Running the Hardware Simulator

To help frontend and analysis teams build against continuous live data, a Node.js simulator is included to emulate real, multi-node sensor drift.

**Prerequisites:**
You need `.env` in your project root containing `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

**Available Commands:**
```bash
# 1. Normal mode (Default)
# Simulates NODE_01, NODE_02, and NODE_03 simultaneously.
# Values drift slightly around normal baselines (Tilt ~4°, Vib ~0.1g, Dist ~20cm).
npm run simulate

# 2. Critical Threshold Mode (All sensors danger)
# Ramps tilt to >25°, vibration to >1.5g, and distance drops sharply.
# Useful for testing dashboard crash/alert triggers.
npm run simulate:critical

# 3. Targeted Failures (Specific sensors)
npm run simulate:tilt       # Ramps ONLY tilt toward 30°
npm run simulate:vibration  # Ramps ONLY vibration toward 2g
```

To limit simulation to a single node, you can run the simulator directly:
```bash
node simulator.js --scenario=critical --node=NODE_01
```

All simulated readings are written live to the Supabase database.
