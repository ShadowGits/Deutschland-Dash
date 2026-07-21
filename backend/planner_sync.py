"""Bridge between Planner OS (daily execution) and the dashboard (strategic view).

Design split: intelligence (breaking goals into units, replanning gaps) is done by
Claude and lands in Planner OS. This module only holds the *deterministic* side —
storing the latest snapshot Claude writes and computing burn-down pace from it.
The Streamlit app cannot call Planner OS live, so it always reads the last snapshot.
"""
from __future__ import annotations

import math
from datetime import date
from typing import Any

import pandas as pd

from backend.excel_db import ExcelDB
from utils.helpers import now_str, parse_date, safe_float

SNAPSHOT_SHEET = "Planner_Snapshot"

# Default daily capacity per track (units/sessions the plan assumes you can do per day).
DAILY_CAPACITY = {"german": 2, "ignou": 1}


def write_snapshot(db: ExcelDB, metrics: dict[str, Any]) -> None:
    """Persist a flat {metric: value} snapshot plus a sync timestamp."""
    stamp = now_str()
    rows = [{"metric": key, "value": str(value), "updated_at": stamp} for key, value in metrics.items()]
    rows.append({"metric": "last_synced", "value": stamp, "updated_at": stamp})
    db.write(SNAPSHOT_SHEET, pd.DataFrame(rows, columns=["metric", "value", "updated_at"]))


def read_snapshot(db: ExcelDB) -> dict[str, str]:
    df = db.read(SNAPSHOT_SHEET)
    if df.empty:
        return {}
    return {str(row["metric"]): str(row["value"]) for _, row in df.iterrows()}


def _days_until(value: Any, today: date | None = None) -> int | None:
    target = parse_date(value)
    if target is None:
        return None
    return (target - (today or date.today())).days


def burndown(snapshot: dict[str, str], track: str, today: date | None = None) -> dict[str, Any]:
    """Compute deterministic pace for a track from its snapshot facts.

    Expects snapshot keys `<track>_units_total`, `<track>_units_left`,
    `<track>_plan_end`, `<track>_target_date`. Returns pace fields for the UI.
    """
    total = int(safe_float(snapshot.get(f"{track}_units_total"), 0))
    left = int(safe_float(snapshot.get(f"{track}_units_left"), 0))
    done = max(total - left, 0)
    capacity = DAILY_CAPACITY.get(track, 1)
    days_to_target = _days_until(snapshot.get(f"{track}_target_date"), today)
    days_to_plan_end = _days_until(snapshot.get(f"{track}_plan_end"), today)

    pct_done = round((done / total) * 100, 1) if total else 0.0
    needed_per_day = round(left / days_to_target, 2) if days_to_target and days_to_target > 0 else None
    # Days of slack: how many spare days remain after clearing the backlog at capacity.
    days_needed_at_capacity = math.ceil(left / capacity) if capacity else left
    buffer_days = (days_to_target - days_needed_at_capacity) if days_to_target is not None else None
    if days_to_target is not None and days_to_target <= 0:
        status = "Due"
    elif buffer_days is None:
        status = "Unknown"
    elif buffer_days < 0:
        status = "Behind"
    elif buffer_days <= 2:
        status = "Tight"
    else:
        status = "On pace"

    return {
        "total": total,
        "done": done,
        "left": left,
        "pct_done": pct_done,
        "capacity": capacity,
        "days_to_target": days_to_target,
        "days_to_plan_end": days_to_plan_end,
        "needed_per_day": needed_per_day,
        "buffer_days": buffer_days,
        "status": status,
    }
