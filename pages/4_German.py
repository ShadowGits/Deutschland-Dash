from __future__ import annotations

import pandas as pd
import streamlit as st

from backend.german import DONE, OVERDUE, TODAY, burndown_series, grammar_ladder, track_summary, unit_table
from backend.progress import language_progress
from config import TEST_STATUS_OPTIONS, TRACK_STATUS_OPTIONS
from utils.ui import metric_grid, pace_panel, setup_page

db = setup_page("German", ":material/translate:")

summary = track_summary(db)
units = unit_table(db)

st.caption(
    "Daily execution lives in Planner OS — this page is the plan, the grammar ladder, and whether you'll land A1 in time. "
    "Unit status is derived from Planner OS, not tracked separately here."
)

metric_grid({
    "Units done": f"{summary['done']}/{summary['total']}",
    "Units left": summary["left"],
    "Overdue": summary["overdue"],
    "Needed per day": summary["needed_per_day"] or "—",
}, 4)

pace_tab, syllabus_tab, grammar_tab, level_tab = st.tabs(["Pace", "Syllabus", "Grammar ladder", "B1 ladder & exam"])

with pace_tab:
    pace_panel(db, tracks=[("german", "German A1")])

    if summary["plan_end"]:
        st.caption(f"Plan runs to {summary['plan_end']} · {summary['days_left']} days remaining · 2 units/day, every day.")

    series = burndown_series(db)
    if series.empty:
        st.info("No syllabus scheduled yet.")
    else:
        with st.container(border=True):
            st.subheader("Pace: planned vs required from here")
            st.caption(
                "Planned is the original schedule. Required now runs from today's real completed count to all "
                f"{summary['total']} units by {summary['plan_end']}. If it climbs faster than Planned, you're behind."
            )
            st.line_chart(series, x="day", y=["Planned", "Required now"], height=280)

    if summary["overdue"]:
        st.warning(
            f"{summary['overdue']} unit(s) are past their scheduled date. Ask Claude to replan — "
            "it will redistribute them across the remaining days in Planner OS."
        )

with syllabus_tab:
    st.caption("All 70 A1 units with the grammar point each one carries.")
    choices = ["All", DONE, TODAY, OVERDUE, "Upcoming"]
    chosen = st.segmented_control("Filter", choices, default="All", key="german_unit_filter")
    view = units if chosen in (None, "All") else units[units["status"] == chosen]
    st.dataframe(
        view,
        hide_index=True,
        width="stretch",
        height=460,
        column_config={
            "unit": st.column_config.NumberColumn("Unit", width="small"),
            "topic": st.column_config.TextColumn("Topic", width="medium"),
            "grammar": st.column_config.TextColumn("Grammar focus", width="large"),
            "scheduled_date": st.column_config.TextColumn("Scheduled", width="small"),
            "status": st.column_config.TextColumn("Status", width="small"),
        },
    )
    st.caption(f"Showing {len(view)} of {len(units)} units.")

with grammar_tab:
    st.caption("The A1 grammar progression in teaching order — use this to revise what you've already covered.")
    ladder = grammar_ladder(db)
    covered = ladder[ladder["status"] == DONE]
    ahead = ladder[ladder["status"] != DONE]

    left, right = st.columns(2)
    with left:
        with st.container(border=True):
            st.subheader(f"Covered ({len(covered)})")
            if covered.empty:
                st.caption("Nothing marked done yet.")
            else:
                st.dataframe(covered[["unit", "grammar"]], hide_index=True, width="stretch", height=380)
    with right:
        with st.container(border=True):
            st.subheader(f"Still ahead ({len(ahead)})")
            st.dataframe(ahead[["unit", "grammar"]], hide_index=True, width="stretch", height=380)

with level_tab:
    language = db.read("Language")
    st.metric("German B1 %", language_progress(language))
    st.caption("A1 → B1 ladder. Mark milestones done as you clear each level and skill.")
    level_progress = (
        language.groupby("level")["status"].apply(lambda s: (s.astype(str) == "Done").mean() * 100)
        if not language.empty else pd.Series(dtype=float)
    )
    for level, value in level_progress.items():
        st.progress(int(value), text=f"{level} · {int(value)}%")

    edited_language = st.data_editor(
        language,
        key="german_language_editor",
        num_rows="dynamic",
        width="stretch",
        hide_index=True,
        column_config={
            "status": st.column_config.SelectboxColumn("Status", options=TRACK_STATUS_OPTIONS),
            "hours": st.column_config.NumberColumn("Hours", min_value=0, step=1),
        },
    )
    if st.button("Save language progress", type="primary"):
        db.write("Language", edited_language)
        st.success("Language progress saved.")
        st.rerun()

    st.divider()
    st.subheader("German exams")
    tests = db.read("Tests")
    german_tests = tests[tests["test"].astype(str).str.contains("Goethe|TestDaF|telc|DSH", case=False, na=False)]
    if german_tests.empty:
        st.caption("No German exam rows in the Tests sheet yet.")
    else:
        edited_tests = st.data_editor(
            german_tests,
            key="german_tests_editor",
            num_rows="dynamic",
            width="stretch",
            hide_index=True,
            column_config={"status": st.column_config.SelectboxColumn("Status", options=TEST_STATUS_OPTIONS)},
        )
        if st.button("Save German exams", type="primary"):
            base = tests.drop(index=german_tests.index, errors="ignore")
            db.write("Tests", pd.concat([base, edited_tests], ignore_index=True))
            st.success("German exams saved.")
            st.rerun()
