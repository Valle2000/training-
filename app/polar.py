"""Polar AccessLink v3: OAuth, Einheiten abrufen, Webhook prüfen.

Doku: https://www.polar.com/accesslink-api/
Die API liefert nur Einheiten der letzten 30 Tage ab Verbindung. Ältere Daten
kommen über den Export in Polar Flow und den FIT-Upload.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import sqlite3
from urllib.parse import urlencode

import httpx

from . import db, service

AUTH_URL = "https://flow.polar.com/oauth2/authorization"
TOKEN_URL = "https://polarremote.com/v2/oauth2/token"
API_URL = "https://www.polaraccesslink.com/v3"


class PolarError(RuntimeError):
    pass


def client_id() -> str | None:
    return os.environ.get("POLAR_CLIENT_ID") or None


def _client_secret() -> str | None:
    return os.environ.get("POLAR_CLIENT_SECRET") or None


def redirect_uri() -> str:
    return os.environ.get("POLAR_REDIRECT_URI", "http://localhost:8000/polar/callback")


def configured() -> bool:
    return bool(client_id() and _client_secret())


def authorization_url(state: str) -> str:
    params = {
        "response_type": "code",
        "client_id": client_id(),
        "redirect_uri": redirect_uri(),
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def exchange_code(conn: sqlite3.Connection, code: str) -> None:
    resp = httpx.post(
        TOKEN_URL,
        auth=(client_id() or "", _client_secret() or ""),
        data={"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri()},
        headers={"Accept": "application/json"},
        timeout=30,
    )
    if resp.status_code != 200:
        raise PolarError(f"Token-Abruf fehlgeschlagen ({resp.status_code}): {resp.text}")
    token = resp.json()
    access_token, user_id = token["access_token"], str(token["x_user_id"])

    # Nutzer bei der eigenen App registrieren; 409 heißt: schon registriert.
    reg = httpx.post(
        f"{API_URL}/users",
        json={"member-id": f"user-{user_id}"},
        headers=_headers(access_token),
        timeout=30,
    )
    if reg.status_code not in (200, 409):
        raise PolarError(f"Registrierung fehlgeschlagen ({reg.status_code}): {reg.text}")

    db.set_settings(conn, {"polar_token": access_token, "polar_user_id": user_id})


def _headers(token: str, accept: str = "application/json") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": accept}


def connected(settings: dict[str, str]) -> bool:
    return bool(settings.get("polar_token"))


def sync(conn: sqlite3.Connection) -> dict[str, int]:
    """Holt alle verfügbaren Einheiten und importiert die FIT-Dateien neuer Einheiten."""
    token = db.get_settings(conn).get("polar_token")
    if not token:
        raise PolarError("Polar ist nicht verbunden")

    with httpx.Client(base_url=API_URL, timeout=60) as client:
        resp = client.get("/exercises", headers=_headers(token))
        if resp.status_code == 401:
            raise PolarError("Polar-Zugang abgelaufen, bitte neu verbinden")
        resp.raise_for_status()
        exercises = resp.json() if resp.content else []

        stats = {"found": len(exercises), "imported": 0, "skipped": 0, "failed": 0}
        for ex in exercises:
            ex_id = str(ex["id"])
            known = conn.execute(
                "SELECT 1 FROM activities WHERE source = 'polar' AND external_id = ?", (ex_id,)
            ).fetchone()
            if known:
                stats["skipped"] += 1
                continue
            fit = client.get(f"/exercises/{ex_id}/fit", headers=_headers(token, "*/*"))
            if fit.status_code != 200 or not fit.content:
                stats["failed"] += 1
                continue
            try:
                _, created = service.import_fit(conn, fit.content, source="polar", external_id=ex_id)
            except Exception:
                stats["failed"] += 1
                continue
            stats["imported" if created else "skipped"] += 1
            conn.commit()
    return stats


def verify_webhook(body: bytes, signature: str | None) -> bool:
    secret = os.environ.get("POLAR_WEBHOOK_SECRET")
    if not secret:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return bool(signature) and hmac.compare_digest(expected, signature)
