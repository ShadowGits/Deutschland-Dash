"""German A1 track: the syllabus as data, completion from Planner OS API.

Per-unit completion is NOT stored in the dashboard. Planner OS owns daily execution;
the dashboard reads the live count from the API's flat_map. Because the A1 units are
strictly sequential, a single "done" number determines every unit's status.
"""
from __future__ import annotations

from datetime import date

import pandas as pd

from utils.constants import GERMAN_A1_UNITS
from utils.helpers import parse_date

DONE, TODAY, UPCOMING, OVERDUE = "Done", "Today", "Upcoming", "Overdue"
TOTAL_UNITS = len(GERMAN_A1_UNITS)


def syllabus() -> pd.DataFrame:
    """The full A1 ladder as a frame: unit, topic, grammar, scheduled date."""
    return pd.DataFrame(GERMAN_A1_UNITS, columns=["unit", "topic", "grammar", "scheduled_date"])


def unit_table(done: int = 0, today: date | None = None) -> pd.DataFrame:
    """Syllabus plus a derived status column."""
    today = today or date.today()
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


def grammar_ladder(done: int = 0) -> pd.DataFrame:
    """Grammar points in teaching order, with whether you've reached them yet."""
    frame = unit_table(done)
    return frame[["unit", "grammar", "topic", "status"]]


def burndown_series(done: int = 0, today: date | None = None) -> pd.DataFrame:
    """Cumulative units: the original schedule vs the pace now required."""
    today = today or date.today()
    frame = syllabus().copy()
    frame["day"] = frame["scheduled_date"].map(parse_date)
    planned = frame.dropna(subset=["day"]).groupby("day").size().sort_index().cumsum()
    if planned.empty:
        return pd.DataFrame(columns=["day", "Planned", "Required now"])

    days = list(planned.index)
    total = len(frame)
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


def track_summary(done: int = 0, today: date | None = None) -> dict[str, object]:
    """Headline numbers for the German section."""
    today = today or date.today()
    frame = unit_table(done, today)
    total = len(frame)
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
