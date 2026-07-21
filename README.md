# Deutschland Dash

A local-first dashboard for tracking a move to Germany for a Master's degree — built with Streamlit on top of a single Excel workbook. It covers the whole journey: German language study, maths preparation, research, documents and apostilles, tests, university shortlisting, applications, finance, and the visa file.

No authentication, cloud service, Docker, or database server. Everything runs locally against one `.xlsx` file.

## Installation

```bash
pip install -r requirements.txt
streamlit run app.py
```

The workbook `data/math_database.xlsx` is created automatically on first launch, seeded with a document checklist, an A1→B1 language ladder, a milestone skeleton, and finance goals. It is **not** committed to this repository — it holds personal records.

## Requirements

Python 3.12+ · Streamlit · Pandas · Plotly · OpenPyXL · NumPy · ReportLab

## Pages

| Page | Contents |
|---|---|
| **Home** (`app.py`) | Countdown to intake and to applications opening, per-track progress, upcoming deadlines, daily pace |
| **Study** | Planner, curriculum, spaced-repetition revision, problem log, books, notes |
| **Research** | Papers, internship pipeline (professors + applications), maths project |
| **Germany** | Documents and apostilles, tests, visa and passport steps |
| **German** | A1 syllabus, grammar ladder, pace burn-up, B1 ladder and exams |
| **Applications** | College shortlist, milestone timeline, SOP builder |
| **Finance** | Savings goals (blocked account, fees, flights) and a ledger |
| **Settings** | Target dates, preferences, exports |

## Architecture

- `app.py` — Home dashboard and entry point.
- `pages/` — one file per section, each grouping related trackers into tabs.
- `backend/excel_db.py` — workbook creation, non-destructive schema migration, reads/writes.
- `backend/german.py` — the A1 syllabus as data; unit status derived from the planner snapshot.
- `backend/planner_sync.py` — bridge to the external planner: snapshot storage and burn-down maths.
- `backend/scheduler.py` — daily task generation and spaced-repetition intervals.
- `backend/analytics.py`, `backend/progress.py` — streaks, hours, per-track percentages.
- `backend/charts.py`, `backend/export.py` — charts, and CSV/Excel/Markdown/PDF export.
- `utils/` — constants (including the 70-unit German A1 syllabus), helpers, shared UI.

## Design notes

**Intelligence lives outside the code; rules live inside it.** Breaking goals into daily units and replanning when days slip is done by an assistant against an external planner. This repository holds the deterministic half: storing the plan, tracking state, and computing pace.

**Single source of truth for progress.** The German A1 units are strictly sequential, so per-unit completion is never stored here — it is derived from one number (units remaining) reported by the planner. Keeping a second copy of "done" in the workbook would let the two drift apart.

**Honest charts.** The pace chart plots the original schedule against the rate now required to finish on time. It deliberately does not draw a historical "actual" curve, because the planner reports only a current count, not per-day history.

## Scripts

`scripts/build_a1_plan.py` generates the 70-unit A1 schedule (2 units/day, each paired with a grammar focus) as JSON for bulk import into a planner. It reads a CSV of unit names:

```bash
DUOLINGO_UNITS_CSV=/path/to/duolingo_units.csv python scripts/build_a1_plan.py
```

## Workbook sheets

`Study_Log`, `Topics`, `Subjects`, `Curriculum`, `Revision`, `Problems`, `Books`, `Projects`, `Research_Papers`, `Professors`, `Applications`, `Goals`, `Notes`, `Settings`, `Analytics_Cache`, `Germany_Documents`, `Tests`, `Language`, `Colleges`, `Milestones`, `Finance_Goals`, `Finance_Log`, `Planner_Snapshot`.

Adding columns in code preserves existing rows — sheets are migrated by adding the missing columns only.
