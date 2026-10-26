"""Kompletter Durchlauf: FIT-Datei erzeugen, hochladen, Auswertung abrufen."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

fit_tool = pytest.importorskip("fit_tool")
from fit_tool.fit_file_builder import FitFileBuilder  # noqa: E402
from fit_tool.profile.messages.file_id_message import FileIdMessage  # noqa: E402
from fit_tool.profile.messages.record_message import RecordMessage  # noqa: E402
from fit_tool.profile.messages.session_message import SessionMessage  # noqa: E402
from fit_tool.profile.profile_type import FileType, Sport  # noqa: E402


def make_fit(start: datetime, seconds: int = 3600, power: int = 250, hr: int = 150) -> bytes:
    ms = lambda dt: round(dt.timestamp() * 1000)  # noqa: E731
    builder = FitFileBuilder(auto_define=True)
    fid = FileIdMessage()
    fid.type = FileType.ACTIVITY
    fid.time_created = ms(start)
    builder.add(fid)
    for i in range(seconds):
        rec = RecordMessage()
        rec.timestamp = ms(start + timedelta(seconds=i))
        rec.power = power
        rec.heart_rate = hr
        builder.add(rec)
    session = SessionMessage()
    session.start_time = ms(start)
    session.timestamp = ms(start + timedelta(seconds=seconds))
    session.sport = Sport.CYCLING
    session.total_elapsed_time = seconds
    session.total_timer_time = seconds
    session.total_distance = 30000
    builder.add(session)
    return builder.build().to_bytes()


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    from app.main import app

    with TestClient(app) as c:
        yield c


def test_upload_and_curve(client):
    client.post("/settings", data={"ftp": "250", "lthr": "165", "hr_max": "190", "hr_rest": "50"})
    start = datetime(2026, 10, 20, 8, 0, tzinfo=timezone.utc)
    content = make_fit(start)

    resp = client.post("/upload", files=[("files", ("a.fit", content))], follow_redirects=False)
    assert "1%20importiert" in resp.headers["location"]

    # Dieselbe Datei nochmal: keine Dublette
    resp = client.post("/upload", files=[("files", ("a.fit", content))], follow_redirects=False)
    assert "1%20schon%20vorhanden" in resp.headers["location"]

    page = client.get("/activities")
    assert page.status_code == 200 and "Rad" in page.text

    curve = client.get("/api/curve").json()
    idx = curve["days"].index("2026-10-20")
    assert curve["load"][idx] == pytest.approx(100, abs=0.5)
    assert curve["fitness"][idx] == pytest.approx(100 / 42, abs=0.1)

    # FTP ändern → Neuberechnung
    client.post("/settings", data={"ftp": "200", "lthr": "165", "hr_max": "190", "hr_rest": "50"})
    curve = client.get("/api/curve").json()
    assert curve["load"][idx] == pytest.approx(156.25, abs=0.5)

    assert client.get("/").status_code == 200
    assert client.get("/activities/1").status_code == 200
    series = client.get("/api/activities/1/series").json()
    assert series["power"][0] == 250
