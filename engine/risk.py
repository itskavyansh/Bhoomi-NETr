"""Risk assessment and analysis engine for mine subsidence monitoring."""

from typing import List

from engine.displacement import DEFAULT_BASELINE_DISTANCE, calculate_displacement
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


# This function must never know about dashboards, colors, or UI. Its only contract is JSON in, JSON out.
def analyze_reading(reading: dict, baseline_distance: float = DEFAULT_BASELINE_DISTANCE) -> dict:
    """
    Takes a raw sensor reading dict matching this shape:
    {
      "node_id": str,
      "timestamp": str,
      "tilt_x": float,
      "tilt_y": float,
      "vibration": float,
      "distance": float
    }

    Steps:
    1. Calculate displacement from reading["distance"] and baseline_distance.
    2. Run classify_tilt, classify_vibration, classify_displacement.
    3. Collect any non-"NORMAL" result into a warnings list.
    4. Determine overall status:
       - "CRITICAL" if 2 or more warnings are present
       - "WARNING" if exactly 1 warning is present
       - "NORMAL" if zero warnings
    5. Compute a risk_score (0-100 int):
       - NORMAL -> 0-20 (scale based on how close values are to thresholds, simple linear proportion is fine)
       - WARNING -> 40-70
       - CRITICAL -> 80-100
       Keep this scoring simple and clearly commented as a placeholder heuristic, not a validated formula.

    Returns EXACTLY this shape (no extra fields, no UI-related fields, no CSS/color hints):
    {
      "node_id": reading["node_id"],
      "timestamp": reading["timestamp"],
      "displacement": <calculated value, rounded to 2 decimals>,
      "status": "NORMAL" | "WARNING" | "CRITICAL",
      "risk_score": <int>,
      "warnings": [<list of warning strings>]
    }

    Raise KeyError with a clear message if reading is missing any required field.
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

    # 3. Collect any non-"NORMAL" result into a warnings list
    warnings = []
    if tilt_status != "NORMAL":
        warnings.append(tilt_status)
    if vibration_status != "NORMAL":
        warnings.append(vibration_status)
    if displacement_status != "NORMAL":
        warnings.append(displacement_status)

    # 4. Determine overall status:
    #    - "CRITICAL" if 2 or more warnings are present
    #    - "WARNING" if exactly 1 warning is present
    #    - "NORMAL" if zero warnings
    if len(warnings) >= 2:
        status = "CRITICAL"
    elif len(warnings) == 1:
        status = "WARNING"
    else:
        status = "NORMAL"

    # 5. Compute risk_score (0-100 int)
    # Placeholder heuristic: simple linear proportion against demonstration thresholds.
    # Note: This is an uncalibrated placeholder heuristic for testing pipeline flow.
    max_tilt = max(abs(reading["tilt_x"]), abs(reading["tilt_y"]))
    tilt_ratio = max_tilt / TILT_THRESHOLD_DEG if TILT_THRESHOLD_DEG > 0 else 0.0
    vibration_ratio = reading["vibration"] / VIBRATION_THRESHOLD_G if VIBRATION_THRESHOLD_G > 0 else 0.0
    displacement_ratio = displacement / DISPLACEMENT_THRESHOLD_CM if DISPLACEMENT_THRESHOLD_CM > 0 else 0.0
    max_ratio = max(tilt_ratio, vibration_ratio, displacement_ratio)

    if status == "NORMAL":
        # NORMAL -> 0-20 based on proximity to threshold
        score = int(round(min(max(max_ratio, 0.0), 1.0) * 20))
        risk_score = min(20, max(0, score))
    elif status == "WARNING":
        # WARNING -> 40-70 based on single metric exceedance
        excess = max(0.0, max_ratio - 1.0)
        score = int(round(40 + min(excess, 1.0) * 30))
        risk_score = min(70, max(40, score))
    else:
        # CRITICAL -> 80-100 based on warning count and metric exceedance
        base = 80 if len(warnings) == 2 else 90
        excess = max(0.0, max_ratio - 1.0)
        score = int(round(base + min(excess, 1.0) * 10))
        risk_score = min(100, max(80, score))

    # Return EXACT shape
    return {
        "node_id": reading["node_id"],
        "timestamp": reading["timestamp"],
        "displacement": round(displacement, 2),
        "status": status,
        "risk_score": risk_score,
        "warnings": warnings,
    }
