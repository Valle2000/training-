"""FIT-Dateien einlesen und auf ein 1-Hz-Raster bringen."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import BinaryIO

import fitdecode

# Lücken bis zu dieser Länge werden mit dem letzten Wert gefüllt, längere gelten als Pause.
MAX_GAP_S = 5


@dataclass
class Record:
    time: datetime
    hr: float | None = None
    power: float | None = None
    speed: float | None = None  # m/s
    cadence: float | None = None
    altitude: float | None = None


@dataclass
class ParsedActivity:
    start: datetime
    sport: str
    sub_sport: str | None
    elapsed_s: float
    distance_m: float | None
    avg_hr: float | None
    max_hr: float | None
    avg_power: float | None
    calories: float | None
    records: list[Record] = field(default_factory=list)

    def series(self) -> dict[str, list]:
        """1-Hz-Reihen über die Bewegungszeit (Pausen > MAX_GAP_S entfernt)."""
        out: dict[str, list] = {"t": [], "hr": [], "power": [], "speed": [], "cadence": [], "altitude": []}
        if not self.records:
            return out
        prev = None
        elapsed = 0
        for rec in self.records:
            if prev is not None:
                gap = int(round((rec.time - prev.time).total_seconds()))
                if gap <= 0:
                    continue
                fill = gap - 1 if gap <= MAX_GAP_S else 0
                for _ in range(fill):
                    elapsed += 1
                    _append(out, elapsed, prev)
                elapsed += 1
            _append(out, elapsed, rec)
            prev = rec
        return out


def _append(out: dict[str, list], t: int, rec: Record) -> None:
    out["t"].append(t)
    out["hr"].append(rec.hr)
    out["power"].append(rec.power)
    out["speed"].append(rec.speed)
    out["cadence"].append(rec.cadence)
    out["altitude"].append(rec.altitude)


def _get(frame: fitdecode.FitDataMessage, *names: str):
    for name in names:
        if frame.has_field(name):
            value = frame.get_value(name)
            if value is not None:
                return value
    return None


def _as_utc(ts: datetime) -> datetime:
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def parse_fit(source: str | BinaryIO) -> ParsedActivity:
    session = None
    records: list[Record] = []
    with fitdecode.FitReader(source, check_crc=fitdecode.CrcCheck.WARN) as fit:
        for frame in fit:
            if not isinstance(frame, fitdecode.FitDataMessage):
                continue
            if frame.name == "record":
                ts = _get(frame, "timestamp")
                if ts is None:
                    continue
                records.append(
                    Record(
                        time=_as_utc(ts),
                        hr=_get(frame, "heart_rate"),
                        power=_get(frame, "power"),
                        speed=_get(frame, "enhanced_speed", "speed"),
                        cadence=_get(frame, "cadence"),
                        altitude=_get(frame, "enhanced_altitude", "altitude"),
                    )
                )
            elif frame.name == "session" and session is None:
                session = {
                    "start": _get(frame, "start_time"),
                    "sport": _get(frame, "sport"),
                    "sub_sport": _get(frame, "sub_sport"),
                    "elapsed": _get(frame, "total_elapsed_time", "total_timer_time"),
                    "distance": _get(frame, "total_distance"),
                    "avg_hr": _get(frame, "avg_heart_rate"),
                    "max_hr": _get(frame, "max_heart_rate"),
                    "avg_power": _get(frame, "avg_power"),
                    "calories": _get(frame, "total_calories"),
                }

    records.sort(key=lambda r: r.time)
    session = session or {}
    start = session.get("start") or (records[0].time if records else None)
    if start is None:
        raise ValueError("FIT-Datei enthält weder Session noch Messpunkte")
    elapsed = session.get("elapsed")
    if elapsed is None and records:
        elapsed = (records[-1].time - records[0].time).total_seconds()
    hrs = [r.hr for r in records if r.hr]
    return ParsedActivity(
        start=_as_utc(start),
        sport=str(session.get("sport") or "generic"),
        sub_sport=str(session["sub_sport"]) if session.get("sub_sport") else None,
        elapsed_s=float(elapsed or 0),
        distance_m=session.get("distance"),
        avg_hr=session.get("avg_hr") or (sum(hrs) / len(hrs) if hrs else None),
        max_hr=session.get("max_hr") or (max(hrs) if hrs else None),
        avg_power=session.get("avg_power"),
        calories=session.get("calories"),
        records=records,
    )
