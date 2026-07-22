from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

from config import DATA_DIR, DB_PATH, DEFAULT_SETTINGS
from utils.constants import B1_MILESTONES, BOOKS, DEFAULT_MILESTONES, FINANCE_GOALS, GERMANY_DOCS, PROJECT_MODULES, SUBJECTS
from utils.helpers import today_str

logger = logging.getLogger(__name__)

SCHEMA: dict[str, list[str]] = {
    "Study_Log": ["date", "task", "category", "topic", "duration_minutes", "priority", "completed", "estimated_effort", "notes", "created_at"],
    "Topics": ["subject", "unit", "topic", "subtopic", "status", "confidence", "hours_spent", "problems_solved", "video_watched", "book_chapter", "notes", "difficulty", "importance", "dependencies", "last_revised", "next_revision"],
    "Subjects": ["subject", "description", "target_hours", "priority"],
    "Curriculum": ["subject", "unit", "topic", "subtopic", "sequence", "estimated_hours"],
    "Revision": ["date", "topic", "subject", "confidence", "quality", "next_revision", "notes"],
    "Problems": ["date", "topic", "difficulty", "source", "correct", "time_taken", "hints_used", "confidence", "mistakes"],
    "Books": ["book", "chapter", "progress", "pages", "completion_pct", "notes"],
    "Projects": ["project", "module", "status", "difficulty", "completion_pct", "github_link", "notes", "screenshots", "hours"],
    "Research_Papers": ["title", "authors", "link", "pdf", "status", "summary", "key_ideas", "mathematics_used", "questions", "implementation_ideas", "tags"],
    "Professors": ["institute", "professor", "research_area", "email", "website", "notes"],
    "Applications": ["institute", "professor", "research_area", "email", "website", "status", "applied", "response", "interview", "offer", "notes", "deadline"],
    "Goals": ["goal", "category", "target_date", "status", "progress_pct", "notes"],
    "Notes": ["title", "topic", "tags", "content", "created_at", "updated_at"],
    "Settings": ["key", "value"],
    "Analytics_Cache": ["metric", "value", "updated_at"],
    "Germany_Documents": ["document", "category", "status", "needs_apostille", "needs_translation", "deadline", "notes"],
    "Tests": ["test", "target_score", "registration_deadline", "test_date", "result", "status", "fee", "notes"],
    "Language": ["level", "milestone", "skill", "resource", "hours", "status", "notes"],
    "Colleges": ["university", "program", "city", "tuition_per_sem", "language_of_instruction", "requirements", "uni_assist", "application_open", "deadline", "status", "priority", "notes"],
    "Milestones": ["milestone", "track", "target_date", "status", "notes"],
    "Finance_Goals": ["goal", "target_amount", "saved_amount", "deadline", "notes"],
    "Finance_Log": ["date", "category", "description", "amount", "currency", "type", "notes"],
    "Planner_Snapshot": ["metric", "value", "updated_at"],
}


