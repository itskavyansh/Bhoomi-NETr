import pytest

from engine.risk import analyze_reading


def test_scenario_a_normal():
    reading = {
        "node_id": "NODE_01",
        "timestamp": "2026-09-05T12:00:00Z",
        "tilt_x": 3.0,
        "tilt_y": 1.0,
        "vibration": 0.05,
        "distance": 19.8,
    }
    result = analyze_reading(reading)
    assert result["status"] == "NORMAL"
    assert result["warnings"] == []


def test_scenario_b_excessive_tilt():
    reading = {
        "node_id": "NODE_01",
        "timestamp": "2026-09-05T12:01:00Z",
        "tilt_x": 25.0,
        "tilt_y": 2.0,
        "vibration": 0.08,
        "distance": 19.7,
    }
    result = analyze_reading(reading)
    assert result["status"] == "WARNING"
    assert "EXCESSIVE_TILT" in result["warnings"]


def test_scenario_c_high_vibration():
    reading = {
        "node_id": "NODE_01",
        "timestamp": "2026-09-05T12:02:00Z",
        "tilt_x": 4.0,
        "tilt_y": 1.5,
        "vibration": 1.8,
        "distance": 19.8,
    }
    result = analyze_reading(reading)
    assert result["status"] == "WARNING"
    assert "HIGH_VIBRATION" in result["warnings"]


def test_scenario_d_multiple_abnormalities():
    reading = {
        "node_id": "NODE_01",
        "timestamp": "2026-09-05T12:03:00Z",
        "tilt_x": 30.0,
        "tilt_y": 5.0,
        "vibration": 2.0,
        "distance": 16.5,
    }
    result = analyze_reading(reading)
    assert result["status"] == "CRITICAL"
    assert "EXCESSIVE_TILT" in result["warnings"]
    assert "HIGH_VIBRATION" in result["warnings"]
    assert "ABNORMAL_DISPLACEMENT" in result["warnings"]
