from __future__ import annotations

import random

import streamlit as st

from backend.analytics import dashboard_metrics, load_frames, recent_activity, upcoming_deadlines
from backend.charts import track_progress_bars, weekly_hours
from backend.progress import track_overview
from backend.scheduler import generate_today_tasks
from utils.constants import QUOTES
from utils.helpers import today_str
from utils.ui import metric_grid, pace_panel, setup_page

db = setup_page("Germany 2027 Dashboard", "🇩🇪")

top = st.columns([0.7, 0.3])
with top[0]:
    st.caption("Everything for the move: math, research, documents, tests, B1, SOP, finance, colleges, visa.")
with top[1]:
    if st.button("Generate today's plan", width="stretch"):
        count = generate_today_tasks(db)
        st.success(f"Added {count} tasks for today." if count else "Today's plan already exists.")

metrics = dashboard_metrics(db)
metric_grid(metrics, columns=4)

st.subheader("Daily pace")
st.caption("Live burn-down from Planner OS — are you keeping up with German and math?")
pace_panel(db)

frames = load_frames(db)
tasks = frames["Study_Log"]

left, right = st.columns([0.55, 0.45])
with left:
    st.subheader("Track progress")
    st.plotly_chart(track_progress_bars(track_overview(frames)), width="stretch")
with right:
    st.subheader("Upcoming deadlines (45 days)")
    deadlines = upcoming_deadlines(frames)
    if deadlines.empty:
        st.success("Nothing due in the next 45 days.")
    else:
        st.dataframe(deadlines, width="stretch", hide_index=True)
    st.subheader("Weekly study hours")
    st.plotly_chart(weekly_hours(tasks), width="stretch")

feed_col, focus_col = st.columns(2)
with feed_col:
    st.subheader("Recent activity")
    st.dataframe(recent_activity(db), width="stretch", hide_index=True)
with focus_col:
    st.subheader("Today's focus")
    active = tasks[(tasks["date"].astype(str) == today_str()) & (~tasks["completed"].astype(str).str.lower().isin(["true", "yes", "1"]))]
    st.write(active["task"].head(5).tolist() or ["Generate a plan or add your first task."])
    st.info(random.choice(QUOTES))
