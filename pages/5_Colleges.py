from __future__ import annotations

import streamlit as st

from backend.charts import milestone_timeline
from backend.export import export_sop_markdown, sop_markdown
from backend.progress import readiness_scores
from config import COLLEGE_STATUS_OPTIONS, PRIORITY_OPTIONS, TRACK_STATUS_OPTIONS
from utils.ui import download_path, metric_grid, setup_page

db = setup_page("Colleges", "🎓")

colleges_tab, timeline_tab, sop_tab = st.tabs(["Colleges", "Timeline", "SOP"])

with colleges_tab:
    st.caption("Shortlist for Winter 2027. Track requirements, uni-assist, and deadlines per program.")
    colleges = db.read("Colleges")
    edited = st.data_editor(
        colleges,
        key="colleges_editor",
        num_rows="dynamic",
        width="stretch",
        hide_index=True,
        column_config={
            "status": st.column_config.SelectboxColumn("Status", options=COLLEGE_STATUS_OPTIONS),
            "priority": st.column_config.SelectboxColumn("Priority", options=PRIORITY_OPTIONS),
            "uni_assist": st.column_config.CheckboxColumn("uni-assist"),
        },
    )
    if st.button("Save colleges", type="primary"):
        db.write("Colleges", edited)
        st.success("Colleges saved.")
        st.rerun()

with timeline_tab:
    milestones = db.read("Milestones")
    st.plotly_chart(milestone_timeline(milestones), width="stretch")
    edited_milestones = st.data_editor(
        milestones,
        key="milestones_editor",
        num_rows="dynamic",
        width="stretch",
        hide_index=True,
        column_config={"status": st.column_config.SelectboxColumn("Status", options=TRACK_STATUS_OPTIONS)},
    )
    if st.button("Save milestones", type="primary"):
        db.write("Milestones", edited_milestones)
        st.success("Milestones saved.")
        st.rerun()

with sop_tab:
    scores = readiness_scores(db.read("Topics"), db.read("Problems"), db.read("Projects"), db.read("Research_Papers"), db.read("Applications"), db.read("Books"))
    metric_grid(scores, 4)

    st.subheader("Generated source pack")
    st.markdown(sop_markdown(db))
    if st.button("Export SOP markdown", type="primary"):
        download_path(export_sop_markdown(db), "Download markdown")

    st.caption("SOP Strength weighs topic mastery, project completion, research reading, book progress, and internship targeting equally.")
