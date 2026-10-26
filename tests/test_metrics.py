from datetime import date, timedelta

import pytest

from app.metrics import (
    Athlete,
    compute_load,
    hr_load_from_trimp,
    normalized_power,
    performance_curve,
    power_load,
    trimp,
)


def test_one_hour_at_ftp_is_100():
    assert power_load(3600, 250, 250) == pytest.approx(100)


def test_normalized_power_constant_equals_average():
    assert normalized_power([200.0] * 600) == pytest.approx(200)


def test_normalized_power_rewards_variability():
    intervals = ([300.0] * 60 + [100.0] * 60) * 10
    assert normalized_power(intervals) > sum(intervals) / len(intervals)


def test_hr_load_one_hour_at_threshold_is_100():
    athlete = Athlete(lthr=165, hr_max=190, hr_rest=50)
    t = trimp([165] * 3600, athlete)
    assert hr_load_from_trimp(t, athlete) == pytest.approx(100)


def test_compute_load_prefers_power_over_hr():
    athlete = Athlete(ftp=250, lthr=165, hr_max=190, hr_rest=50)
    result = compute_load(athlete, 3600, power=[250.0] * 3600, hr=[140] * 3600)
    assert result.source == "power"
    assert result.load == pytest.approx(100)


def test_compute_load_falls_back_to_avg_hr():
    athlete = Athlete(lthr=165, hr_max=190, hr_rest=50)
    result = compute_load(athlete, 3600, avg_hr=165)
    assert result.source == "hr_avg"
    assert result.load == pytest.approx(100)


def test_compute_load_without_thresholds():
    assert compute_load(Athlete(), 3600, hr=[150] * 100).load is None


def test_performance_curve_converges_to_constant_load():
    start = date(2026, 1, 1)
    loads = {start + timedelta(days=i): 80.0 for i in range(400)}
    days = performance_curve(loads, start, start + timedelta(days=399))
    assert days[-1].fitness == pytest.approx(80, abs=0.1)
    assert days[-1].fatigue == pytest.approx(80, abs=0.01)
    assert abs(days[-1].form) < 0.1


def test_form_uses_previous_day():
    start = date(2026, 1, 1)
    days = performance_curve({start: 100.0}, start, start + timedelta(days=1))
    assert days[0].form == 0
    assert days[1].form == pytest.approx(100 / 42 - 100 / 7)
