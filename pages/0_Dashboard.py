from __future__ import annotations

import datetime
import pandas as pd
import streamlit as st

from backend.planner_api import (
    KEY_ENV_VARS,
    add_monthly_goal,
    fetch_dashboard_with_status,
    flat_map,
    projects,
    streaks,
    totals,
    update_monthly_goal,
    upcoming_deadlines as get_upcoming_deadlines,
    fetch_week_view,
    update_task_status,
)
from utils.secrets import secret as resolve_secret
from utils.ui import metric_grid, setup_page, pace_panel

db = setup_page("Dashboard", ":material/dashboard:")

st.caption("Strategic overview and Today's focus from Planner OS.")

api_key = resolve_secret(*KEY_ENV_VARS)

@st.cache_data(ttl=300, show_spinner="Reading Planner OS…")
def load_data(key: str | None) -> tuple[dict | None, dict | None, str | None]:
    data, error = fetch_dashboard_with_status(key=key)
    if data is None:
        return None, None, error
    return data.get("snapshot"), flat_map(data), None

@st.cache_data(ttl=300, show_spinner="Loading Today's tasks...")
def load_today(date_str: str | None, key: str | None):
    return fetch_week_view(date_str, key)

snapshot, flat, error = load_data(api_key)

head = st.columns([0.8, 0.2])
with head[1]:
    if st.button("Refresh", width="stretch", icon=":material/refresh:"):
        load_data.clear()
        load_today.clear()
        st.rerun()

if snapshot is None:
    st.warning(f"Strategic view unavailable — {error}")
    st.stop()

with head[0]:
    st.caption(f"Snapshot generated {snapshot.get('generated_on', '—')} · {snapshot.get('timezone', '')}")

# 1. Macro Metrics
total = totals(snapshot)
metric_grid({
    "Open tasks": total.get("open_tasks", "—"),
    "Overdue": total.get("overdue_tasks", "—"),
    "Done today": total.get("completed_today", "—"),
    "Done last 7 days": total.get("completions_last_7_days", "—"),
}, 4)

# 2. Pace Panel & Streaks
st.subheader("Daily Pace")
pace_panel(flat)

streak_values = streaks(snapshot)
if streak_values:
    with st.container(horizontal=True):
        for name, days in sorted(streak_values.items()):
            icon = "🔥" if days else "💤"
            st.metric(f"{icon} {name.title()} streak", f"{days}d", border=True)

# 3. Today's Focus
st.subheader("Today's Focus")
today = datetime.date.today()
today_data, today_error = load_today(str(today), api_key)

if today_error or not today_data:
    st.warning(today_error or "Failed to load today's tasks.")
else:
    tasks = today_data.get("items", [])
    day_tasks = [t for t in tasks if t.get("scheduled_date") == today.isoformat() or t.get("due_date") == today.isoformat()]
    
    if not day_tasks:
        st.info("No tasks scheduled for today in Planner OS.")
    else:
        for task in day_tasks:
            with st.container(border=True):
                is_done = task["done"]
                changed = st.checkbox(
                    task["title"],
                    value=is_done,
                    key=f"today_task_{task['id']}_{is_done}"
                )
                
                if changed != is_done:
                    st.toast("Updating Planner OS...", icon="🔄")
                    update_task_status(task["id"], changed, api_key)
                    load_today.clear()
                    st.rerun()
                
                meta = []
                if task.get("start_time"):
                    meta.append(f"🕒 {task['start_time']}")
                if task.get("priority") == "high":
                    meta.append("🔥 High")
                
                if meta:
                    st.caption(" | ".join(meta))

# 4. Projects
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
                            res, err = update_monthly_goal(mg["id"], new_desc, api_key)
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
                                res, err = add_monthly_goal(pid, month_start, new_desc, api_key)
                                if err:
                                    st.error(err)
                                else:
                                    st.success("Goal added!")
                                    load_data.clear()
                                    st.rerun()

# 5. Upcoming deadlines
st.subheader("Upcoming deadlines")
deadline_rows = get_upcoming_deadlines(snapshot)
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
