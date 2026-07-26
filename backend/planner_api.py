"""Read-only client for the Planner OS dashboard API.

Contract: docs/dashboard_wiring.md in ShadowGits/Planner-OS.

Uses `GET /v2/dashboard/metrics`, the key-guarded route meant for headless clients.
The older `/v2/metrics` is gated behind OAuth (`Depends(current_user)`) and cannot be
satisfied with a simple key, so it is not used here.

Auth is the `X-App-Key` header — the same trust model as the PWA. The key comes from
the environment or Streamlit secrets and is never hardcoded, logged, or surfaced in an
error message.

The dashboard is a *view*: this module only ever reads. Writes belong to MCP, the
Telegram bot, and the PWA, so a bug here can never corrupt the planner.

Every call fails soft — on any error the caller gets `None` plus a human-readable
reason, so a dead API degrades a page instead of crashing the dashboard.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)

BASE_URL = os.environ.get("PLANNER_API_BASE_URL", "https://planner-os-api-645411441153.us-central1.run.app")
METRICS_PATH = "/v2/dashboard/metrics"
TIMEOUT_SECONDS = 12

# Primary name, plus the shorter one used in the wiring doc's secrets example.
KEY_ENV_VARS = ("PLANNER_APP_KEY", "APP_KEY")


def resolve_key(explicit: str | None = None) -> str | None:
    """Key from the caller, else the environment. Never hardcoded, never logged."""
    if explicit:
        return explicit
    for name in KEY_ENV_VARS:
        value = os.environ.get(name)
        if value:
            return value
    return None


def fetch_dashboard_with_status(
    key: str | None = None,
    base_url: str | None = None,
    timeout: int = TIMEOUT_SECONDS,
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (payload_data, error). Exactly one is non-None.

    `payload_data` is the API's `data` object, holding both `snapshot` and `flat`.
    The error string is safe to display — it never contains the key.
    """
    resolved = resolve_key(key)
    if not resolved:
        return None, f"No app key configured. Set {KEY_ENV_VARS[0]} in the environment or Streamlit secrets."

    url = f"{(base_url or BASE_URL).rstrip('/')}{METRICS_PATH}"
    request = urllib.request.Request(url, headers={
        "X-App-Key": resolved,
        "Accept": "application/json",
    })

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        hint = " — the X-App-Key was rejected" if exc.code in (401, 403) else ""
        logger.warning("Planner dashboard API HTTP %s", exc.code)
        return None, f"Planner OS API returned HTTP {exc.code}{hint}."
    except urllib.error.URLError as exc:
        logger.warning("Planner dashboard API unreachable: %s", exc.reason)
        return None, f"Could not reach the Planner OS API ({exc.reason})."
    except (TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.warning("Planner dashboard API bad response: %s", exc)
        return None, f"Planner OS API returned an unreadable response ({type(exc).__name__})."

    if not isinstance(payload, dict) or not payload.get("success", True):
        message = payload.get("message") if isinstance(payload, dict) else None
        return None, f"Planner OS API reported failure{f': {message}' if message else '.'}"

    data = payload.get("data")
    if not isinstance(data, dict) or "snapshot" not in data:
        return None, "Planner OS API response contained no snapshot."
    return data, None


def fetch_metrics_with_status(
    key: str | None = None,
    base_url: str | None = None,
    timeout: int = TIMEOUT_SECONDS,
) -> tuple[dict[str, Any] | None, str | None]:
    """Just the computed snapshot, or (None, reason)."""
    data, error = fetch_dashboard_with_status(key=key, base_url=base_url, timeout=timeout)
    if data is None:
        return None, error
    snapshot = data.get("snapshot")
    if not isinstance(snapshot, dict):
        return None, "Planner OS API response contained no snapshot."
    return snapshot, None


def fetch_metrics(key: str | None = None, base_url: str | None = None) -> dict[str, Any] | None:
    """Contract-shaped helper: the snapshot, or None on any error."""
    snapshot, _ = fetch_metrics_with_status(key=key, base_url=base_url)
    return snapshot


def flat_map(data: dict[str, Any] | None) -> dict[str, str]:
    """The API's flat key/value map — the single source of truth for track progress.

    Keys like `german_units_total`, `german_units_left`, `german_target_date` are read
    directly by the Language page and pace panel.
    """
    raw = (data or {}).get("flat") or {}
    return {str(k): str(v) for k, v in raw.items()}


def projects(snapshot: dict[str, Any] | None) -> list[dict[str, Any]]:
    return list((snapshot or {}).get("projects") or [])


def upcoming_deadlines(snapshot: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Deadlines soonest-first; overdue ones lead."""
    items = list((snapshot or {}).get("upcoming_deadlines") or [])
    return sorted(items, key=lambda d: (not d.get("overdue"), d.get("days_left") if d.get("days_left") is not None else 10**6))


def streaks(snapshot: dict[str, Any] | None) -> dict[str, int]:
    raw = (snapshot or {}).get("streaks") or {}
    return {str(k): int(v) for k, v in raw.items() if str(v).lstrip("-").isdigit()}


def totals(snapshot: dict[str, Any] | None) -> dict[str, Any]:
    return dict((snapshot or {}).get("totals") or {})


def _make_request(
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    key: str | None = None,
    base_url: str | None = None,
    timeout: int = TIMEOUT_SECONDS,
) -> tuple[dict[str, Any] | None, str | None]:
    resolved = resolve_key(key)
    if not resolved:
        return None, f"No app key configured."

    url = f"{(base_url or BASE_URL).rstrip('/')}{path}"
    headers = {
        "X-App-Key": resolved,
        "Accept": "application/json",
    }
    
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            resp_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            err_body = json.loads(exc.read().decode("utf-8"))
            msg = err_body.get("detail", {}).get("message", "Unknown error")
            return None, f"HTTP {exc.code}: {msg}"
        except Exception:
            return None, f"Planner OS API returned HTTP {exc.code}."
    except Exception as exc:
        logger.warning("Planner API error: %s", exc)
        return None, f"Request failed: {exc}"

    if not isinstance(resp_payload, dict) or not resp_payload.get("success", True):
        message = resp_payload.get("message") if isinstance(resp_payload, dict) else None
        return None, f"Planner OS API reported failure: {message}"

    return resp_payload.get("data", {}), None


def fetch_week_view(date_str: str | None = None, key: str | None = None) -> tuple[dict[str, Any] | None, str | None]:
    """Fetch tasks and goals for the week of date_str (YYYY-MM-DD)."""
    path = "/v2/week"
    if date_str:
        path += f"?date={date_str}"
    return _make_request("GET", path, key=key)


def update_task_status(task_id: str, done: bool, key: str | None = None) -> tuple[dict[str, Any] | None, str | None]:
    """Mark a task done or todo."""
    path = f"/v2/day/tasks/{task_id}"
    return _make_request("PATCH", path, {"done": done}, key=key)


def update_monthly_goal(goal_id: str, description: str, key: str | None = None) -> tuple[dict[str, Any] | None, str | None]:
    """Update a monthly goal's description."""
    path = f"/v2/goals/monthly/{goal_id}"
    return _make_request("PATCH", path, {"description": description}, key=key)


def add_monthly_goal(project_id: str, month: str, description: str, key: str | None = None) -> tuple[dict[str, Any] | None, str | None]:
    """Create a new monthly goal."""
    path = "/v2/goals/monthly"
    payload = {
        "project_id": project_id,
        "month": month,
        "description": description
    }
    return _make_request("POST", path, payload, key=key)
