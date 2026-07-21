from __future__ import annotations

import os

import pandas as pd
import streamlit as st

from backend.planner_api import (
    TOKEN_ENV_VAR,
    fetch_metrics_with_status,
    projects,
    streaks,
    totals,
    upcoming_deadlines,
)
from utils.ui import metric_grid, setup_page

db = setup_page("Mission control", ":material/flag:")

st.caption(
    "The strategic layer from Planner OS — projects, milestones and deadlines that the daily task grind hides. "
    "German A1 progress is not shown here; it lives on the German page and stays sourced from the workbook."
)


@st.cache_data(ttl=300, show_spinner="Reading Planner OS…")
def load_snapshot(token: str | None) -> tuple[dict | None, str | None]:
    return fetch_metrics_with_status(token=token)


def configured_token() -> str | None:
    """Secrets win in a deployment, env var covers local runs.

    st.secrets raises rather than returning None when no secrets.toml exists at all,
    so this must be guarded — otherwise the page crashes on exactly the path it is
    meant to handle gracefully.
    """
    try:
        secret = st.secrets.get(TOKEN_ENV_VAR)
    except Exception:  # noqa: BLE001 - no secrets file configured is normal locally
        secret = None
    return secret or os.environ.get(TOKEN_ENV_VAR) or None


snapshot, error = load_snapshot(configured_token())

head = st.columns([0.8, 0.2])
with head[1]:
    if st.button("Refresh", width="stretch", icon=":material/refresh:"):
        load_snapshot.clear()
        st.rerun()

if snapshot is None:
    st.warning(f"Strategic view unavailable — {error}")
    st.caption(
        f"Set `{TOKEN_ENV_VAR}` in `.streamlit/secrets.toml` (gitignored) for local use, "
        "or in your host's secrets for a deployment. Everything else in the dashboard works without it."
    )
    st.stop()

with head[0]:
    st.caption(f"Snapshot generated {snapshot.get('generated_on', '—')} · {snapshot.get('timezone', '')}")

total = totals(snapshot)
metric_grid({
    "Open tasks": total.get("open_tasks", "—"),
    "Overdue": total.get("overdue_tasks", "—"),
    "Done today": total.get("completed_today", "—"),
    "Done last 7 days": total.get("completions_last_7_days", "—"),
}, 4)

streak_values = streaks(snapshot)
if streak_values:
    with st.container(horizontal=True):
        for name, days in sorted(streak_values.items()):
            icon = "🔥" if days else "💤"
            st.metric(f"{icon} {name.title()} streak", f"{days}d", border=True)

st.subheader("Projects")
project_rows = projects(snapshot)
if not project_rows:
    st.info("No projects in Planner OS yet.")
else:
    for chunk_start in range(0, len(project_rows), 3):
        row = project_rows[chunk_start:chunk_start + 3]
        for column, project in zip(st.columns(len(row)), row):
            with column, st.container(border=True):
                st.markdown(f"**{project.get('name', 'Untitled')}**")
                st.caption(f"{project.get('track', '—')} · {project.get('status', '—')}")

                pct = float(project.get("completion_pct") or 0)
                st.progress(min(int(pct), 100), text=f"{pct:.0f}% complete")

                open_tasks = project.get("open_tasks", 0)
                total_tasks = project.get("total_tasks", 0)
                done_ms = project.get("milestones_done", 0)
                total_ms = project.get("milestones_total", 0)
                st.caption(f"{open_tasks}/{total_tasks} tasks open · {done_ms}/{total_ms} milestones done")

                nxt = project.get("next_milestone")
                if nxt:
                    st.caption(f"Next: **{nxt.get('name', '—')}** by {nxt.get('target_date', '—')}")
                else:
                    st.caption("No milestone set.")

st.subheader("Upcoming deadlines")
deadline_rows = upcoming_deadlines(snapshot)
if not deadline_rows:
    st.success("Nothing on the horizon from Planner OS.")
else:
    frame = pd.DataFrame(deadline_rows)

    def urgency(row: pd.Series) -> str:
        if row.get("overdue"):
            return "🔴 Overdue"
        days = row.get("days_left")
        if days is None:
            return "⚪ Undated"
        if days <= 14:
            return "🟠 Soon"
        return "🟢 On track"

    frame.insert(0, "urgency", frame.apply(urgency, axis=1))
    st.dataframe(
        frame,
        hide_index=True,
        width="stretch",
        column_config={
            "urgency": st.column_config.TextColumn("", width="small"),
            "kind": st.column_config.TextColumn("Kind", width="small"),
            "name": st.column_config.TextColumn("What", width="large"),
            "date": st.column_config.TextColumn("Date", width="small"),
            "days_left": st.column_config.NumberColumn("Days left", width="small"),
            "overdue": st.column_config.CheckboxColumn("Overdue", width="small"),
        },
    )
