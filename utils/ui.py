from __future__ import annotations

import html
from pathlib import Path
from typing import Iterable

import pandas as pd
import streamlit as st

from backend.excel_db import ExcelDB
from config import APP_NAME, ASSETS_DIR
from utils.helpers import contains_text


def setup_page(title: str, icon: str = "∑") -> ExcelDB:
    st.set_page_config(page_title=f"{title} · {APP_NAME}", page_icon=icon, layout="wide", initial_sidebar_state="expanded")
    css_path = ASSETS_DIR / "styles.css"
    if css_path.exists():
        st.markdown(f"<style>{css_path.read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)
    st.sidebar.title("MathOS")
    st.sidebar.caption("Germany 2027 command center")
    st.title(title)
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


def pace_panel(db: ExcelDB, tracks: list[tuple[str, str]] | None = None) -> None:
    """Render the Planner OS burn-down mirror: pace per track + last-synced note."""
    from backend.planner_sync import burndown, read_snapshot

    tracks = tracks or [("german", "German A1"), ("ignou", "IGNOU Math")]
    snap = read_snapshot(db)
    if not snap:
        st.info("No Planner OS sync yet. Ask Claude to sync your planner to populate the burn-down.")
        return

    cols = st.columns(len(tracks))
    for col, (track, label) in zip(cols, tracks):
        bd = burndown(snap, track)
        with col:
            dot = _PACE_COLOR.get(bd["status"], "⚪")
            st.metric(f"{dot} {label}", f"{bd['left']} left", f"{bd['status']}", delta_color="off")
            if bd["days_to_target"] is not None:
                buffer = bd["buffer_days"]
                buffer_txt = f"{buffer} days slack" if buffer is not None and buffer >= 0 else f"{abs(buffer)} days behind"
                st.caption(f"{bd['done']}/{bd['total']} done · {bd['days_to_target']} days to target · {buffer_txt}")
            if track == "german" and str(snap.get("german_missed_today", "")).lower() in {"true", "1", "yes"}:
                st.caption("⚠️ Missed today — a replan will redistribute it.")

    synced = snap.get("last_synced", "—")
    replan = snap.get("last_replan", "")
    st.caption(f"Planner OS synced: {synced}" + (f" · last replan: {replan}" if replan else ""))
