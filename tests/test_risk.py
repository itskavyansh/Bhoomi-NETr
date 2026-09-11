import json
from pathlib import Path
import pytest

from engine.risk import analyze_reading, assess_risk_level, classify_risk_index_level
from engine.sensor_health import evaluate_sensor_health


def test_assess_risk_all_normal():
    assert assess_risk_level(["NORMAL", "NORMAL", "NORMAL"]) == "NORMAL"


def test_assess_risk_with_warning():
    assert assess_risk_level(["NORMAL", "WARNING", "NORMAL"]) == "WARNING"


def test_assess_risk_with_critical():
    assert assess_risk_level(["WARNING", "CRITICAL", "NORMAL"]) == "CRITICAL"


def test_assess_risk_case_insensitive():
    assert assess_risk_level(["normal", "warning"]) == "WARNING"
    assert assess_risk_level(["critical", "normal"]) == "CRITICAL"


def test_classify_risk_index_level():
    assert classify_risk_index_level(15) == "LOW"
    assert classify_risk_index_level(35) == "MODERATE"
    assert classify_risk_index_level(65) == "HIGH"
    assert classify_risk_index_level(85) == "CRITICAL"


def test_analyze_reading_sample_reading():
    sample_file = Path(__file__).resolve().parent.parent / "sample_data" / "sample_reading.json"
    with open(sample_file, "r", encoding="utf-8") as f:
        reading = json.load(f)

    result = analyze_reading(reading)

    # Verify returned keys including backward-compatible and additive fields
    expected_keys = {
        "node_id",
        "timestamp",
        "displacement",
        "status",
        "risk_score",
        "warnings",
        "risk_level",
        "risk_factors",
        "sensor_confidence",
        "sensor_health",
        "confidence_warning",
    }
    assert set(result.keys()) == expected_keys

    assert result["node_id"] == "NODE_01"
    assert result["timestamp"] == "2026-09-05T12:30:00Z"
    assert result["displacement"] == 1.6
    assert result["status"] == "NORMAL"
    assert result["warnings"] == []
    assert isinstance(result["risk_score"], int)
    assert 0 <= result["risk_score"] <= 20
    assert result["risk_level"] == "LOW"
    assert len(result["risk_factors"]) > 0
    assert 0 <= result["sensor_confidence"] <= 100
    assert result["sensor_health"]["mpu6050"] == "GOOD"
    assert result["sensor_health"]["hcsr04"] == "GOOD"


def test_analyze_reading_warning_status_isolated_vibration():
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
    assert result["sensor_confidence"] >= 85
    assert any("vibration" in factor.lower() for factor in result["risk_factors"])


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
    assert result["risk_level"] == "CRITICAL"
    assert "Multi-sensor ground movement correlation detected" in result["risk_factors"]


def test_analyze_reading_critical_three_warnings_correlated():
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
    assert result["risk_level"] == "CRITICAL"


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

    with pytest.raises(KeyError, match="Missing required sensor reading field"):
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


def test_sensor_health_and_confidence_evaluation():
    # Valid reading -> high confidence (>= 90%)
    valid_reading = {
        "node_id": "NODE_01",
        "timestamp": "2026-09-05T12:00:00Z",
        "tilt_x": 3.5,
        "tilt_y": 2.1,
        "vibration": 0.15,
        "distance": 19.8,
    }
    health = evaluate_sensor_health(valid_reading)
    assert health["sensor_confidence"] >= 90
    assert health["sensor_health"]["mpu6050"] == "GOOD"
    assert health["sensor_health"]["hcsr04"] == "GOOD"
    assert health["sensor_health"]["data_quality"] == "GOOD"
    assert health["confidence_warning"] is None

    # Invalid out-of-range HC-SR04 reading (e.g. 0.5 cm or 500 cm)
    invalid_hcsr04 = {
        "node_id": "NODE_01",
        "timestamp": "2026-09-05T12:00:00Z",
        "tilt_x": 3.5,
        "tilt_y": 2.1,
        "vibration": 0.15,
        "distance": 0.5,  # ultrasonic blind spot (< 2cm)
    }
    health_invalid = evaluate_sensor_health(invalid_hcsr04)
    assert health_invalid["sensor_health"]["hcsr04"] == "INVALID"
    assert health_invalid["sensor_confidence"] < 75
    assert len(health_invalid["issues"]) > 0


def test_analyze_reading_with_progression_history():
    history = [
        {"distance": 19.8, "tilt_x": 3.0, "timestamp": "2026-09-05T12:00:00Z"},
        {"distance": 19.0, "tilt_x": 5.0, "timestamp": "2026-09-05T12:01:00Z"},
    ]
    # Accelerating drop in distance (displacement jumped to 3.0 cm from 1.0 cm)
    reading = {
        "node_id": "NODE_01",
        "timestamp": "2026-09-05T12:02:00Z",
        "tilt_x": 16.0,
        "tilt_y": 3.0,
        "vibration": 1.2,
        "distance": 17.0,
    }
    result = analyze_reading(reading, history=history)
    assert result["status"] == "CRITICAL"
    assert any("Accelerating displacement progression" in f for f in result["risk_factors"])
