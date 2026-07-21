from __future__ import annotations

import pandas as pd

from utils.helpers import pct, safe_float

STATUS_WEIGHT = {"Not Started": 0, "Learning": 25, "Practicing": 55, "Revising": 75, "Mastered": 100}
TRACK_STATUS_WEIGHT = {"Not Started": 0, "In Progress": 50, "Blocked": 25, "Done": 100}
TEST_STATUS_WEIGHT = {"Not Registered": 0, "Registered": 25, "Preparing": 50, "Taken": 75, "Result Out": 90, "Passed": 100}
COLLEGE_STATUS_WEIGHT = {"Researching": 10, "Shortlisted": 30, "Applying": 60, "Applied": 90, "Admitted": 100, "Rejected": 0}


def topic_completion(topics: pd.DataFrame) -> float:
    if topics.empty:
        return 0.0
    return round(topics["status"].map(STATUS_WEIGHT).fillna(0).mean(), 1)


def project_completion(projects: pd.DataFrame) -> float:
    if projects.empty:
        return 0.0
    return float(round(projects["completion_pct"].apply(safe_float).mean(), 1))


def book_completion(books: pd.DataFrame) -> float:
    if books.empty:
        return 0.0
    return float(round(books["completion_pct"].apply(safe_float).mean(), 1))


def _status_mean(df: pd.DataFrame, column: str, weights: dict[str, int]) -> float:
    if df.empty:
        return 0.0
    return float(round(df[column].astype(str).map(weights).fillna(0).mean(), 1))


def docs_progress(docs: pd.DataFrame) -> float:
    return _status_mean(docs, "status", TRACK_STATUS_WEIGHT)


def tests_progress(tests: pd.DataFrame) -> float:
    return _status_mean(tests, "status", TEST_STATUS_WEIGHT)


def language_progress(language: pd.DataFrame) -> float:
    return _status_mean(language, "status", TRACK_STATUS_WEIGHT)


def colleges_progress(colleges: pd.DataFrame) -> float:
    if colleges.empty:
        return 0.0
    active = colleges[~colleges["status"].astype(str).eq("Rejected")]
    return _status_mean(active if not active.empty else colleges, "status", COLLEGE_STATUS_WEIGHT)


def visa_progress(docs: pd.DataFrame) -> float:
    if docs.empty:
        return 0.0
    subset = docs[docs["category"].astype(str).isin(["Identity", "Visa"])]
    return _status_mean(subset, "status", TRACK_STATUS_WEIGHT)


def finance_progress(goals: pd.DataFrame) -> float:
    if goals.empty:
        return 0.0
    target = goals["target_amount"].apply(safe_float).sum()
    saved = goals["saved_amount"].apply(safe_float).sum()
    return pct(min(saved, target), target) if target else 0.0


def milestone_progress(milestones: pd.DataFrame) -> float:
    return _status_mean(milestones, "status", TRACK_STATUS_WEIGHT)


def track_overview(frames: dict[str, pd.DataFrame]) -> dict[str, float]:
    """Percent progress per track, for the Home overview. Keys are display labels."""
    topics = frames.get("Topics", pd.DataFrame())
    scores = readiness_scores(
        topics,
        frames.get("Problems", pd.DataFrame()),
        frames.get("Projects", pd.DataFrame()),
        frames.get("Research_Papers", pd.DataFrame()),
        frames.get("Applications", pd.DataFrame()),
        frames.get("Books", pd.DataFrame()),
    )
    return {
        "Math Study": topic_completion(topics),
        "Math Project": project_completion(frames.get("Projects", pd.DataFrame())),
        "Research Internship": scores["Internship Readiness"],
        "Germany Documents": docs_progress(frames.get("Germany_Documents", pd.DataFrame())),
        "Tests": tests_progress(frames.get("Tests", pd.DataFrame())),
        "German B1": language_progress(frames.get("Language", pd.DataFrame())),
        "SOP": scores["SOP Strength"],
        "Finance": finance_progress(frames.get("Finance_Goals", pd.DataFrame())),
        "Colleges": colleges_progress(frames.get("Colleges", pd.DataFrame())),
        "Visa & Passport": visa_progress(frames.get("Germany_Documents", pd.DataFrame())),
    }


def readiness_scores(topics: pd.DataFrame, problems: pd.DataFrame, projects: pd.DataFrame, research: pd.DataFrame, applications: pd.DataFrame, books: pd.DataFrame) -> dict[str, float]:
    topic_score = topic_completion(topics)
    confidence = pct(topics["confidence"].apply(safe_float).sum(), len(topics) * 5) if not topics.empty else 0
    accuracy = pct(problems["correct"].astype(str).str.lower().isin(["true", "yes", "1"]).sum(), len(problems)) if not problems.empty else 0
    project_score = project_completion(projects)
    research_score = pct(research["status"].astype(str).isin(["Summarized", "Implemented", "Deep Read"]).sum(), max(1, len(research))) if not research.empty else 0
    application_score = pct(applications["status"].astype(str).isin(["Applied", "Response", "Interview", "Offer"]).sum(), max(5, len(applications))) if not applications.empty else 0
    book_score = book_completion(books)
    internship = float(round(0.25 * topic_score + 0.2 * accuracy + 0.25 * project_score + 0.15 * research_score + 0.15 * application_score, 1))
    research_ready = float(round(0.25 * topic_score + 0.2 * confidence + 0.2 * project_score + 0.25 * research_score + 0.1 * book_score, 1))
    masters = float(round(0.25 * topic_score + 0.15 * accuracy + 0.15 * project_score + 0.15 * research_score + 0.15 * book_score + 0.15 * application_score, 1))
    sop = float(round(0.2 * topic_score + 0.2 * project_score + 0.2 * research_score + 0.2 * book_score + 0.2 * application_score, 1))
    return {
        "Internship Readiness": internship,
        "Research Readiness": research_ready,
        "German Master's Readiness": masters,
        "SOP Strength": sop,
    }
