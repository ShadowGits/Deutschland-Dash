from pathlib import Path

APP_NAME = "MathOS"
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
EXPORT_DIR = BASE_DIR / "exports"
ASSETS_DIR = BASE_DIR / "assets"
DB_PATH = DATA_DIR / "math_database.xlsx"
UPLOADS_DIR = DATA_DIR / "uploads"

DATE_FORMAT = "%Y-%m-%d"
DATETIME_FORMAT = "%Y-%m-%d %H:%M"

DEFAULT_SETTINGS = {
    "theme": "Light",
    "semester_start": "",
    "daily_study_goal": "3",
    "weekly_study_goal": "20",
    "revision_intervals": "1,3,7,14,30,60,90",
    "backup_location": str(EXPORT_DIR),
    "export_format": "Markdown",
    "target_intake": "2027-10-01",
    "application_start": "2026-12-01",
    "application_end": "2027-07-15",
    "monthly_savings_target": "0",
}

STATUS_OPTIONS = ["Not Started", "Learning", "Practicing", "Revising", "Mastered"]
PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"]
DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard", "Olympiad", "Research"]

# Generic task/checklist status used by the Germany-move tracks
TRACK_STATUS_OPTIONS = ["Not Started", "In Progress", "Blocked", "Done"]
COLLEGE_STATUS_OPTIONS = ["Researching", "Shortlisted", "Applying", "Applied", "Admitted", "Rejected"]
TEST_STATUS_OPTIONS = ["Not Registered", "Registered", "Preparing", "Taken", "Result Out", "Passed"]
DOC_CATEGORY_OPTIONS = ["Academic", "Identity", "Financial", "Language", "Visa"]