def _seed_topics() -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    template = {
        "Calculus": [("Limits and Continuity", "Epsilon-delta intuition"), ("Derivatives", "Optimization and approximation"), ("Integrals", "Techniques and applications")],
        "Linear Algebra": [("Vector Spaces", "Subspaces and bases"), ("Matrices", "Rank, inverse, factorization"), ("Eigenvalues", "Diagonalization and spectral ideas")],
        "Probability": [("Random Variables", "Distributions and expectation"), ("Limit Theorems", "LLN and CLT"), ("Stochastic Models", "Markov chains")],
        "Statistics": [("Estimation", "Bias, variance, MLE"), ("Hypothesis Testing", "Tests and p-values"), ("Regression", "Linear models")],
        "Optimization": [("Convexity", "Convex sets and functions"), ("Unconstrained", "Gradient and Newton methods"), ("Constrained", "KKT conditions")],
        "Real Analysis": [("Sequences", "Convergence"), ("Continuity", "Metric space view"), ("Integration", "Riemann foundations")],
        "Differential Equations": [("First Order ODE", "Separable and linear"), ("Systems", "Phase portraits"), ("Numerical ODE", "Euler and RK methods")],
        "Numerical Methods": [("Linear Systems", "Gaussian elimination"), ("Interpolation", "Polynomial methods"), ("Numerical Integration", "Quadrature")],
        "Abstract Algebra": [("Groups", "Subgroups and homomorphisms"), ("Rings", "Ideals"), ("Fields", "Extensions")],
        "Topology": [("Topological Spaces", "Open sets"), ("Compactness", "Covers"), ("Continuity", "Homeomorphisms")],
        "Machine Learning Mathematics": [("Optimization for ML", "Gradient descent"), ("Probability for ML", "Bayesian thinking"), ("Linear Algebra for ML", "SVD and PCA")],
    }
    sequence = 1
    for subject, items in template.items():
        for unit, topic in items:
            rows.append({
                "subject": subject, "unit": unit, "topic": topic, "subtopic": "", "status": "Not Started",
                "confidence": 1, "hours_spent": 0.0, "problems_solved": 0, "video_watched": "",
                "book_chapter": "", "notes": "", "difficulty": "Medium", "importance": 3,
                "dependencies": "", "last_revised": "", "next_revision": "", "sequence": sequence,
                "estimated_hours": 4,
            })
            sequence += 1
    return pd.DataFrame(rows)


def _seed_frame(sheet: str) -> pd.DataFrame:
    if sheet == "Subjects":
        return pd.DataFrame([{"subject": s, "description": "", "target_hours": 80, "priority": "Medium"} for s in SUBJECTS])
    if sheet == "Curriculum":
        topics = _seed_topics()
        return topics[["subject", "unit", "topic", "subtopic", "sequence", "estimated_hours"]]
    if sheet == "Topics":
        topics = _seed_topics()
        return topics[SCHEMA["Topics"]]
    if sheet == "Books":
        return pd.DataFrame([{"book": b, "chapter": "", "progress": "Not Started", "pages": 0, "completion_pct": 0, "notes": ""} for b in BOOKS])
    if sheet == "Projects":
        return pd.DataFrame([{"project": "Numerical Analysis Toolkit", "module": m, "status": "Not Started", "difficulty": "Medium", "completion_pct": 0, "github_link": "", "notes": "", "screenshots": "", "hours": 0} for m in PROJECT_MODULES])
    if sheet == "Settings":
        return pd.DataFrame([{"key": k, "value": v} for k, v in DEFAULT_SETTINGS.items()])
    if sheet == "Germany_Documents":
        return pd.DataFrame([
            {"document": doc, "category": cat, "status": "Not Started", "needs_apostille": False, "needs_translation": False, "deadline": deadline, "notes": ""}
            for doc, cat, deadline in GERMANY_DOCS
        ])
    if sheet == "Tests":
        return pd.DataFrame([
            {"test": "IELTS Academic", "target_score": "7.0", "registration_deadline": "2026-09-30", "test_date": "", "result": "", "status": "Not Registered", "fee": 17000, "notes": "Most unis accept 6.5; target 7.0"},
            {"test": "Goethe-Zertifikat B1", "target_score": "Pass", "registration_deadline": "2027-01-31", "test_date": "", "result": "", "status": "Not Registered", "fee": 16000, "notes": "Needed for visa comfort + some programs"},
            {"test": "GRE (optional)", "target_score": "320", "registration_deadline": "", "test_date": "", "result": "", "status": "Not Registered", "fee": 22000, "notes": "Only if shortlisted unis ask for it"},
            {"test": "TestAS (optional)", "target_score": "", "registration_deadline": "", "test_date": "", "result": "", "status": "Not Registered", "fee": 9000, "notes": "Helps some applications from India"},
        ])
    if sheet == "Language":
        rows = []
        for level, milestone in B1_MILESTONES:
            for skill in ["Vocabulary", "Grammar", "Listening", "Speaking"]:
                rows.append({"level": level, "milestone": milestone, "skill": skill, "resource": "", "hours": 0, "status": "Not Started", "notes": ""})
        return pd.DataFrame(rows)
    if sheet == "Milestones":
        return pd.DataFrame([
            {"milestone": m, "track": track, "target_date": d, "status": "Not Started", "notes": ""}
            for m, track, d in DEFAULT_MILESTONES
        ])
    if sheet == "Finance_Goals":
        return pd.DataFrame([
            {"goal": g, "target_amount": amount, "saved_amount": 0, "deadline": deadline, "notes": ""}
            for g, amount, deadline in FINANCE_GOALS
        ])
    return pd.DataFrame(columns=SCHEMA[sheet])


