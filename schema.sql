-- =============================================================================
-- Bhoomi-NETr  |  Mine Subsidence Monitoring System
-- Phase 1 Schema
-- Data Contract: node_id, timestamp, tilt_x, tilt_y, vibration, distance
-- Created: 2026-09-05
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: sensor_readings
-- Stores every raw reading pushed by a sensor node.
-- DO NOT add displacement, risk_score, status, warning_codes,
-- latitude, longitude, or battery until Phase 2 is agreed by the team.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sensor_readings (
    -- Primary key — auto-incrementing bigint (handles billions of rows safely)
    id          bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Which physical sensor node sent this reading (e.g. 'NODE_01')
    node_id     text          NOT NULL,

    -- The sensor's own timestamp for when the measurement was taken (ISO 8601 / UTC)
    -- Distinct from created_at: this comes from the device, not the server
    "timestamp" timestamptz   NOT NULL DEFAULT now(),

    -- Tilt angles in degrees (±axis)
    tilt_x      float8,
    tilt_y      float8,

    -- Vibration magnitude (units TBD — e.g. m/s² or g)
    vibration   float8,

    -- Distance reading in cm or mm (depends on sensor spec — document before Phase 2)
    distance        float8,

    -- Onboard hardware transducer diagnostic status ('ok' | 'fault')
    mpu6050_status  text,
    hc_sr04_status  text,

    -- Server-side insert timestamp — always set by Supabase, never overwritten
    -- Use this for auditing and lag detection (created_at vs timestamp diff)
    created_at      timestamptz   NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- INDEXES
-- Rationale: queries will almost always filter by node_id and order by
-- timestamp DESC to get "latest reading per node". Without these indexes,
-- every query becomes a full-table scan — unacceptable as data grows.
-- -----------------------------------------------------------------------------

-- Index 1: filter by node — supports WHERE node_id = 'NODE_01'
CREATE INDEX IF NOT EXISTS idx_sensor_readings_node_id
    ON public.sensor_readings (node_id);

-- Index 2: timestamp descending — supports ORDER BY timestamp DESC (latest first)
-- A DESC index is more efficient than a default ASC index for this access pattern
CREATE INDEX IF NOT EXISTS idx_sensor_readings_timestamp_desc
    ON public.sensor_readings ("timestamp" DESC);

-- Index 3: composite — supports the most common query pattern:
-- WHERE node_id = ? ORDER BY timestamp DESC LIMIT 1
CREATE INDEX IF NOT EXISTS idx_sensor_readings_node_ts
    ON public.sensor_readings (node_id, "timestamp" DESC);

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- Decision: DISABLED for Phase 1 prototype.
--
-- Reason: All access in Phase 1 goes through our own API / Edge Function using
-- the service_role key, which bypasses RLS regardless. Enabling RLS now without
-- policies would silently block all reads/writes from the anon key and create
-- confusing debugging sessions. We will enable RLS with explicit policies in
-- Phase 2 when direct client access (Person 3's dashboard) is introduced.
--
-- ACTION REQUIRED before any public/client-side exposure:
--   ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
--   -- then add appropriate policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.sensor_readings DISABLE ROW LEVEL SECURITY;

-- Enable Realtime for live dashboard streaming
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_readings;

-- -----------------------------------------------------------------------------
-- VERIFICATION QUERY (run this after creating the table to confirm structure)
-- -----------------------------------------------------------------------------
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'sensor_readings'
-- ORDER BY ordinal_position;

-- -----------------------------------------------------------------------------
-- TEST INSERT  (run manually in Supabase SQL Editor to confirm a row appears)
-- Node: NODE_01, as per team data contract example
-- -----------------------------------------------------------------------------
-- INSERT INTO public.sensor_readings (node_id, "timestamp", tilt_x, tilt_y, vibration, distance)
-- VALUES ('NODE_01', '2026-09-05T12:30:00Z', 7.2, 3.8, 0.34, 18.4);

-- SELECT * FROM public.sensor_readings ORDER BY "timestamp" DESC LIMIT 5;
