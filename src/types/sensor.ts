export type SensorStatus = "GOOD" | "UNSTABLE" | "INVALID" | "OFFLINE" | "BAD";
export type DataQualityStatus = "GOOD" | "DEGRADED" | "INVALID";
export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface SensorHealthState {
  mpu6050: "GOOD" | "UNSTABLE" | "INVALID" | "BAD";
  hcsr04: "GOOD" | "UNSTABLE" | "INVALID" | "BAD";
  connectivity: "GOOD" | "UNSTABLE" | "OFFLINE";
  data_quality: "GOOD" | "DEGRADED" | "INVALID";
  mpu6050_status?: "ok" | "fault" | null;
  hc_sr04_status?: "ok" | "fault" | null;
  issues?: string[];
}

export interface SensorReading {
  node_id: string;
  timestamp: string;
  tilt_x: number;
  tilt_y: number;
  vibration: number;
  distance: number;
  displacement: number;
  status: "NORMAL" | "WARNING" | "CRITICAL";
  warnings: string[];
  risk_score: number;
  // Subsidence Risk Index additions
  risk_level: RiskLevel;
  risk_factors: string[];
  // Sensor Health & Confidence additions
  sensor_confidence: number;
  sensor_health: SensorHealthState;
  mpu6050_status?: "ok" | "fault" | null;
  hc_sr04_status?: "ok" | "fault" | null;
  confidence_warning?: string | null;
}

export interface TimePoint {
  timestamp: string;
  tilt_x: number;
  tilt_y: number;
  vibration: number;
  distance: number;
  displacement: number;
  risk_score?: number;
}

// Keep in sync with Person 1's schema (`sensor_readings` table columns).
export type RawSensorRow = {
  id: string | number;
  node_id: string;
  timestamp: string;
  tilt_x: number;
  tilt_y: number;
  vibration: number;
  distance: number;
  displacement?: number | null;
  mpu6050_status?: "ok" | "fault" | null;
  hc_sr04_status?: "ok" | "fault" | null;
};
