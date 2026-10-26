"""SQLite-Speicher für Einheiten, Einstellungen und Polar-Zugang."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,           -- "polar", "upload"
    external_id TEXT,               -- z. B. Polar-Exercise-ID
    fingerprint TEXT UNIQUE,        -- Startzeit + Sportart, verhindert Dubletten
    start_time TEXT NOT NULL,       -- ISO 8601, UTC
    local_date TEXT NOT NULL,       -- YYYY-MM-DD in lokaler Zeit
    sport TEXT,
    name TEXT,
    duration_s REAL,
    moving_s REAL,
    distance_m REAL,
    avg_hr REAL,
    max_hr REAL,
    avg_power REAL,
    normalized_power REAL,
    intensity REAL,
    trimp REAL,
    load REAL,
    load_source TEXT,
    calories REAL,
    fit_path TEXT,
    UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities (local_date);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""


def data_dir() -> Path:
    path = Path(os.environ.get("DATA_DIR", "./data"))
    path.mkdir(parents=True, exist_ok=True)
    (path / "fit").mkdir(exist_ok=True)
    return path


def db_path() -> Path:
    return data_dir() / "training.db"


@contextmanager
def connect():
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)


def get_settings(conn: sqlite3.Connection) -> dict[str, str]:
    return {row["key"]: row["value"] for row in conn.execute("SELECT key, value FROM settings")}


def set_settings(conn: sqlite3.Connection, values: dict[str, str | None]) -> None:
    for key, value in values.items():
        if value is None or value == "":
            conn.execute("DELETE FROM settings WHERE key = ?", (key,))
        else:
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, str(value)),
            )
