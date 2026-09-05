"""Displacement calculation module for mine subsidence monitoring."""

# Module-level constant: placeholder baseline distance until real calibration data exists.
# Note: This is a demo value (in cm), not calibrated.
DEFAULT_BASELINE_DISTANCE = 20.0


def calculate_displacement(baseline_distance: float, current_distance: float) -> float:
    """
    Displacement = how much the ground has moved from its baseline position.
    baseline_distance: the HC-SR04 distance reading recorded when the node was first installed (cm).
    current_distance: the latest HC-SR04 distance reading (cm).
    Returns displacement in cm, always as a non-negative value using abs().
    Raise ValueError if either input is negative.
    """
    if baseline_distance < 0 or current_distance < 0:
        raise ValueError("Distances must be non-negative values.")

    return abs(current_distance - baseline_distance)
