from __future__ import annotations

import datetime
import pandas as pd
import streamlit as st

from backend.planner_api import (
    KEY_ENV_VARS,
    fetch_dashboard_with_status,
    flat_map,
    projects,
    streaks,
    totals,
    upcoming_deadlines,
)
from utils.secrets import secret as resolve_secret
from utils.ui import metric_grid, setup_page

db = setup_page("Mission control", ":material/flag:")

st.caption(
    "The strategic layer from Planner OS — projects, milestones and deadlines that the daily task grind hides."
)


@st.cache_data(ttl=300, show_spinner="Reading Planner OS…")
def load_data(key: str | None) -> tuple[dict | None, dict | None, str | None]:
    """Return (snapshot, flat, error). Exactly one of snapshot/error is non-None."""
    data, error = fetch_dashboard_with_status(key=key)
    if data is None:
        return None, None, error
    return data.get("snapshot"), flat_map(data), None


snapshot, flat, error = load_data(resolve_secret(*KEY_ENV_VARS))

head = st.columns([0.8, 0.2])
with head[1]:
    if st.button("Refresh", width="stretch", icon=":material/refresh:"):
        load_data.clear()
        st.rerun()

if snapshot is None:
    st.warning(f"Strategic view unavailable — {error}")
    st.caption(
        f"Set `{KEY_ENV_VARS[0]}` in `.streamlit/secrets.toml` (gitignored) for local use, "
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

# ----- German A1 quick-glance (hardcoded left=64 until the flat/workbook conflict is resolved) -----
GERMAN_UNITS_TOTAL = 70
GERMAN_UNITS_LEFT = 64  # TODO: integrate from flat_map once the doc conflict is reconciled
german_done = GERMAN_UNITS_TOTAL - GERMAN_UNITS_LEFT
german_pct = int(german_done / GERMAN_UNITS_TOTAL * 100)
with st.container(border=True):
    gcol1, gcol2 = st.columns([0.7, 0.3])
    with gcol1:
        st.markdown("**🇩🇪 German A1**")
        st.progress(german_pct, text=f"{german_done}/{GERMAN_UNITS_TOTAL} units done ({german_pct}%)")
    with gcol2:
        st.metric("Units left", GERMAN_UNITS_LEFT)

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

                mg = project.get("monthly_goal")
                pid = project["id"]
                with st.expander("Monthly Goal", expanded=False):
                    if mg:
                        new_desc = st.text_area("Description", mg["description"], key=f"mg_{mg['id']}", height=100)
                        if st.button("Save Updates", key=f"save_mg_{mg['id']}"):
                            res, err = update_monthly_goal(mg["id"], new_desc, key)
                            if err:
                                st.error(err)
                            else:
                                st.success("Saved!")
                                load_data.clear()
                                st.rerun()
                    else:
                        new_desc = st.text_area("Description", placeholder="Enter goal for this month...", key=f"new_mg_{pid}", height=100)
                        if st.button("Add Goal", key=f"add_mg_{pid}"):
                            if not new_desc.strip():
                                st.error("Description cannot be empty.")
                            else:
                                month_start = datetime.date.today().replace(day=1).isoformat()
                                res, err = add_monthly_goal(pid, month_start, new_desc, key)
                                if err:
                                    st.error(err)
                                else:
                                    st.success("Goal added!")
                                    load_data.clear()
                                    st.rerun()

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
