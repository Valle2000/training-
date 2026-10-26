"""Web-Oberfläche und API."""

from __future__ import annotations

import secrets
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from . import db, polar, service

BASE = Path(__file__).parent
templates = Jinja2Templates(directory=BASE / "templates")


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init()
    yield


app = FastAPI(title="Training", lifespan=lifespan)


def _fmt_duration(seconds: float | None) -> str:
    if not seconds:
        return "–"
    seconds = int(seconds)
    return f"{seconds // 3600}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def _fmt_num(value: float | None, digits: int = 0) -> str:
    return "–" if value is None else f"{value:.{digits}f}".replace(".", ",")


templates.env.filters["duration"] = _fmt_duration
templates.env.filters["num"] = _fmt_num


def _redirect(path: str, msg: str) -> RedirectResponse:
    return RedirectResponse(f"{path}?msg={quote(msg)}", status_code=303)


def _render(request: Request, name: str, **ctx) -> HTMLResponse:
    return templates.TemplateResponse(request, name, ctx)


@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request, msg: str | None = None):
    with db.connect() as conn:
        settings = db.get_settings(conn)
        days = service.curve(conn)
        recent = conn.execute("SELECT * FROM activities ORDER BY start_time DESC LIMIT 10").fetchall()
        week_start = date.today() - timedelta(days=date.today().weekday())
        week = conn.execute(
            "SELECT COUNT(*) AS n, SUM(moving_s) AS s, SUM(load) AS load, SUM(distance_m) AS dist "
            "FROM activities WHERE local_date >= ?",
            (week_start.isoformat(),),
        ).fetchone()
    today = next((d for d in days if d.day == date.today()), None)
    return _render(
        request,
        "dashboard.html",
        today=today,
        recent=recent,
        week=week,
        msg=msg,
        athlete=service.athlete_from_settings(settings),
        polar_configured=polar.configured(),
        polar_connected=polar.connected(settings),
    )


@app.get("/activities", response_class=HTMLResponse)
def activities(request: Request):
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM activities ORDER BY start_time DESC").fetchall()
    return _render(request, "activities.html", activities=rows)


@app.get("/activities/{activity_id}", response_class=HTMLResponse)
def activity_detail(request: Request, activity_id: int):
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM activities WHERE id = ?", (activity_id,)).fetchone()
    if not row:
        raise HTTPException(404)
    return _render(request, "activity.html", a=row)


@app.post("/activities/{activity_id}/delete")
def activity_delete(activity_id: int):
    with db.connect() as conn:
        row = conn.execute("SELECT fit_path FROM activities WHERE id = ?", (activity_id,)).fetchone()
        if row and row["fit_path"]:
            (db.data_dir() / "fit" / row["fit_path"]).unlink(missing_ok=True)
        conn.execute("DELETE FROM activities WHERE id = ?", (activity_id,))
    return RedirectResponse("/activities", status_code=303)


@app.post("/upload")
async def upload(files: list[UploadFile] = File(...)):
    imported = skipped = failed = 0
    with db.connect() as conn:
        for f in files:
            try:
                _, created = service.import_fit(conn, await f.read())
            except Exception:
                failed += 1
                continue
            if created:
                imported += 1
            else:
                skipped += 1
    msg = f"{imported} importiert, {skipped} schon vorhanden, {failed} fehlerhaft"
    return _redirect("/", msg)


@app.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request, msg: str | None = None):
    with db.connect() as conn:
        settings = db.get_settings(conn)
    return _render(
        request,
        "settings.html",
        s=settings,
        msg=msg,
        polar_configured=polar.configured(),
        polar_connected=polar.connected(settings),
        redirect_uri=polar.redirect_uri(),
    )


@app.post("/settings")
def settings_save(
    ftp: str = Form(""),
    lthr: str = Form(""),
    hr_max: str = Form(""),
    hr_rest: str = Form(""),
    sex: str = Form("m"),
    timezone: str = Form(service.DEFAULT_TZ),
):
    with db.connect() as conn:
        db.set_settings(
            conn,
            {"ftp": ftp, "lthr": lthr, "hr_max": hr_max, "hr_rest": hr_rest, "sex": sex, "timezone": timezone},
        )
        count = service.recompute_all(conn)
    return _redirect("/settings", f"Gespeichert, {count} Einheiten neu berechnet")


# --- Polar -------------------------------------------------------------------


@app.get("/polar/connect")
def polar_connect():
    if not polar.configured():
        raise HTTPException(400, "POLAR_CLIENT_ID und POLAR_CLIENT_SECRET fehlen")
    state = secrets.token_urlsafe(16)
    with db.connect() as conn:
        db.set_settings(conn, {"polar_oauth_state": state})
    return RedirectResponse(polar.authorization_url(state))


@app.get("/polar/callback")
def polar_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error or not code:
        return _redirect("/settings", f"Polar-Verbindung abgebrochen: {error or 'kein Code'}")
    with db.connect() as conn:
        expected = db.get_settings(conn).get("polar_oauth_state")
        if not expected or not secrets.compare_digest(expected, state or ""):
            raise HTTPException(400, "Ungültiger OAuth-State")
        db.set_settings(conn, {"polar_oauth_state": None})
        try:
            polar.exchange_code(conn, code)
        except polar.PolarError as exc:
            return _redirect("/settings", str(exc))
    return _redirect("/settings", "Polar verbunden")


@app.post("/polar/sync")
def polar_sync():
    with db.connect() as conn:
        try:
            stats = polar.sync(conn)
        except polar.PolarError as exc:
            return _redirect("/", str(exc))
    msg = f"Polar: {stats['imported']} neu, {stats['skipped']} bekannt, {stats['failed']} Fehler"
    return _redirect("/", msg)


@app.post("/polar/webhook")
async def polar_webhook(request: Request):
    body = await request.body()
    payload = await request.json() if body else {}
    if payload.get("event") == "PING":
        return {"ok": True}
    if not polar.verify_webhook(body, request.headers.get("Polar-Webhook-Signature")):
        raise HTTPException(401, "Ungültige Signatur")
    if payload.get("event") == "EXERCISE":
        with db.connect() as conn:
            polar.sync(conn)
    return {"ok": True}


# --- JSON-API für Diagramme ----------------------------------------------------


@app.get("/api/curve")
def api_curve(future_days: int = 14):
    with db.connect() as conn:
        days = service.curve(conn, future_days=future_days)
    return JSONResponse(
        {
            "days": [d.day.isoformat() for d in days],
            "load": [round(d.load, 1) for d in days],
            "fitness": [round(d.fitness, 1) for d in days],
            "fatigue": [round(d.fatigue, 1) for d in days],
            "form": [round(d.form, 1) for d in days],
            "today": date.today().isoformat(),
        }
    )


@app.get("/api/activities/{activity_id}/series")
def api_series(activity_id: int):
    with db.connect() as conn:
        series = service.activity_series(conn, activity_id)
    if series is None:
        raise HTTPException(404)
    # Für die Anzeige auf 5-s-Schritte ausdünnen.
    step = 5
    return {k: v[::step] for k, v in series.items()}
