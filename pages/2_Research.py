from __future__ import annotations

import pandas as pd
import streamlit as st

from backend.charts import project_progress
from config import DIFFICULTY_OPTIONS, STATUS_OPTIONS
from utils.helpers import contains_text
from utils.ui import save_editor, setup_page

db = setup_page("Research & Internship", "∫")

papers_tab, internship_tab, project_tab = st.tabs(["Papers", "Internship", "Math project"])

with papers_tab:
    papers = db.read("Research_Papers")
    query = st.text_input("Search papers, tags, key ideas")
    status = st.selectbox("Status", ["All", "Queued", "Skimmed", "Deep Read", "Summarized", "Implemented"])
    view = papers.copy()
    if query:
        view = view[view.apply(lambda row: contains_text(row, query), axis=1)]
    if status != "All":
        view = view[view["status"].astype(str) == status]
    edited = st.data_editor(view, key="research_editor", num_rows="dynamic", width="stretch", hide_index=True)
    if st.button("Save research papers", type="primary"):
        if query or status != "All":
            base = papers.drop(index=view.index, errors="ignore")
            db.write("Research_Papers", pd.concat([base, edited], ignore_index=True))
        else:
            db.write("Research_Papers", edited)
        st.success("Research papers saved.")
        st.rerun()

with internship_tab:
    apps = db.read("Applications")
    st.caption("Track IIT, IISc, ISI, CMI, IMSc, DAAD-WISE, and other research internship leads.")
    edited_apps = st.data_editor(
        apps,
        key="apps_editor",
        num_rows="dynamic",
        width="stretch",
        hide_index=True,
        column_config={
            "status": st.column_config.SelectboxColumn("Status", options=["Prospect", "Applied", "Response", "Interview", "Offer", "Rejected", "Deferred"]),
            "applied": st.column_config.CheckboxColumn("Applied"),
            "response": st.column_config.CheckboxColumn("Response"),
            "interview": st.column_config.CheckboxColumn("Interview"),
            "offer": st.column_config.CheckboxColumn("Offer"),
        },
    )
    if st.button("Save applications", type="primary"):
        db.write("Applications", edited_apps)
        st.success("Internship tracker saved.")
        st.rerun()
    st.subheader("Professor directory")
    save_editor(db, "Professors", db.read("Professors"), "prof_editor")

with project_tab:
    projects = db.read("Projects")
    st.plotly_chart(project_progress(projects), width="stretch")
    edited_projects = st.data_editor(
        projects,
        key="projects_editor",
        num_rows="dynamic",
        width="stretch",
        hide_index=True,
        column_config={
            "status": st.column_config.SelectboxColumn("Status", options=STATUS_OPTIONS),
            "difficulty": st.column_config.SelectboxColumn("Difficulty", options=DIFFICULTY_OPTIONS),
            "completion_pct": st.column_config.ProgressColumn("Completion", min_value=0, max_value=100),
        },
    )
    if st.button("Save projects", type="primary"):
        db.write("Projects", edited_projects)
        st.success("Projects saved.")
        st.rerun()
