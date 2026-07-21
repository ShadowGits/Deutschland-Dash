from __future__ import annotations

from datetime import timedelta

import pandas as pd

from backend.excel_db import ExcelDB
from config import PRIORITY_OPTIONS
from utils.helpers import parse_date, today_str

DEFAULT_INTERVALS = [1, 3, 7, 14, 30, 60, 90]


def intervals_from_settings(settings: dict[str, str]) -> list[int]:
    raw = settings.get("revision_intervals", "")
    values: list[int] = []
    for part in raw.split(","):
        try:
            values.append(max(1, int(part.strip())))
        except ValueError:
            continue
    return values or DEFAULT_INTERVALS


def next_revision_date(last_review: str, quality: int, settings: dict[str, str]) -> str:
    intervals = intervals_from_settings(settings)
    index = max(0, min(len(intervals) - 1, int(quality) - 1))
    base = parse_date(last_review) or parse_date(today_str())
    assert base is not None
    return (base + timedelta(days=intervals[index])).strftime("%Y-%m-%d")


def due_revisions(db: ExcelDB) -> pd.DataFrame:
    topics = db.read("Topics")
    today = parse_date(today_str())
    if topics.empty or today is None:
        return topics
    due = topics[topics["next_revision"].apply(lambda value: (parse_date(value) or today) <= today)]
    active = due[due["status"].astype(str).isin(["Learning", "Practicing", "Revising", "Mastered"])]
    return active.sort_values(["importance", "confidence"], ascending=[False, True])


def generate_today_tasks(db: ExcelDB) -> int:
    tasks = db.read("Study_Log")
    today = today_str()
    existing_today = tasks[tasks["date"].astype(str) == today]
    if not existing_today.empty:
        return 0
    topics = db.read("Topics")
    due = due_revisions(db).head(4)
    learning = topics[topics["status"].astype(str).isin(["Not Started", "Learning"])].head(3)
    rows = []
    for _, row in due.iterrows():
        rows.append({"date": today, "task": f"Revise {row['topic']}", "category": "Revision", "topic": row["topic"], "duration_minutes": 35, "priority": "High", "completed": False, "estimated_effort": 3, "notes": "Spaced repetition review", "created_at": today})
    for _, row in learning.iterrows():
        rows.append({"date": today, "task": f"Study {row['topic']}", "category": "Study", "topic": row["topic"], "duration_minutes": 60, "priority": "Medium", "completed": False, "estimated_effort": 4, "notes": "Continue curriculum progress", "created_at": today})
    rows.extend([
        {"date": today, "task": "Solve focused problem set", "category": "Problems", "topic": "", "duration_minutes": 45, "priority": "Medium", "completed": False, "estimated_effort": 4, "notes": "", "created_at": today},
        {"date": today, "task": "Project or paper block", "category": "Research", "topic": "", "duration_minutes": 45, "priority": "Low", "completed": False, "estimated_effort": 3, "notes": "", "created_at": today},
    ])
    for row in rows:
        if row["priority"] not in PRIORITY_OPTIONS:
            row["priority"] = "Medium"
    if rows:
        db.write("Study_Log", pd.concat([tasks, pd.DataFrame(rows)], ignore_index=True))
    return len(rows)
