"""Sensor health and data confidence evaluation module for Bhoomi-NETr."""

import math
from typing import Any, Dict, List, Optional

# Physical plausible sensor ranges for demonstration / hardware limits
# MPU6050 Accelerometer / Gyro
TILT_MIN_DEG = -90.0
TILT_MAX_DEG = 90.0
VIBRATION_MIN_G = 0.0
VIBRATION_MAX_G = 16.0  # MPU6050 +/- 16g full scale range

# HC-SR04 Ultrasonic Distance Sensor
HCSR04_MIN_DIST_CM = 2.0   # Ultrasonic physical minimum blind spot ~2cm
HCSR04_MAX_DIST_CM = 400.0 # Ultrasonic physical maximum theoretical range ~400cm


def _is_valid_number(val: Any) -> bool:
    """Check if value is a valid non-NaN finite number."""
    if val is None or isinstance(val, bool):
        return False
    if not isinstance(val, (int, float)):
        return False
    return not math.isnan(val) and not math.isinf(val)


def evaluate_sensor_health(
    reading: Dict[str, Any],
    history: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Evaluates the operational health of onboard sensors and calculates an
    overall Sensor Confidence Score (0-100%).

    Checks:
    - Missing / null / NaN fields
    - Out-of-physical-range impossible values
    - Signal stability / noise jumps
    - Frozen/stuck sensor readings across history
    - Data freshness / connectivity
    """
    issues: List[str] = []
    penalty = 0

    # Hardware sensor diagnostic status from firmware
    raw_mpu_status = reading.get("mpu6050_status")
    raw_hcsr04_status = reading.get("hc_sr04_status")

    mpu_fault = str(raw_mpu_status).strip().lower() == "fault"
    hcsr04_fault = str(raw_hcsr04_status).strip().lower() == "fault"

    if mpu_fault:
        penalty += 50
        issues.append("MPU6050 hardware transducer reported fault status ('fault')")

    if hcsr04_fault:
        penalty += 50
        issues.append("HC-SR04 ultrasonic transducer reported fault status ('fault')")

    # Sensor status placeholders
    mpu_status = "GOOD"
    hcsr04_status = "GOOD"
    connectivity_status = "GOOD"
    data_quality_status = "GOOD"

    # 1. Validate MPU6050 (Tilt X, Tilt Y)
    tilt_x = reading.get("tilt_x")
    tilt_y = reading.get("tilt_y")
    tilt_x_valid = _is_valid_number(tilt_x)
    tilt_y_valid = _is_valid_number(tilt_y)

    if not tilt_x_valid or not tilt_y_valid:
        mpu_status = "INVALID"
        penalty += 35
        issues.append("MPU6050 tilt telemetry missing or non-numeric")
    else:
        if not (TILT_MIN_DEG <= float(tilt_x) <= TILT_MAX_DEG) or not (TILT_MIN_DEG <= float(tilt_y) <= TILT_MAX_DEG):
            mpu_status = "INVALID"
            penalty += 30
            issues.append(f"Tilt angle out of physical range ([-90°, 90°]): X={tilt_x}°, Y={tilt_y}°")
        elif abs(float(tilt_x)) > 75.0 or abs(float(tilt_y)) > 75.0:
            if mpu_status == "GOOD":
                mpu_status = "UNSTABLE"
            penalty += 10
            issues.append("Tilt angle near physical tipping limit")

    # 2. Validate Vibration (MPU6050 Accelerometer)
    vibration = reading.get("vibration")
    if not _is_valid_number(vibration):
        if mpu_status != "INVALID":
            mpu_status = "UNSTABLE"
        penalty += 20
        issues.append("Vibration metric missing or non-numeric")
    else:
        vib_val = float(vibration)
        if vib_val < VIBRATION_MIN_G or vib_val > VIBRATION_MAX_G:
            mpu_status = "INVALID"
            penalty += 25
            issues.append(f"Vibration magnitude ({vib_val}g) exceeds sensor physical scale (0-16g)")

    # 3. Validate HC-SR04 (Distance)
    distance = reading.get("distance")
    if not _is_valid_number(distance):
        hcsr04_status = "INVALID"
        penalty += 35
        issues.append("HC-SR04 distance metric missing or non-numeric")
    else:
        dist_val = float(distance)
        if dist_val < HCSR04_MIN_DIST_CM or dist_val > HCSR04_MAX_DIST_CM:
            hcsr04_status = "INVALID"
            penalty += 30
            issues.append(f"HC-SR04 distance ({dist_val} cm) outside ultrasonic operational range (2-400 cm)")
        elif dist_val <= 3.0 or dist_val >= 380.0:
            if hcsr04_status == "GOOD":
                hcsr04_status = "UNSTABLE"
            penalty += 10
            issues.append("HC-SR04 distance approaching transducer boundary limits")

    # 4. Check historical consistency (stuck sensor / abnormal jumps) if history provided
    if history and len(history) >= 3:
        # Check for frozen readings across last 3 points
        recent_dists = [h.get("distance") for h in history[-3:] if _is_valid_number(h.get("distance"))]
        recent_tilts = [h.get("tilt_x") for h in history[-3:] if _is_valid_number(h.get("tilt_x"))]
        
        if len(recent_dists) == 3 and len(set(recent_dists)) == 1 and distance == recent_dists[0]:
            # Potential stuck HC-SR04 sensor
            if hcsr04_status == "GOOD":
                hcsr04_status = "UNSTABLE"
            penalty += 10
            issues.append("HC-SR04 reported identical repeated readings across consecutive intervals")

        # Check for abnormal instantaneous jump in distance (> 50 cm in single tick)
        if len(recent_dists) >= 1 and _is_valid_number(distance):
            prev_dist = recent_dists[-1]
            if abs(float(distance) - float(prev_dist)) > 50.0:
                if hcsr04_status == "GOOD":
                    hcsr04_status = "UNSTABLE"
                penalty += 15
                issues.append("Abnormal ultrasonic distance spike detected between consecutive samples")

    # 5. Connectivity and timestamp freshness
    timestamp = reading.get("timestamp")
    if not timestamp or not isinstance(timestamp, str):
        connectivity_status = "UNSTABLE"
        penalty += 10
        issues.append("Timestamp absent or malformed in payload")

    # Hardware fault overrides
    if mpu_fault and mpu_status == "GOOD":
        mpu_status = "BAD"
    if hcsr04_fault and hcsr04_status == "GOOD":
        hcsr04_status = "BAD"

    # Overall Data Quality Status
    if mpu_status == "INVALID" or hcsr04_status == "INVALID":
        data_quality_status = "INVALID"
    elif (
        mpu_status == "UNSTABLE"
        or hcsr04_status == "UNSTABLE"
        or connectivity_status == "UNSTABLE"
        or mpu_fault
        or hcsr04_fault
    ):
        data_quality_status = "DEGRADED"
    else:
        # Overall Data Quality Status
        if mpu_status == "INVALID" or hcsr04_status == "INVALID":
            data_quality_status = "INVALID"
        elif mpu_status == "UNSTABLE" or hcsr04_status == "UNSTABLE" or connectivity_status == "UNSTABLE":
            data_quality_status = "DEGRADED"
        else:
            data_quality_status = "GOOD"

    # Compute final Confidence Score (0-100)
    raw_confidence = 100 - penalty
    sensor_confidence = max(0, min(100, raw_confidence))

    if sensor_confidence >= 85:
        confidence_level = "HIGH"
    elif sensor_confidence >= 60:
        confidence_level = "MODERATE"
    else:
        confidence_level = "LOW"

    confidence_warning = None
    if sensor_confidence < 60 or mpu_fault or hcsr04_fault:
        if mpu_fault and hcsr04_fault:
            confidence_warning = "LOW SENSOR CONFIDENCE: Hardware fault reported across sensors"
        elif mpu_fault:
            confidence_warning = "LOW SENSOR CONFIDENCE: MPU6050 hardware fault reported"
        elif hcsr04_fault:
            confidence_warning = "LOW SENSOR CONFIDENCE: HC-SR04 hardware fault reported"
        else:
            warning_detail = issues[0] if issues else "Unreliable sensor telemetry"
            confidence_warning = f"LOW SENSOR CONFIDENCE: {warning_detail}"

    return {
        "sensor_confidence": sensor_confidence,
        "confidence_level": confidence_level,
        "sensor_health": {
            "mpu6050": mpu_status,
            "hcsr04": hcsr04_status,
            "connectivity": connectivity_status,
            "data_quality": data_quality_status,
            "mpu6050_status": "fault" if mpu_fault else ("ok" if raw_mpu_status else None),
            "hc_sr04_status": "fault" if hcsr04_fault else ("ok" if raw_hcsr04_status else None),
        },
        "issues": issues,
        "confidence_warning": confidence_warning,
    }

