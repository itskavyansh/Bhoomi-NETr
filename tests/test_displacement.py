import json
from pathlib import Path
import pytest

from engine.displacement import DEFAULT_BASELINE_DISTANCE, calculate_displacement


def test_default_baseline_distance():
    assert DEFAULT_BASELINE_DISTANCE == 20.0


def test_calculate_displacement_positive_difference():
    # Ground moved closer to sensor (or sensor moved closer to ground)
    result = calculate_displacement(20.0, 18.4)
    assert result == pytest.approx(1.6)


def test_calculate_displacement_negative_difference():
    # Ground moved farther away from sensor
    result = calculate_displacement(20.0, 22.5)
    assert result == pytest.approx(2.5)


def test_calculate_displacement_zero():
    assert calculate_displacement(20.0, 20.0) == 0.0


def test_calculate_displacement_raises_on_negative_baseline():
    with pytest.raises(ValueError, match="non-negative"):
        calculate_displacement(-1.0, 15.0)


def test_calculate_displacement_raises_on_negative_current():
    with pytest.raises(ValueError, match="non-negative"):
        calculate_displacement(20.0, -5.0)


def test_calculate_displacement_raises_on_both_negative():
    with pytest.raises(ValueError, match="non-negative"):
        calculate_displacement(-10.0, -5.0)


def test_sample_reading_displacement():
    sample_file = Path(__file__).resolve().parent.parent / "sample_data" / "sample_reading.json"
    assert sample_file.exists(), f"Sample data file missing at {sample_file}"

    with open(sample_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data["node_id"] == "NODE_01"
    assert data["distance"] == 18.4

    displacement = calculate_displacement(DEFAULT_BASELINE_DISTANCE, data["distance"])
    assert displacement == pytest.approx(1.6)
