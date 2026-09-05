# ============================================================
# DEMONSTRATION THRESHOLDS ONLY
# These are NOT validated mine-safety limits. They exist to prove
# the pipeline works end-to-end. Replace with real values once
# field/domain data is available.
# ============================================================

TILT_THRESHOLD_DEG = 15.0
VIBRATION_THRESHOLD_G = 1.0
DISPLACEMENT_THRESHOLD_CM = 2.0


def classify_tilt(tilt_x: float, tilt_y: float, threshold_deg: float = TILT_THRESHOLD_DEG) -> str:
    """
    Returns "NORMAL" if max(abs(tilt_x), abs(tilt_y)) < threshold_deg
    Returns "EXCESSIVE_TILT" otherwise.
    Use the larger of the two axes since either axis exceeding the limit is dangerous.
    """
    if max(abs(tilt_x), abs(tilt_y)) < threshold_deg:
        return "NORMAL"
    return "EXCESSIVE_TILT"


def classify_vibration(vibration: float, threshold_g: float = VIBRATION_THRESHOLD_G) -> str:
    """
    Returns "NORMAL" if vibration < threshold_g
    Returns "HIGH_VIBRATION" otherwise.
    """
    if vibration < threshold_g:
        return "NORMAL"
    return "HIGH_VIBRATION"


def classify_displacement(displacement_cm: float, threshold_cm: float = DISPLACEMENT_THRESHOLD_CM) -> str:
    """
    Returns "NORMAL" if displacement_cm < threshold_cm
    Returns "ABNORMAL_DISPLACEMENT" otherwise.
    """
    if displacement_cm < threshold_cm:
        return "NORMAL"
    return "ABNORMAL_DISPLACEMENT"
