"""Risk assessment and analysis engine for mine subsidence monitoring."""

from typing import Any, Dict, List, Optional

from engine.displacement import DEFAULT_BASELINE_DISTANCE, calculate_displacement
from engine.sensor_health import evaluate_sensor_health
from engine.thresholds import (
    DISPLACEMENT_THRESHOLD_CM,
    TILT_THRESHOLD_DEG,
    VIBRATION_THRESHOLD_G,
    classify_displacement,
    classify_tilt,
    classify_vibration,
)

REQUIRED_FIELDS = ("node_id", "timestamp", "tilt_x", "tilt_y", "vibration", "distance")


def assess_risk_level(metric_statuses: List[str]) -> str:
    """
    Determine the overall risk level based on the status of individual metrics.

    Returns: 'NORMAL', 'WARNING', or 'CRITICAL'.
    """
    normalized = [status.strip().upper() for status in metric_statuses]
    if "CRITICAL" in normalized:
        return "CRITICAL"
    if "WARNING" in normalized:
        return "WARNING"
    return "NORMAL"


def classify_risk_index_level(risk_score: int) -> str:
    """
    Map a 0-100 risk score to standard subsidence risk levels:
    - 0-24: LOW
    - 25-49: MODERATE
    - 50-74: HIGH
    - 75-100: CRITICAL
    """
    if risk_score >= 75:
        return "CRITICAL"
    if risk_score >= 50:
        return "HIGH"
    if risk_score >= 25:
        return "MODERATE"
    return "LOW"


def analyze_reading(
    reading: Dict[str, Any],
    baseline_distance: float = DEFAULT_BASELINE_DISTANCE,
    history: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Analyzes raw sensor reading and calculates:
    1. Ground displacement from distance and baseline
    2. Threshold classifications for tilt, vibration, and displacement
    3. Subsidence Risk Index (0-100) with multi-sensor correlation and trend progression
    4. Deterministic risk contributors/factors
    5. Sensor Health & Confidence Score (0-100%)

    Raises KeyError if required fields are missing.
    """
    missing_fields = [field for field in REQUIRED_FIELDS if field not in reading]
    if missing_fields:
        raise KeyError(f"Missing required sensor reading field(s): {', '.join(missing_fields)}")

    # 1. Calculate displacement from reading["distance"] and baseline_distance
    displacement = calculate_displacement(baseline_distance, reading["distance"])

    # 2. Run classify_tilt, classify_vibration, classify_displacement
    tilt_status = classify_tilt(reading["tilt_x"], reading["tilt_y"])
    vibration_status = classify_vibration(reading["vibration"])
    displacement_status = classify_displacement(displacement)

    # 3. Collect warnings
    warnings: List[str] = []
    if tilt_status != "NORMAL":
        warnings.append(tilt_status)
    if vibration_status != "NORMAL":
        warnings.append(vibration_status)
    if displacement_status != "NORMAL":
        warnings.append(displacement_status)

    # 4. Determine overall status (CRITICAL >= 2 warnings, WARNING == 1, NORMAL == 0)
    if len(warnings) >= 2:
        status = "CRITICAL"
    elif len(warnings) == 1:
        status = "WARNING"
    else:
        status = "NORMAL"

    # 5. Compute Subsidence Risk Index (0-100) with multi-sensor correlation
    max_tilt = max(abs(reading["tilt_x"]), abs(reading["tilt_y"]))
    tilt_ratio = max_tilt / TILT_THRESHOLD_DEG if TILT_THRESHOLD_DEG > 0 else 0.0
    vibration_ratio = reading["vibration"] / VIBRATION_THRESHOLD_G if VIBRATION_THRESHOLD_G > 0 else 0.0
    displacement_ratio = displacement / DISPLACEMENT_THRESHOLD_CM if DISPLACEMENT_THRESHOLD_CM > 0 else 0.0
    max_ratio = max(tilt_ratio, vibration_ratio, displacement_ratio)

    risk_factors: List[str] = []

    # Trend / Progression analysis from recent history
    trend_factor = 0
    if history and len(history) >= 2:
        prev_reading = history[-1]
        if "distance" in prev_reading:
            prev_disp = calculate_displacement(baseline_distance, prev_reading["distance"])
            disp_rate = displacement - prev_disp
            if disp_rate > 0.2:
                trend_factor = min(10, int(round(disp_rate * 10)))
                risk_factors.append(f"Accelerating displacement progression (+{disp_rate:.2f} cm/tick)")

    if status == "NORMAL":
        # NORMAL -> 0-20 based on proximity to threshold
        score = int(round(min(max(max_ratio, 0.0), 1.0) * 20))
        risk_score = min(20, max(0, score))
        risk_factors.append("All sensor metrics within normal baseline")
    elif status == "WARNING":
        # Isolated anomaly: moderate warning (40-70)
        excess = max(0.0, max_ratio - 1.0)
        score = int(round(40 + min(excess, 1.0) * 30)) + trend_factor
        risk_score = min(70, max(40, score))

        if tilt_status != "NORMAL":
            risk_factors.append(f"Excessive tilt detected ({max_tilt:.1f}° ≥ {TILT_THRESHOLD_DEG}°)")
        if vibration_status != "NORMAL":
            risk_factors.append(f"High vibration anomaly ({reading['vibration']:.2f}g ≥ {VIBRATION_THRESHOLD_G}g)")
        if displacement_status != "NORMAL":
            risk_factors.append(f"Abnormal ground displacement ({displacement:.2f}cm ≥ {DISPLACEMENT_THRESHOLD_CM}cm)")
    else:
        # Correlated multi-sensor movement: high / critical risk (80-100)
        base = 80 if len(warnings) == 2 else 90
        excess = max(0.0, max_ratio - 1.0)
        score = int(round(base + min(excess, 1.0) * 10)) + trend_factor
        risk_score = min(100, max(80, score))

        if tilt_status != "NORMAL":
            risk_factors.append(f"Excessive tilt ({max_tilt:.1f}°)")
        if vibration_status != "NORMAL":
            risk_factors.append(f"High vibration ({reading['vibration']:.2f}g)")
        if displacement_status != "NORMAL":
            risk_factors.append(f"Abnormal ground displacement ({displacement:.2f}cm)")
        risk_factors.append("Multi-sensor ground movement correlation detected")

    risk_level = classify_risk_index_level(risk_score)

    # 6. Evaluate Sensor Health & Confidence
    health_evaluation = evaluate_sensor_health(reading, history)

    return {
        "node_id": reading["node_id"],
        "timestamp": reading["timestamp"],
        "displacement": round(displacement, 2),
        "status": status,
        "risk_score": risk_score,
        "warnings": warnings,
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "sensor_confidence": health_evaluation["sensor_confidence"],
        "sensor_health": health_evaluation["sensor_health"],
        "confidence_warning": health_evaluation["confidence_warning"],
    }
