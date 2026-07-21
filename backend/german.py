"""German A1 track: the syllabus as data, completion derived from Planner OS.

Design note: per-unit completion is deliberately NOT stored. Planner OS owns daily
execution and reports a single `german_units_left` in the snapshot; because the A1
units are strictly sequential, that one number determines every unit's status. Keeping
a second copy of "done" in the workbook would let the two drift apart, which is the
failure mode this project has already been bitten by.
"""
from __future__ import annotations

from datetime import date

import pandas as pd

from backend.excel_db import ExcelDB
from backend.planner_sync import read_snapshot
from utils.constants import GERMAN_A1_UNITS
from utils.helpers import parse_date, safe_float

DONE, TODAY, UPCOMING, OVERDUE = "Done", "Today", "Upcoming", "Overdue"


def syllabus() -> pd.DataFrame:
    """The full A1 ladder as a frame: unit, topic, grammar, scheduled date."""
    return pd.DataFrame(GERMAN_A1_UNITS, columns=["unit", "topic", "grammar", "scheduled_date"])


def units_done(db: ExcelDB) -> int:
    """How many units Planner OS says are finished (total - left)."""
    snap = read_snapshot(db)
    total = int(safe_float(snap.get("german_units_total"), len(GERMAN_A1_UNITS)))
    left = int(safe_float(snap.get("german_units_left"), 0))
    return max(total - left, 0)


def unit_table(db: ExcelDB, today: date | None = None) -> pd.DataFrame:
    """Syllabus plus a derived status column. Status comes from the sequence, not a stored flag."""
    today = today or date.today()
    done = units_done(db)
    frame = syllabus()

    def status(row: pd.Series) -> str:
        if int(row["unit"]) <= done:
            return DONE
        scheduled = parse_date(row["scheduled_date"])
        if scheduled is None:
            return UPCOMING
        if scheduled < today:
            return OVERDUE
        return TODAY if scheduled == today else UPCOMING

    frame["status"] = frame.apply(status, axis=1)
    return frame


def grammar_ladder(db: ExcelDB) -> pd.DataFrame:
    """Grammar points in teaching order, with whether you've reached them yet."""
    frame = unit_table(db)
    return frame[["unit", "grammar", "topic", "status"]]


def burndown_series(db: ExcelDB, today: date | None = None) -> pd.DataFrame:
    """Cumulative units: the original schedule vs the pace now required.

    Both series are facts. "Planned" is the schedule as written. "Required now" runs from
    today's real completed count to the full total by the plan end date — i.e. the line you
    must actually hold from here. If it climbs more steeply than Planned, you are behind.

    A historical "actual" curve is deliberately absent: Planner OS reports only a current
    completed count, not per-day history, so any past curve would be invented.
    """
    today = today or date.today()
    frame = syllabus().copy()
    frame["day"] = frame["scheduled_date"].map(parse_date)
    planned = frame.dropna(subset=["day"]).groupby("day").size().sort_index().cumsum()
    if planned.empty:
        return pd.DataFrame(columns=["day", "Planned", "Required now"])

    days = list(planned.index)
    total, done = len(frame), units_done(db)
    end = days[-1]
    remaining_days = max((end - today).days, 0)

    def required(day: date) -> float | None:
        if day < today or remaining_days == 0:
            return None
        share = (day - today).days / remaining_days
        return round(done + (total - done) * share, 2)

    return pd.DataFrame({
        "day": days,
        "Planned": planned.to_numpy(),
        "Required now": [required(d) for d in days],
    })


def track_summary(db: ExcelDB, today: date | None = None) -> dict[str, object]:
    """Headline numbers for the German page."""
    today = today or date.today()
    frame = unit_table(db, today)
    total = len(frame)
    done = units_done(db)
    left = total - done
    overdue = int((frame["status"] == OVERDUE).sum())
    plan_end = parse_date(frame["scheduled_date"].iloc[-1]) if total else None
    days_left = (plan_end - today).days if plan_end else None
    return {
        "total": total,
        "done": done,
        "left": left,
        "overdue": overdue,
        "pct": round(done / total * 100, 1) if total else 0.0,
        "plan_end": plan_end,
        "days_left": days_left,
        "needed_per_day": round(left / days_left, 2) if days_left and days_left > 0 else None,
    }
