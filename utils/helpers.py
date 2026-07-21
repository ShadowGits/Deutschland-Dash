from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pandas as pd

from config import DATE_FORMAT, DATETIME_FORMAT


def today_str() -> str:
    return date.today().strftime(DATE_FORMAT)


def now_str() -> str:
    return datetime.now().strftime(DATETIME_FORMAT)


def parse_date(value: Any) -> date | None:
    if value is None or value == "" or pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return pd.to_datetime(value).date()
    except Exception:
        return None


def coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "1", "yes", "y", "done"}


def pct(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "" or pd.isna(value):
            return default
        return float(value)
    except Exception:
        return default


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def contains_text(row: pd.Series, query: str) -> bool:
    haystack = " ".join(str(v) for v in row.values if not pd.isna(v)).lower()
    return query.lower() in haystack
