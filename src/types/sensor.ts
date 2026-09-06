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
}

export interface TimePoint {
  timestamp: string;
  tilt_x: number;
  tilt_y: number;
  vibration: number;
  distance: number;
  displacement: number;
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
};
