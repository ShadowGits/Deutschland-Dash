from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

from backend.excel_db import ExcelDB
from backend.progress import track_overview
from backend.scheduler import due_revisions
from utils.helpers import parse_date, pct, safe_float, today_str


def load_frames(db: ExcelDB) -> dict[str, pd.DataFrame]:
    return {sheet: db.read(sheet) for sheet in [
        "Study_Log", "Topics", "Problems", "Books", "Projects", "Research_Papers", "Applications", "Revision", "Notes",
        "Germany_Documents", "Tests", "Language", "Colleges", "Milestones", "Finance_Goals", "Finance_Log",
    ]}


def study_hours(tasks: pd.DataFrame, start: date | None = None, end: date | None = None) -> float:
    if tasks.empty:
        return 0.0
    df = tasks.copy()
    df["_date"] = df["date"].apply(parse_date)
    completed = df["completed"].astype(str).str.lower().isin(["true", "yes", "1"])
    if start:
        completed &= df["_date"].apply(lambda d: d is not None and d >= start)
    if end:
        completed &= df["_date"].apply(lambda d: d is not None and d <= end)
    return float(round(df.loc[completed, "duration_minutes"].apply(safe_float).sum() / 60, 1))


def study_streak(tasks: pd.DataFrame) -> int:
    if tasks.empty:
        return 0
    completed_dates = {parse_date(v) for _, row in tasks.iterrows() if str(row.get("completed", "")).lower() in {"true", "yes", "1"} for v in [row.get("date")]}
    completed_dates.discard(None)
    current = date.today()
    streak = 0
    while current in completed_dates:
        streak += 1
        current -= timedelta(days=1)
    return streak


def days_until(value: str) -> int:
    target = parse_date(value)
    return (target - date.today()).days if target else 0


def upcoming_deadlines(frames: dict[str, pd.DataFrame], within_days: int = 45) -> pd.DataFrame:
    """Union of dated items across tracks, due within the window, soonest first."""
    sources = [
        ("Milestones", "milestone", "target_date", "track"),
        ("Germany_Documents", "document", "deadline", "category"),
        ("Tests", "test", "registration_deadline", "status"),
        ("Colleges", "university", "deadline", "status"),
        ("Finance_Goals", "goal", "deadline", "notes"),
    ]
    today = date.today()
    rows = []
    for sheet, title_col, date_col, tag_col in sources:
        df = frames.get(sheet, pd.DataFrame())
        if df.empty:
            continue
        done_mask = df.get("status", pd.Series("", index=df.index)).astype(str).isin(["Done", "Passed", "Admitted"])
        for _, row in df[~done_mask].iterrows():
            due = parse_date(row.get(date_col))
            if due and 0 <= (due - today).days <= within_days:
                rows.append({"due": due.isoformat(), "in": f"{(due - today).days}d", "item": str(row[title_col]), "track": sheet.replace("_", " ")})
    if not rows:
        return pd.DataFrame(columns=["due", "in", "item", "track"])
    return pd.DataFrame(rows).sort_values("due").head(10)


def dashboard_metrics(db: ExcelDB) -> dict[str, object]:
    frames = load_frames(db)
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    tasks = frames["Study_Log"]
    settings = db.settings()
    tracks = track_overview(frames)
    overall = float(round(sum(tracks.values()) / max(1, len(tracks)), 1))
    docs = frames["Germany_Documents"]
    docs_done = int(docs["status"].astype(str).eq("Done").sum()) if not docs.empty else 0
    return {
        "Days to Oct 2027 Intake": days_until(settings.get("target_intake", "2027-10-01")),
        "Days to Applications Open": days_until(settings.get("application_start", "2026-12-01")),
        "Overall Readiness %": overall,
        "Study Streak": study_streak(tasks),
        "Today's Hours": study_hours(tasks, today, today),
        "Weekly Hours": study_hours(tasks, week_start, today),
        "Docs Ready": f"{docs_done}/{len(docs)}" if not docs.empty else "0/0",
        "Revision Due Today": len(due_revisions(db)),
    }


def problem_stats(problems: pd.DataFrame) -> dict[str, object]:
    if problems.empty:
        return {"accuracy": 0.0, "avg_time": 0.0, "weakest": "No data", "most_attempted": "No data"}
    correct = problems["correct"].astype(str).str.lower().isin(["true", "yes", "1"])
    by_topic = problems.assign(_correct=correct).groupby("topic").agg(attempts=("topic", "size"), accuracy=("_correct", "mean")).reset_index()
    weakest = by_topic.sort_values(["accuracy", "attempts"], ascending=[True, False]).iloc[0]["topic"] if not by_topic.empty else "No data"
    most_attempted = by_topic.sort_values("attempts", ascending=False).iloc[0]["topic"] if not by_topic.empty else "No data"
    return {"accuracy": pct(correct.sum(), len(problems)), "avg_time": round(problems["time_taken"].apply(safe_float).mean(), 1), "weakest": weakest, "most_attempted": most_attempted}


def recent_activity(db: ExcelDB) -> pd.DataFrame:
    parts = []
    for sheet, label in [("Study_Log", "Task"), ("Problems", "Problem"), ("Revision", "Revision"), ("Notes", "Note")]:
        df = db.read(sheet)
        if df.empty:
            continue
        date_col = "date" if "date" in df.columns else "updated_at"
        title_col = "task" if "task" in df.columns else ("topic" if "topic" in df.columns else "title")
        parts.append(pd.DataFrame({"date": df[date_col], "type": label, "activity": df[title_col]}))
    if not parts:
        return pd.DataFrame(columns=["date", "type", "activity"])
    return pd.concat(parts, ignore_index=True).sort_values("date", ascending=False).head(10)
