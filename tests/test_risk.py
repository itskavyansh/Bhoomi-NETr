import json
from pathlib import Path
import pytest

from engine.risk import analyze_reading, assess_risk_level


def test_assess_risk_all_normal():
    assert assess_risk_level(["NORMAL", "NORMAL", "NORMAL"]) == "NORMAL"


def test_assess_risk_with_warning():
    assert assess_risk_level(["NORMAL", "WARNING", "NORMAL"]) == "WARNING"


def test_assess_risk_with_critical():
    assert assess_risk_level(["WARNING", "CRITICAL", "NORMAL"]) == "CRITICAL"


def test_assess_risk_case_insensitive():
    assert assess_risk_level(["normal", "warning"]) == "WARNING"
    assert assess_risk_level(["critical", "normal"]) == "CRITICAL"


def test_analyze_reading_sample_reading():
    sample_file = Path(__file__).resolve().parent.parent / "sample_data" / "sample_reading.json"
    with open(sample_file, "r", encoding="utf-8") as f:
        reading = json.load(f)

    result = analyze_reading(reading)

    # Verify exact keys returned (no extra fields, no UI hints)
    expected_keys = {"node_id", "timestamp", "displacement", "status", "risk_score", "warnings"}
    assert set(result.keys()) == expected_keys

    assert result["node_id"] == "NODE_01"
    assert result["timestamp"] == "2026-09-05T12:30:00Z"
    assert result["displacement"] == 1.6
    assert result["status"] == "NORMAL"
    assert result["warnings"] == []
    assert isinstance(result["risk_score"], int)
    assert 0 <= result["risk_score"] <= 20


def test_analyze_reading_warning_status():
    reading = {
        "node_id": "NODE_02",
        "timestamp": "2026-09-05T12:35:00Z",
        "tilt_x": 4.0,
        "tilt_y": 3.0,
        "vibration": 1.5,  # Exceeds 1.0 g threshold
        "distance": 19.0,  # 1.0 cm displacement (< 2.0 cm threshold)
    }

    result = analyze_reading(reading)
    assert result["status"] == "WARNING"
    assert result["warnings"] == ["HIGH_VIBRATION"]
    assert isinstance(result["risk_score"], int)
    assert 40 <= result["risk_score"] <= 70


def test_analyze_reading_critical_two_warnings():
    reading = {
        "node_id": "NODE_03",
        "timestamp": "2026-09-05T12:40:00Z",
        "tilt_x": 16.5,  # Exceeds 15.0 deg threshold
        "tilt_y": 2.0,
        "vibration": 1.2,  # Exceeds 1.0 g threshold
        "distance": 19.5,  # 0.5 cm displacement (normal)
    }

    result = analyze_reading(reading)
    assert result["status"] == "CRITICAL"
    assert result["warnings"] == ["EXCESSIVE_TILT", "HIGH_VIBRATION"]
    assert isinstance(result["risk_score"], int)
    assert 80 <= result["risk_score"] <= 100


def test_analyze_reading_critical_three_warnings():
    reading = {
        "node_id": "NODE_04",
        "timestamp": "2026-09-05T12:45:00Z",
        "tilt_x": 18.0,  # Exceeds 15.0 deg threshold
        "tilt_y": 5.0,
        "vibration": 1.8,  # Exceeds 1.0 g threshold
        "distance": 16.0,  # 4.0 cm displacement (exceeds 2.0 cm threshold)
    }

    result = analyze_reading(reading)
    assert result["status"] == "CRITICAL"
    assert len(result["warnings"]) == 3
    assert "EXCESSIVE_TILT" in result["warnings"]
    assert "HIGH_VIBRATION" in result["warnings"]
    assert "ABNORMAL_DISPLACEMENT" in result["warnings"]
    assert isinstance(result["risk_score"], int)
    assert 80 <= result["risk_score"] <= 100


@pytest.mark.parametrize("missing_field", ["node_id", "timestamp", "tilt_x", "tilt_y", "vibration", "distance"])
def test_analyze_reading_missing_field_raises(missing_field):
    reading = {
        "node_id": "NODE_01",
        "timestamp": "2026-09-05T12:30:00Z",
        "tilt_x": 7.2,
        "tilt_y": 3.8,
        "vibration": 0.34,
        "distance": 18.4,
    }
    del reading[missing_field]

    with pytest.raises(KeyError, match=f"Missing required sensor reading field"):
        analyze_reading(reading)


def test_analyze_reading_custom_baseline():
    reading = {
        "node_id": "NODE_05",
        "timestamp": "2026-09-05T12:50:00Z",
        "tilt_x": 2.0,
        "tilt_y": 2.0,
        "vibration": 0.1,
        "distance": 22.5,
    }
    # Custom baseline 25.0 -> displacement 2.5 (>= 2.0 threshold) -> ABNORMAL_DISPLACEMENT
    result = analyze_reading(reading, baseline_distance=25.0)
    assert result["displacement"] == 2.5
    assert result["status"] == "WARNING"
    assert result["warnings"] == ["ABNORMAL_DISPLACEMENT"]
