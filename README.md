# Analysis Engine

The `analysis-engine` processes sensor telemetry from mine subsidence monitoring nodes to calculate ground displacement and assess structural risk. Designed as a self-contained core computation module, it operates completely independent of Supabase, web dashboards, or external network infrastructure. It follows a clean data contract by ingesting raw sensor readings in JSON format and returning evaluated subsidence metrics as structured JSON output.

## Quick Start

Run analysis on a sample sensor reading file:

```bash
python run_analysis.py sample_data/sample_reading.json
```

Expected output:

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
