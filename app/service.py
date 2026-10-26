"""Import von Einheiten und Auswertungen auf Basis der Datenbank."""

from __future__ import annotations

import hashlib
import io
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from . import db
from .fitfile import ParsedActivity, parse_fit
from .metrics import Athlete, DayState, compute_load, performance_curve

DEFAULT_TZ = "Europe/Berlin"

SPORT_NAMES = {
    "cycling": "Rad",
    "running": "Laufen",
    "swimming": "Schwimmen",
    "walking": "Gehen",
    "hiking": "Wandern",
    "training": "Krafttraining",
    "fitness_equipment": "Fitness",
    "rowing": "Rudern",
    "cross_country_skiing": "Langlauf",
    "generic": "Sonstiges",
}


def _float(value: str | None) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except ValueError:
        return None


def athlete_from_settings(settings: dict[str, str]) -> Athlete:
    return Athlete(
        ftp=_float(settings.get("ftp")),
        lthr=_float(settings.get("lthr")),
        hr_max=_float(settings.get("hr_max")),
        hr_rest=_float(settings.get("hr_rest")),
        sex=settings.get("sex", "m"),
    )


def timezone_from_settings(settings: dict[str, str]) -> ZoneInfo:
    try:
        return ZoneInfo(settings.get("timezone") or DEFAULT_TZ)
    except Exception:
        return ZoneInfo(DEFAULT_TZ)


def _fingerprint(parsed: ParsedActivity) -> str:
    # Auf die Minute gerundet, damit dieselbe Einheit aus Polar und Upload nur einmal zählt.
    key = parsed.start.strftime("%Y-%m-%dT%H:%M")
    return hashlib.sha1(key.encode()).hexdigest()[:16]


def _activity_values(parsed: ParsedActivity, athlete: Athlete, tz: ZoneInfo) -> dict:
    series = parsed.series()
    moving_s = float(len(series["t"])) or parsed.elapsed_s
    result = compute_load(
        athlete,
        duration_s=moving_s,
        power=series["power"],
        hr=series["hr"],
        avg_hr=parsed.avg_hr,
    )
    sport = parsed.sport.lower()
    return {
        "start_time": parsed.start.isoformat(),
        "local_date": parsed.start.astimezone(tz).date().isoformat(),
        "sport": sport,
        "name": SPORT_NAMES.get(sport, sport.replace("_", " ").title()),
        "duration_s": parsed.elapsed_s,
        "moving_s": moving_s,
        "distance_m": parsed.distance_m,
        "avg_hr": parsed.avg_hr,
        "max_hr": parsed.max_hr,
        "avg_power": parsed.avg_power,
        "normalized_power": result.normalized_power,
        "intensity": result.intensity,
        "trimp": result.trimp,
        "load": result.load,
        "load_source": result.source,
        "calories": parsed.calories,
    }


def import_fit(
    conn: sqlite3.Connection,
    content: bytes,
    source: str = "upload",
    external_id: str | None = None,
) -> tuple[int, bool]:
    """Speichert eine FIT-Datei und legt die Einheit an. Gibt (id, neu_angelegt) zurück."""
    if external_id:
        row = conn.execute(
            "SELECT id FROM activities WHERE source = ? AND external_id = ?", (source, external_id)
        ).fetchone()
        if row:
            return row["id"], False

    parsed = parse_fit(io.BytesIO(content))
    fingerprint = _fingerprint(parsed)
    row = conn.execute("SELECT id FROM activities WHERE fingerprint = ?", (fingerprint,)).fetchone()
    if row:
        return row["id"], False

    settings = db.get_settings(conn)
    values = _activity_values(parsed, athlete_from_settings(settings), timezone_from_settings(settings))

    fit_dir = db.data_dir() / "fit"
    fit_path = fit_dir / f"{parsed.start.strftime('%Y%m%dT%H%M%S')}_{fingerprint}.fit"
    fit_path.write_bytes(content)

    values.update(source=source, external_id=external_id, fingerprint=fingerprint, fit_path=fit_path.name)
    columns = ", ".join(values)
    placeholders = ", ".join("?" for _ in values)
    cur = conn.execute(f"INSERT INTO activities ({columns}) VALUES ({placeholders})", tuple(values.values()))
    return cur.lastrowid, True


def recompute_all(conn: sqlite3.Connection) -> int:
    """Berechnet alle Einheiten neu, z. B. nach geänderter FTP oder Schwelle."""
    settings = db.get_settings(conn)
    athlete = athlete_from_settings(settings)
    tz = timezone_from_settings(settings)
    fit_dir = db.data_dir() / "fit"
    count = 0
    for row in conn.execute("SELECT id, fit_path FROM activities WHERE fit_path IS NOT NULL").fetchall():
        path = fit_dir / row["fit_path"]
        if not path.exists():
            continue
        values = _activity_values(parse_fit(str(path)), athlete, tz)
        values.pop("name")
        assignments = ", ".join(f"{k} = ?" for k in values)
        conn.execute(f"UPDATE activities SET {assignments} WHERE id = ?", (*values.values(), row["id"]))
        count += 1
    return count


def activity_series(conn: sqlite3.Connection, activity_id: int) -> dict[str, list] | None:
    row = conn.execute("SELECT fit_path FROM activities WHERE id = ?", (activity_id,)).fetchone()
    if not row or not row["fit_path"]:
        return None
    path: Path = db.data_dir() / "fit" / row["fit_path"]
    if not path.exists():
        return None
    return parse_fit(str(path)).series()


def daily_loads(conn: sqlite3.Connection) -> dict[date, float]:
    rows = conn.execute(
        "SELECT local_date, SUM(COALESCE(load, 0)) AS load FROM activities GROUP BY local_date"
    ).fetchall()
    return {date.fromisoformat(r["local_date"]): r["load"] for r in rows}


def curve(conn: sqlite3.Connection, today: date | None = None, future_days: int = 14) -> list[DayState]:
    loads = daily_loads(conn)
    if not loads:
        return []
    tz = timezone_from_settings(db.get_settings(conn))
    today = today or datetime.now(tz).date()
    start = min(loads)
    end = max(max(loads), today) + timedelta(days=future_days)
    return performance_curve(loads, start, end)
