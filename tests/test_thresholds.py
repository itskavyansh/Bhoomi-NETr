import pytest

from engine.thresholds import (
    DISPLACEMENT_THRESHOLD_CM,
    TILT_THRESHOLD_DEG,
    VIBRATION_THRESHOLD_G,
    classify_displacement,
    classify_tilt,
    classify_vibration,
)


def test_threshold_constants():
    assert TILT_THRESHOLD_DEG == 15.0
    assert VIBRATION_THRESHOLD_G == 1.0
    assert DISPLACEMENT_THRESHOLD_CM == 2.0


def test_classify_tilt_normal():
    # Both axes below default threshold (15.0 deg)
    assert classify_tilt(7.2, 3.8) == "NORMAL"
    assert classify_tilt(0.0, 0.0) == "NORMAL"
    assert classify_tilt(-7.2, -3.8) == "NORMAL"


def test_classify_tilt_excessive():
    # X exceeds threshold
    assert classify_tilt(15.0, 5.0) == "EXCESSIVE_TILT"
    assert classify_tilt(16.5, 2.0) == "EXCESSIVE_TILT"
    # Y exceeds threshold
    assert classify_tilt(4.0, 15.0) == "EXCESSIVE_TILT"
    assert classify_tilt(3.0, 18.2) == "EXCESSIVE_TILT"
    # Negative values exceeding threshold (abs checked)
    assert classify_tilt(-15.5, 2.0) == "EXCESSIVE_TILT"
    assert classify_tilt(2.0, -17.0) == "EXCESSIVE_TILT"


def test_classify_tilt_custom_threshold():
    assert classify_tilt(10.0, 5.0, threshold_deg=12.0) == "NORMAL"
    assert classify_tilt(10.0, 5.0, threshold_deg=10.0) == "EXCESSIVE_TILT"


def test_classify_vibration_normal():
    # Below default threshold (1.0 g)
    assert classify_vibration(0.34) == "NORMAL"
    assert classify_vibration(0.0) == "NORMAL"
    assert classify_vibration(0.999) == "NORMAL"


def test_classify_vibration_high():
    # Equal to or exceeding default threshold (1.0 g)
    assert classify_vibration(1.0) == "HIGH_VIBRATION"
    assert classify_vibration(1.5) == "HIGH_VIBRATION"


def test_classify_vibration_custom_threshold():
    assert classify_vibration(0.4, threshold_g=0.5) == "NORMAL"
    assert classify_vibration(0.5, threshold_g=0.5) == "HIGH_VIBRATION"


def test_classify_displacement_normal():
    # Below default threshold (2.0 cm)
    assert classify_displacement(1.6) == "NORMAL"
    assert classify_displacement(0.0) == "NORMAL"
    assert classify_displacement(1.999) == "NORMAL"


def test_classify_displacement_abnormal():
    # Equal to or exceeding default threshold (2.0 cm)
    assert classify_displacement(2.0) == "ABNORMAL_DISPLACEMENT"
    assert classify_displacement(3.5) == "ABNORMAL_DISPLACEMENT"


def test_classify_displacement_custom_threshold():
    assert classify_displacement(1.5, threshold_cm=3.0) == "NORMAL"
    assert classify_displacement(3.0, threshold_cm=3.0) == "ABNORMAL_DISPLACEMENT"
