# Bhoomi-NETr — Mine Subsidence Monitoring System

Bhoomi-NETr is an end-to-end structural health and mine subsidence monitoring platform designed to detect ground movement, excessive tilt, and high vibration in underground mining environments. Built around a 3-node prototype architecture, physical sensor nodes collect telemetry on-site and push structured readings to a cloud-hosted Supabase PostgreSQL backend via an authenticated Edge Function. Telemetry is evaluated against subsidence threshold criteria to compute ground displacement, assign risk scores, and generate automated warnings, which are streamed in real time to an interactive monitoring dashboard.

---

## System Architecture

```text
       ┌──────────────────────┐
       │ PHYSICAL SENSOR NODE │
       │  (ESP32 + MPU6050 +  │
       │       HC-SR04)       │
       └──────────┬───────────┘
                  │  Wi-Fi / HTTP POST
                  ▼
       ┌──────────────────────┐       ┌──────────────────────┐
       │   SOFTWARE SIMULATOR │──────▶│   SUPABASE BACKEND   │
       │    (simulator.js)    │       │ (Edge Functions + DB)│
       └──────────────────────┘       └──────────┬───────────┘
                                                 │
                                                 │ PostgreSQL Changes
                                                 │ Realtime WebSocket
                                                 ▼
       ┌──────────────────────┐       ┌──────────────────────┐
       │   ANALYSIS ENGINE    │◀─────▶│  MONITORING CONSOLE  │
       │ (Risk, Displacement, │       │  (React 19 + Vite +  │
       │     Thresholds)      │       │       Recharts)      │
       └──────────────────────┘       └──────────────────────┘
```

---

## Prerequisites

Ensure the following environments are installed on your workstation:
* **Node.js**: `>= 18.0.0` (LTS recommended, verified on Node 22)
* **Python**: `>= 3.10` (for analysis engine & test suite)
* **Supabase Account**: A Supabase project with PostgreSQL and Edge Functions enabled

---

## Setup & Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/itskavyansh/Bhoomi-NETr.git
   cd Bhoomi-NETr
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
   Ensure `.env` contains both standard and Vite-prefixed keys:
   ```env
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

3. **Install frontend & simulator dependencies**:
   ```bash
   npm install
   ```

4. **Install Python analysis engine dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

---

## Running with Simulated Data (No Hardware Needed)

The simulator generates synthetic sensor telemetry conforming to the Phase 1 Data Contract and transmits it to the live Edge Function.

### 1. Launch the Dashboard
In one terminal, start the local development server:
```bash
npm run dev
```
Open your browser and navigate to: **`http://localhost:5173`**

### 2. Run the Telemetry Simulator
In a second terminal, execute the simulator in your desired scenario mode:

* **Normal Baseline (Multi-node drift, 1s interval)**:
  ```bash
  node simulator.js
  ```
* **Excessive Tilt Scenario**:
  ```bash
  node simulator.js --scenario=excessive_tilt --node=NODE_01
  ```
* **High Vibration Scenario**:
  ```bash
  node simulator.js --scenario=high_vibration --node=NODE_01
  ```
* **Critical Subsidence Event (Ramps Tilt, Vibration & Displacement)**:
  ```bash
  node simulator.js --scenario=critical --node=NODE_01
  ```
* **Custom Cadence / Sub-Second Streaming**:
  ```bash
  node simulator.js --scenario=critical --node=NODE_01 --interval=500
  ```

---

## Running with Physical Hardware

When transitioning from simulation to real hardware:
* **No software rewrites are needed**: The cloud database, analysis calculations, and live dashboard remain identical.
* **Firmware Deployment**: The physical ESP32 connects to on-site Wi-Fi and performs an HTTP POST directly to the Supabase Edge Function endpoint:
  ```http
  POST https://<project-ref>.supabase.co/functions/v1/sensor-data
  ```
* **Payload Specification**: The firmware must format its payload according to the locked JSON data contract. Refer to [API.md](file:///c:/Users/HP/Downloads/Bhoomi-NETr/API.md) for required HTTP headers, authentication keys, validation constraints, and error response schemas.

---

## Running the Standalone Analysis Engine & Pytest Suite

The core Python computation module in `engine/` can be executed independently of network infrastructure or web services.

### Evaluate a Sensor Reading JSON File
```bash
python run_analysis.py sample_data/sample_reading.json
```
Output:
```json
{
  "node_id": "NODE_01",
  "timestamp": "2026-09-05T12:30:00Z",
  "displacement": 1.6,
  "status": "NORMAL",
  "risk_score": 16,
  "warnings": []
}
```

### Run Person 2's Test Suite
Execute the pytest suite covering displacement calculation, threshold classification, risk scoring, and edge-case scenarios:
```bash
pytest tests/
```

---

## Current Known Limitations

* **Demonstration-Only Thresholds**: Current warning limits (`tilt >= 15°`, `vibration >= 1.0g`, `displacement >= 2.0cm`) are demonstration values designed to prove pipeline flow and must not be treated as certified mine-safety limits.
* **Single-Node Hardware Stage**: While the software and simulator fully support multiple nodes (`NODE_01`, `NODE_02`, `NODE_03`), physical hardware development is currently at single-node prototype validation.
* **Threshold Duplication**: Warning thresholds and risk classification rules are duplicated between Person 2's Python engine (`engine/thresholds.py`, `engine/risk.py`) and Person 3's client adapter (`src/services/analysisAdapter.ts`), requiring manual synchronization until a unified backend evaluation queue is introduced in Phase 2.

---

## Team Roles & Responsibilities

* **Person 1 (Data / Backend)**: Supabase PostgreSQL schema, Edge Function ingestion pipeline, hardware simulator, and database verification.
* **Person 2 (Analysis / AI)**: Sensor processing engine, ground displacement calculation, threshold logic, and automated risk scoring.
* **Person 3 (Frontend / Dashboard)**: Live monitoring console, multi-node status views, real-time WebSocket subscriptions, and time-series telemetry charts.
