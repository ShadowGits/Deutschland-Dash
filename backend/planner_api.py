"""Read-only client for the Planner OS v2 strategic API.

Contract: docs/dashboard_integration.md in ShadowGits/Planner-OS.

This is the *strategic* layer — projects, milestones, deadlines, streaks. It is
deliberately additive: the German A1 rollup keeps coming from the workbook snapshot
(`german_units_left`), and nothing here may overwrite it. The `flat` block returned by
the API uses project-track slugs (`germany_move_*`), which are NOT the same series as
the workbook's `german_*` keys — conflating them would silently corrupt German progress.

Every call fails soft: on any error the caller gets `None` plus a human-readable reason,
so a dead API degrades the page to "unavailable" rather than crashing the dashboard.
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
METRICS_PATH = "/v2/metrics"
TIMEOUT_SECONDS = 12
TOKEN_ENV_VAR = "PLANNER_API_TOKEN"


def resolve_token(explicit: str | None = None) -> str | None:
    """Token from the caller, else the environment. Never hardcoded, never logged."""
    return explicit or os.environ.get(TOKEN_ENV_VAR) or None


def fetch_metrics_with_status(
    token: str | None = None,
    base_url: str | None = None,
    timeout: int = TIMEOUT_SECONDS,
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (snapshot, error). Exactly one is non-None.

    The error string is safe to show in the UI — it never contains the token.
    """
    resolved = resolve_token(token)
    if not resolved:
        return None, f"No API token configured. Set {TOKEN_ENV_VAR} in the environment or Streamlit secrets."

    url = f"{(base_url or BASE_URL).rstrip('/')}{METRICS_PATH}"
    request = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {resolved}",
        "Accept": "application/json",
    })

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        hint = " — check the token is the MCP API key" if exc.code in (401, 403) else ""
        logger.warning("Planner API HTTP %s", exc.code)
        return None, f"Planner OS API returned HTTP {exc.code}{hint}."
    except urllib.error.URLError as exc:
        logger.warning("Planner API unreachable: %s", exc.reason)
        return None, f"Could not reach the Planner OS API ({exc.reason})."
    except (TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.warning("Planner API bad response: %s", exc)
        return None, f"Planner OS API returned an unreadable response ({type(exc).__name__})."

    if not isinstance(payload, dict) or not payload.get("success"):
        return None, "Planner OS API reported failure."

    snapshot = (payload.get("data") or {}).get("snapshot")
    if not isinstance(snapshot, dict):
        return None, "Planner OS API response contained no snapshot."
    return snapshot, None


def fetch_metrics(token: str | None = None, base_url: str | None = None) -> dict[str, Any] | None:
    """Contract-shaped helper: the snapshot, or None on any error."""
    snapshot, _ = fetch_metrics_with_status(token=token, base_url=base_url)
    return snapshot


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
