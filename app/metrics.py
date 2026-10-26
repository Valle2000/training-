"""Belastungs- und Formberechnung.

Begriffe (eigene Namen statt der TrainingPeaks-Marken):
- Belastung: Punktwert pro Einheit, 1 h an der Schwelle = 100 (entspricht TSS)
- Fitness:   exponentiell gewichteter Schnitt der Belastung über 42 Tage (CTL)
- Ermüdung:  dasselbe über 7 Tage (ATL)
- Form:      Fitness − Ermüdung des Vortags (TSB)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable, Sequence

FITNESS_DAYS = 42
FATIGUE_DAYS = 7


@dataclass
class Athlete:
    ftp: float | None = None  # Watt
    lthr: float | None = None  # Laktatschwellen-Puls
    hr_max: float | None = None
    hr_rest: float | None = None
    sex: str = "m"  # "m" oder "f", nur für den TRIMP-Gewichtungsfaktor


def normalized_power(power: Sequence[float | None], window: int = 30) -> float | None:
    """NP aus 1-Hz-Leistungswerten: 4. Wurzel des Mittels der 30-s-Gleitmittel hoch 4."""
    values = [p or 0.0 for p in power]
    if len(values) < window:
        return None
    rolling = []
    acc = sum(values[:window])
    rolling.append(acc / window)
    for i in range(window, len(values)):
        acc += values[i] - values[i - window]
        rolling.append(acc / window)
    mean4 = sum(r**4 for r in rolling) / len(rolling)
    return mean4**0.25


def power_load(duration_s: float, np_watts: float, ftp: float) -> float:
    """Belastung aus Leistung: Dauer × NP × IF / (FTP × 3600) × 100."""
    intensity = np_watts / ftp
    return duration_s * np_watts * intensity / (ftp * 3600) * 100


def _trimp_factor(hr_ratio: float, sex: str) -> float:
    a, b = (0.86, 1.67) if sex == "f" else (0.64, 1.92)
    return hr_ratio * a * math.exp(b * hr_ratio)


def trimp(hr: Iterable[float | None], athlete: Athlete, dt_s: float = 1.0) -> float | None:
    """Banister-TRIMP aus Pulswerten in festem Zeitraster (Standard 1 s)."""
    if not (athlete.hr_max and athlete.hr_rest) or athlete.hr_max <= athlete.hr_rest:
        return None
    reserve = athlete.hr_max - athlete.hr_rest
    total = 0.0
    seen = False
    for h in hr:
        if not h:
            continue
        seen = True
        ratio = min(max((h - athlete.hr_rest) / reserve, 0.0), 1.0)
        total += _trimp_factor(ratio, athlete.sex) * dt_s / 60
    return total if seen else None


def hr_load_from_trimp(trimp_value: float, athlete: Athlete) -> float | None:
    """Skaliert TRIMP so, dass 1 h an der Laktatschwelle 100 Punkte ergibt."""
    if not (athlete.lthr and athlete.hr_max and athlete.hr_rest):
        return None
    reserve = athlete.hr_max - athlete.hr_rest
    ratio = min(max((athlete.lthr - athlete.hr_rest) / reserve, 0.0), 1.0)
    one_hour_at_threshold = _trimp_factor(ratio, athlete.sex) * 60
    if one_hour_at_threshold <= 0:
        return None
    return trimp_value / one_hour_at_threshold * 100


@dataclass
class LoadResult:
    load: float | None
    source: str | None  # "power", "hr", "hr_avg"
    normalized_power: float | None = None
    intensity: float | None = None
    trimp: float | None = None


def compute_load(
    athlete: Athlete,
    duration_s: float,
    power: Sequence[float | None] | None = None,
    hr: Sequence[float | None] | None = None,
    avg_hr: float | None = None,
) -> LoadResult:
    """Wählt die beste verfügbare Methode: Leistung > Pulsverlauf > Durchschnittspuls."""
    np_watts = None
    if power and any(power):
        np_watts = normalized_power(power)
    t = trimp(hr, athlete) if hr and any(hr) else None

    if np_watts and athlete.ftp:
        return LoadResult(
            load=power_load(duration_s, np_watts, athlete.ftp),
            source="power",
            normalized_power=np_watts,
            intensity=np_watts / athlete.ftp,
            trimp=t,
        )
    if t is not None:
        return LoadResult(hr_load_from_trimp(t, athlete), "hr", np_watts, None, t)
    if avg_hr and duration_s:
        t = trimp([avg_hr], athlete, dt_s=duration_s)
        if t is not None:
            return LoadResult(hr_load_from_trimp(t, athlete), "hr_avg", np_watts, None, t)
    return LoadResult(None, None, np_watts)


@dataclass
class DayState:
    day: date
    load: float
    fitness: float
    fatigue: float
    form: float


def performance_curve(
    daily_load: dict[date, float],
    start: date,
    end: date,
    fitness0: float = 0.0,
    fatigue0: float = 0.0,
    fitness_days: int = FITNESS_DAYS,
    fatigue_days: int = FATIGUE_DAYS,
) -> list[DayState]:
    """Tagesverlauf von Fitness, Ermüdung und Form zwischen start und end (inklusive)."""
    fitness, fatigue = fitness0, fatigue0
    out: list[DayState] = []
    day = start
    while day <= end:
        load = daily_load.get(day, 0.0)
        form = fitness - fatigue
        fitness += (load - fitness) / fitness_days
        fatigue += (load - fatigue) / fatigue_days
        out.append(DayState(day, load, fitness, fatigue, form))
        day += timedelta(days=1)
    return out