class ExcelDB:
    def __init__(self, path: Path = DB_PATH) -> None:
        self.path = path
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        # Pull the workbook from Supabase Storage when running deployed.
        # No-op when SUPABASE_URL is not set (local dev keeps using the local file).
        from backend.storage import pull_once
        pull_once(self.path)
        self.ensure_workbook()

    def ensure_workbook(self) -> None:
        frames: dict[str, pd.DataFrame] = {}
        if self.path.exists():
            try:
                existing = pd.read_excel(self.path, sheet_name=None, engine="openpyxl")
            except Exception as exc:
                logger.exception("Could not open workbook: %s", exc)
                raise RuntimeError(f"Could not open workbook at {self.path}") from exc
        else:
            existing = {}
        changed = not self.path.exists()
        for sheet, columns in SCHEMA.items():
            if sheet in existing:
                df = existing[sheet]
            else:
                df = _seed_frame(sheet)
                changed = True
            for column in columns:
                if column not in df.columns:
                    df[column] = ""
                    changed = True
            frames[sheet] = df[columns]
        if changed:
            self.write_all(frames)

    def read(self, sheet: str) -> pd.DataFrame:
        self.ensure_workbook()
        df = pd.read_excel(self.path, sheet_name=sheet, engine="openpyxl")
        for column in SCHEMA[sheet]:
            if column not in df.columns:
                df[column] = ""
        return df[SCHEMA[sheet]].fillna("")

    def write(self, sheet: str, df: pd.DataFrame) -> None:
        frames = pd.read_excel(self.path, sheet_name=None, engine="openpyxl") if self.path.exists() else {}
        columns = SCHEMA[sheet]
        for column in columns:
            if column not in df.columns:
                df[column] = ""
        frames[sheet] = df[columns]
        self.write_all(frames)

    def write_all(self, frames: dict[str, pd.DataFrame]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with pd.ExcelWriter(self.path, engine="openpyxl", mode="w") as writer:
            for sheet, columns in SCHEMA.items():
                df = frames.get(sheet, pd.DataFrame(columns=columns))
                for column in columns:
                    if column not in df.columns:
                        df[column] = ""
                df[columns].to_excel(writer, sheet_name=sheet, index=False)
        # Mirror the local write to Supabase Storage so the deployed version stays current.
        from backend.storage import push
        push(self.path)

    def append(self, sheet: str, row: dict[str, Any]) -> None:
        df = self.read(sheet)
        df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
        self.write(sheet, df)

    def settings(self) -> dict[str, str]:
        df = self.read("Settings")
        values = {str(row["key"]): str(row["value"]) for _, row in df.iterrows()}
        return {**DEFAULT_SETTINGS, **values}

    def update_setting(self, key: str, value: Any) -> None:
        df = self.read("Settings")
        if key in set(df["key"].astype(str)):
            df.loc[df["key"].astype(str) == key, "value"] = str(value)
        else:
            df = pd.concat([df, pd.DataFrame([{"key": key, "value": str(value)}])], ignore_index=True)
        self.write("Settings", df)


def get_db() -> ExcelDB:
    return ExcelDB()
