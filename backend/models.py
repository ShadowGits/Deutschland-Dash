from __future__ import annotations

from dataclasses import dataclass, asdict

from utils.helpers import today_str


@dataclass
class Topic:
    subject: str
    unit: str
    topic: str
    subtopic: str = ""
    status: str = "Not Started"
    confidence: int = 1
    hours_spent: float = 0.0
    problems_solved: int = 0
    video_watched: str = ""
    book_chapter: str = ""
    notes: str = ""
    difficulty: str = "Medium"
    importance: int = 3
    dependencies: str = ""
    last_revised: str = ""
    next_revision: str = ""

    def to_row(self) -> dict:
        return asdict(self)


@dataclass
class Task:
    date: str
    task: str
    category: str
    topic: str = ""
    duration_minutes: int = 45
    priority: str = "Medium"
    completed: bool = False
    estimated_effort: int = 3
    notes: str = ""
    created_at: str = today_str()

    def to_row(self) -> dict:
        return asdict(self)
