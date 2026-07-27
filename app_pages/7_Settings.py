from __future__ import annotations

import streamlit as st

from backend.export import export_pdf_report, export_sheet_csv, export_workbook_copy
from backend.excel_db import SCHEMA
from utils.helpers import safe_float
from utils.ui import download_path, setup_page

db = setup_page("Settings", "⚙")
settings = db.settings()

with st.form("settings_form"):
    st.subheader("Germany timeline")
    target_intake = st.text_input("Target intake (YYYY-MM-DD)", settings.get("target_intake", "2027-10-01"))
    application_start = st.text_input("Applications open", settings.get("application_start", "2026-12-01"))
    application_end = st.text_input("Application deadline", settings.get("application_end", "2027-07-15"))
    monthly_savings = st.number_input("Monthly savings target (EUR)", min_value=0.0, value=safe_float(settings.get("monthly_savings_target", 0), 0), step=50.0)

    st.subheader("Study")
    semester_start = st.text_input("Semester start", settings.get("semester_start", ""))
    daily_goal = st.number_input("Daily study goal (hours)", min_value=0.0, value=safe_float(settings.get("daily_study_goal", 3), 3), step=0.5)
    weekly_goal = st.number_input("Weekly study goal (hours)", min_value=0.0, value=safe_float(settings.get("weekly_study_goal", 20), 20), step=0.5)
    revision_intervals = st.text_input("Revision intervals", settings.get("revision_intervals", "1,3,7,14,30,60,90"))

    st.subheader("App")
    backup_location = st.text_input("Backup location", settings.get("backup_location", "exports"))
    export_format = st.selectbox("Default export format", ["Markdown", "CSV", "Excel", "PDF"], index=["Markdown", "CSV", "Excel", "PDF"].index(settings.get("export_format", "Markdown")))

    if st.form_submit_button("Save settings", type="primary"):
        for key, value in {
            "target_intake": target_intake,
            "application_start": application_start,
            "application_end": application_end,
            "monthly_savings_target": monthly_savings,
            "semester_start": semester_start,
            "daily_study_goal": daily_goal,
            "weekly_study_goal": weekly_goal,
            "revision_intervals": revision_intervals,
            "backup_location": backup_location,
            "export_format": export_format,
        }.items():
            db.update_setting(key, value)
        st.success("Settings saved.")
        st.rerun()

st.subheader("Exports")
cols = st.columns(3)
sheet = cols[0].selectbox("Sheet", list(SCHEMA.keys()))
if cols[1].button("Export CSV", width="stretch"):
    download_path(export_sheet_csv(db, sheet), "Download CSV")
if cols[2].button("Backup Excel", width="stretch"):
    download_path(export_workbook_copy(db), "Download workbook")
if st.button("Create PDF report"):
    download_path(export_pdf_report(db), "Download PDF")

st.subheader("Workbook health")
st.write(f"Database: `{db.path}`")
st.dataframe(db.read("Settings"), hide_index=True, width="stretch")
