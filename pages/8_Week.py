import datetime
import streamlit as st

from backend.planner_api import (
    KEY_ENV_VARS,
    fetch_week_view,
    update_task_status,
    fetch_metrics,
    projects as get_projects
)
from utils.secrets import secret as resolve_secret
from utils.ui import setup_page

db = setup_page("Week View", ":material/calendar_view_week:")

st.caption("Your Weekly goals and task breakdown pulled directly from Planner OS.")

@st.cache_data(ttl=300, show_spinner="Loading Week...")
def load_week(date_str: str | None, key: str | None):
    return fetch_week_view(date_str, key)

@st.cache_data(ttl=300, show_spinner="Loading Projects...")
def load_projects(key: str | None):
    snapshot = fetch_metrics(key)
    return {p["id"]: p["name"] for p in get_projects(snapshot)}

key = resolve_secret(*KEY_ENV_VARS)
if not key:
    st.warning("Missing Planner OS App Key.")
    st.stop()

# Date selection
today = datetime.date.today()
head = st.columns([0.4, 0.4, 0.2])
with head[0]:
    selected_date = st.date_input("Select a date", today)
with head[2]:
    if st.button("Refresh", width="stretch", icon=":material/refresh:"):
        load_week.clear()
        load_projects.clear()
        st.rerun()

data, error = load_week(str(selected_date), key)
if error or not data:
    st.error(error or "Failed to load week data.")
    st.stop()

project_names = load_projects(key)

tasks = data.get("items", [])
monthly_goals = data.get("monthly_goals", [])
weekly_goals = data.get("weekly_goals", [])
week_start = data.get("week_start", str(today))

st.subheader("FYI: Weekly Goals (AI Planned)")
if not weekly_goals:
    st.info("No weekly goals mapped by AI for this week.")
else:
    for wg in weekly_goals:
        pname = project_names.get(wg["project_id"], wg["project_id"][:8])
        st.markdown(f"**{pname}**: {wg['description']}")

st.divider()
st.subheader(f"Tasks for Week of {week_start}")

# 7 columns for vertical lanes
days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
start_date = datetime.date.fromisoformat(week_start)
cols = st.columns(7)

for i, col in enumerate(cols):
    current_day = start_date + datetime.timedelta(days=i)
    with col:
        st.markdown(f"**{days_of_week[i]}**\n\n`{current_day.strftime('%b %d')}`")
        day_tasks = [t for t in tasks if t.get("scheduled_date") == current_day.isoformat() or t.get("due_date") == current_day.isoformat()]
        
        for task in day_tasks:
            with st.container(border=True):
                is_done = task["done"]
                # We use a distinct key incorporating status so checking it forces a redraw and trigger
                changed = st.checkbox(
                    task["title"],
                    value=is_done,
                    key=f"task_{task['id']}_{is_done}"
                )
                
                if changed != is_done:
                    st.toast("Updating Planner OS...", icon="🔄")
                    update_task_status(task["id"], changed, key)
                    load_week.clear()
                    st.rerun()
                
                # Context
                meta = []
                if task.get("start_time"):
                    meta.append(f"🕒 {task['start_time']}")
                if task.get("priority") == "high":
                    meta.append("🔥 High")
                
                if meta:
                    st.caption(" | ".join(meta))

st.divider()
st.subheader("FYI: Current Month's Goals")
if not monthly_goals:
    st.info("No monthly goals set for this month. Add them in Mission Control.")
else:
    for mg in monthly_goals:
        pname = project_names.get(mg["project_id"], mg["project_id"][:8])
        st.markdown(f"**{pname}**: {mg['description']}")
