from __future__ import annotations

import html
from pathlib import Path
from typing import Iterable
import datetime

import pandas as pd
import streamlit as st

from backend.excel_db import ExcelDB
from config import APP_NAME, ASSETS_DIR
from utils.helpers import contains_text
from backend.planner_api import KEY_ENV_VARS, fetch_dashboard_with_status, add_monthly_goal, update_monthly_goal, delete_monthly_goal, projects as get_projects
from utils.secrets import secret as resolve_secret

@st.cache_data(ttl=300, show_spinner=False)
def _load_planner_os_projects(key: str | None) -> list[dict]:
    data, _ = fetch_dashboard_with_status(key=key)
    if not data: return []
    return get_projects(data.get("snapshot"))


def setup_page(title: str, icon: str = "∑") -> ExcelDB:
    css_path = ASSETS_DIR / "styles.css"
    if css_path.exists():
        st.markdown(f"<style>{css_path.read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)
    st.title(title)
    
    if title in ["Study", "Internship and Project", "Germany", "Language", "Colleges", "Finance", "Fitness", "Piano", "Reading"]:
        key = resolve_secret(*KEY_ENV_VARS)
        project_rows = _load_planner_os_projects(key)
        project = next((p for p in project_rows if p.get("name", "").lower() == title.lower()), None)
        
        if project:
            mg = project.get("monthly_goal")
            pid = project["id"]
            st.subheader("Monthly Goals")
            
            goals = project.get("monthly_goals", [])
            # Fallback for backward compatibility while old snapshot is cached
            if not goals and project.get("monthly_goal"):
                goals = [project["monthly_goal"]]

            import pandas as pd
            if goals:
                df = pd.DataFrame(goals)[["id", "month", "description", "status"]]
            else:
                df = pd.DataFrame(columns=["id", "month", "description", "status"])

            # Month options (past 2 months + current + next 6)
            today = datetime.date.today()
            month_options = []
            for i in range(-2, 7):
                m = today.month + i
                y = today.year + (m - 1) // 12
                m = (m - 1) % 12 + 1
                month_options.append(datetime.date(y, m, 1).isoformat())

            # Highlight past months visually using pandas Styler if supported, 
            # but st.data_editor styling with Styler disables editing in Streamlit < 1.30
            # So we will just show them in the table.
            
            editor_key = f"goals_editor_{pid}"
            
            with st.form(key=f"goals_form_{pid}", border=False):
                st.data_editor(
                    df,
                    column_config={
                        "id": None, # hidden
                        "month": st.column_config.SelectboxColumn(
                            "Month",
                            options=month_options,
                            required=True,
                            width="medium",
                        ),
                        "description": st.column_config.TextColumn(
                            "Description",
                            required=True,
                            width="large",
                        ),
                        "status": st.column_config.TextColumn(
                            "Status",
                            disabled=True,
                            width="small"
                        )
                    },
                    num_rows="dynamic",
                    key=editor_key,
                    hide_index=True,
                    use_container_width=True,
                )
                
                submitted = st.form_submit_button("Save Changes")
                if submitted:
                    changes = st.session_state.get(editor_key, {})
                    added = changes.get("added_rows", [])
                    edited = changes.get("edited_rows", {})
                    deleted = changes.get("deleted_rows", [])
                    
                    has_error = False
                    
                    # 1. Adds
                    for add in added:
                        if "month" in add and "description" in add:
                            _, err = add_monthly_goal(pid, add["month"], add["description"], key)
                            if err:
                                st.error(err)
                                has_error = True
                    
                    # 2. Edits
                    for row_idx_str, edits in edited.items():
                        row_idx = int(row_idx_str)
                        goal_id = df.iloc[row_idx]["id"]
                        if "description" in edits:
                            _, err = update_monthly_goal(goal_id, edits["description"], key)
                            if err:
                                st.error(err)
                                has_error = True
                    
                    # 3. Deletes
                    for row_idx in deleted:
                        goal_id = df.iloc[row_idx]["id"]
                        _, err = delete_monthly_goal(goal_id, key)
                        if err:
                            st.error(err)
                            has_error = True
                    
                    if not has_error and (added or edited or deleted):
                        st.success("Goals updated successfully!")
                        _load_planner_os_projects.clear()
                        st.rerun()

    db = ExcelDB()
    with st.sidebar.expander("Global Search"):
        query = st.text_input("Search", key=f"global_search_{title}")
        if query:
            for sheet, label in [("Topics", "Topics"), ("Books", "Books"), ("Problems", "Problems"), ("Research_Papers", "Papers"), ("Projects", "Projects"), ("Notes", "Notes"), ("Colleges", "Colleges"), ("Germany_Documents", "Documents"), ("Milestones", "Milestones")]:
                df = db.read(sheet)
                hits = df[df.apply(lambda row: contains_text(row, query), axis=1)].head(5) if not df.empty else df
                if not hits.empty:
                    st.caption(label)
                    st.dataframe(hits, hide_index=True, width="stretch")
    return db


def metric_grid(metrics: dict[str, object], columns: int = 4) -> None:
    cols = st.columns(columns)
    for index, (label, value) in enumerate(metrics.items()):
        with cols[index % columns]:
            st.metric(label, value)


def card(title: str, body: str, value: str | None = None) -> None:
    safe_title = html.escape(title)
    safe_body = html.escape(body)
    safe_value = html.escape(value or "")
    st.markdown(
        f"""
        <div class="mathos-card">
          <div class="metric-label">{safe_title}</div>
          <div class="metric-value">{safe_value}</div>
          <div class="section-note">{safe_body}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def badges(values: Iterable[str]) -> None:
    rendered = "".join(f'<span class="badge">{html.escape(str(v))}</span>' for v in values if str(v).strip())
    st.markdown(rendered or '<span class="badge">No entries yet</span>', unsafe_allow_html=True)


def save_editor(db: ExcelDB, sheet: str, df: pd.DataFrame, key: str) -> None:
    edited = st.data_editor(df, key=key, num_rows="dynamic", width="stretch", hide_index=True)
    if st.button("Save changes", key=f"save_{key}", type="primary"):
        db.write(sheet, edited)
        st.success(f"Saved {sheet}.")
        st.rerun()


def download_path(path: Path, label: str) -> None:
    st.success(f"Created {path.name}")
    st.download_button(label, data=path.read_bytes(), file_name=path.name)


_PACE_COLOR = {"Behind": "🔴", "Tight": "🟠", "On pace": "🟢", "Due": "🔴", "Unknown": "⚪"}
_DAILY_CAPACITY = {"language": 2, "ignou": 1}
_SESSIONS_PER_UNIT = {"language": 2}


def _burndown(flat: dict[str, str], track: str) -> dict[str, object]:
    """Compute pace for a track from the API's flat key/value map."""
    import math
    from utils.helpers import parse_date, safe_float

    today = datetime.date.today()
    divisor = _SESSIONS_PER_UNIT.get(track, 1)
    total = int(safe_float(flat.get(f"{track}_units_total"), 0)) // divisor
    left = int(safe_float(flat.get(f"{track}_units_left"), 0)) // divisor
    done = max(total - left, 0)
    capacity = _DAILY_CAPACITY.get(track, 1)

    target = parse_date(flat.get(f"{track}_target_date"))
    days_to_target = (target - today).days if target else None

    days_needed = math.ceil(left / capacity) if capacity else left
    buffer = (days_to_target - days_needed) if days_to_target is not None else None

    if days_to_target is not None and days_to_target <= 0:
        status = "Due"
    elif buffer is None:
        status = "Unknown"
    elif buffer < 0:
        status = "Behind"
    elif buffer <= 2:
        status = "Tight"
    else:
        status = "On pace"

    return {"total": total, "done": done, "left": left, "days_to_target": days_to_target, "buffer_days": buffer, "status": status}


def pace_panel(flat: dict[str, str] | None = None, tracks: list[tuple[str, str]] | None = None) -> None:
    """Render live burn-down from the Planner OS API flat_map."""
    if not flat:
        key = resolve_secret(*KEY_ENV_VARS)
        if key:
            from backend.planner_api import fetch_dashboard_with_status, flat_map
            data, _ = fetch_dashboard_with_status(key=key)
            flat = flat_map(data) if data else {}
    if not flat:
        st.info("Planner OS not connected — set the app key to see pace data.")
        return

    tracks = tracks or [("language", "German A1"), ("ignou", "IGNOU Math")]
    cols = st.columns(len(tracks))
    for col, (track, label) in zip(cols, tracks):
        bd = _burndown(flat, track)
        with col:
            if not bd["total"]:
                st.caption(f"{label}: no data from Planner OS")
                continue
            dot = _PACE_COLOR.get(bd["status"], "⚪")
            st.metric(f"{dot} {label}", f"{bd['left']} left", f"{bd['status']}", delta_color="off")
            if bd["days_to_target"] is not None:
                buffer = bd["buffer_days"]
                buffer_txt = f"{buffer} days slack" if buffer is not None and buffer >= 0 else f"{abs(buffer)} days behind"
                st.caption(f"{bd['done']}/{bd['total']} done · {bd['days_to_target']} days to target · {buffer_txt}")
