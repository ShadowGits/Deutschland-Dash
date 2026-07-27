from __future__ import annotations

import pandas as pd
import streamlit as st

from backend.analytics import problem_stats
from backend.charts import difficulty_distribution, problem_accuracy
from backend.scheduler import due_revisions, generate_today_tasks, next_revision_date
from config import DIFFICULTY_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS
from utils.helpers import contains_text, now_str, today_str
from utils.ui import metric_grid, save_editor, setup_page

db = setup_page("Study", "π")

planner_tab, curriculum_tab, revision_tab, problems_tab, books_tab, notes_tab = st.tabs(
    ["Planner", "Curriculum", "Revision", "Problems", "Books", "Notes"]
)

with planner_tab:
    if st.button("Auto-generate tasks", type="primary"):
        count = generate_today_tasks(db)
        st.success(f"Added {count} tasks." if count else "Today's plan already exists.")
        st.rerun()

    tasks = db.read("Study_Log")
    today = today_str()
    today_tasks = tasks[tasks["date"].astype(str) == today].copy()

    with st.form("quick_task", clear_on_submit=True):
        cols = st.columns([2, 1, 1, 1])
        task = cols[0].text_input("Task")
        duration = cols[1].number_input("Minutes", min_value=5, max_value=360, value=45, step=5)
        priority = cols[2].selectbox("Priority", PRIORITY_OPTIONS, index=1)
        category = cols[3].selectbox("Category", ["Study", "Revision", "Problems", "Project", "Research", "German", "Admin"])
        notes = st.text_input("Notes")
        if st.form_submit_button("Add task"):
            db.append("Study_Log", {"date": today, "task": task, "category": category, "topic": "", "duration_minutes": duration, "priority": priority, "completed": False, "estimated_effort": 3, "notes": notes, "created_at": today})
            st.rerun()

    st.subheader("Plan")
    if today_tasks.empty:
        st.info("No tasks for today yet.")
    else:
        edited = st.data_editor(today_tasks, key="today_tasks", width="stretch", hide_index=True, column_config={"completed": st.column_config.CheckboxColumn("Done")})
        if st.button("Save today's plan", type="primary"):
            others = tasks[tasks["date"].astype(str) != today]
            db.write("Study_Log", pd.concat([others, edited], ignore_index=True))
            st.success("Plan updated.")
            st.rerun()

    st.subheader("All study log")
    save_editor(db, "Study_Log", tasks, "study_log_all")

with curriculum_tab:
    topics = db.read("Topics")
    filters = st.columns(3)
    subject = filters[0].selectbox("Subject", ["All"] + sorted(topics["subject"].astype(str).unique().tolist()))
    status = filters[1].selectbox("Status", ["All"] + STATUS_OPTIONS)
    query = filters[2].text_input("Search", key="curriculum_search")

    view = topics.copy()
    if subject != "All":
        view = view[view["subject"].astype(str) == subject]
    if status != "All":
        view = view[view["status"].astype(str) == status]
    if query:
        view = view[view.apply(lambda row: query.lower() in " ".join(map(str, row.values)).lower(), axis=1)]

    st.subheader("Topic progress")
    for _, row in view.head(12).iterrows():
        label = f"{row['subject']} · {row['topic']}"
        st.progress(min(100, max(0, int({"Not Started": 0, "Learning": 25, "Practicing": 55, "Revising": 75, "Mastered": 100}.get(str(row["status"]), 0)))), text=label)

    st.subheader("Curriculum editor")
    edited = st.data_editor(
        view,
        key="topics_editor",
        num_rows="dynamic",
        width="stretch",
        hide_index=True,
        column_config={
            "status": st.column_config.SelectboxColumn("Status", options=STATUS_OPTIONS),
            "difficulty": st.column_config.SelectboxColumn("Difficulty", options=DIFFICULTY_OPTIONS),
            "confidence": st.column_config.NumberColumn("Confidence", min_value=1, max_value=5, step=1),
            "importance": st.column_config.NumberColumn("Importance", min_value=1, max_value=5, step=1),
        },
    )
    if st.button("Save curriculum", type="primary"):
        if subject == "All" and status == "All" and not query:
            db.write("Topics", edited)
        else:
            base = topics.drop(index=view.index)
            db.write("Topics", pd.concat([base, edited], ignore_index=True))
        st.success("Curriculum saved.")
        st.rerun()

with revision_tab:
    due = due_revisions(db)
    st.subheader("Due today")
    if due.empty:
        st.success("No revision due today.")
    else:
        for idx, row in due.iterrows():
            with st.expander(f"{row['subject']} · {row['topic']} · confidence {row['confidence']}/5", expanded=True):
                quality = st.slider("Recall quality", 1, 7, 4, key=f"quality_{idx}")
                rev_notes = st.text_area("Revision notes", key=f"notes_{idx}")
                if st.button("Mark revised", key=f"revise_{idx}"):
                    settings = db.settings()
                    next_date = next_revision_date(today_str(), quality, settings)
                    all_topics = db.read("Topics")
                    all_topics.loc[idx, "last_revised"] = today_str()
                    all_topics.loc[idx, "next_revision"] = next_date
                    all_topics.loc[idx, "confidence"] = min(5, max(1, quality))
                    all_topics.loc[idx, "status"] = "Revising" if quality < 6 else "Mastered"
                    db.write("Topics", all_topics)
                    db.append("Revision", {"date": today_str(), "topic": row["topic"], "subject": row["subject"], "confidence": quality, "quality": quality, "next_revision": next_date, "notes": rev_notes})
                    st.success(f"Next review: {next_date}")
                    st.rerun()

    st.subheader("Revision history")
    save_editor(db, "Revision", db.read("Revision"), "revision_history")

with problems_tab:
    problems = db.read("Problems")
    topics_for_problems = db.read("Topics")

    with st.form("add_problem", clear_on_submit=True):
        cols = st.columns(4)
        p_date = cols[0].date_input("Date")
        p_topic = cols[1].selectbox("Topic", sorted(topics_for_problems["topic"].astype(str).unique().tolist()) if not topics_for_problems.empty else [""])
        p_difficulty = cols[2].selectbox("Difficulty", DIFFICULTY_OPTIONS)
        p_correct = cols[3].checkbox("Correct")
        p_source = st.text_input("Source")
        cols2 = st.columns(3)
        time_taken = cols2[0].number_input("Time taken (min)", min_value=0, value=20)
        hints = cols2[1].number_input("Hints used", min_value=0, value=0)
        p_confidence = cols2[2].slider("Confidence", 1, 5, 3)
        mistakes = st.text_area("Mistakes")
        if st.form_submit_button("Log problem"):
            db.append("Problems", {"date": p_date.strftime("%Y-%m-%d"), "topic": p_topic, "difficulty": p_difficulty, "source": p_source, "correct": p_correct, "time_taken": time_taken, "hints_used": hints, "confidence": p_confidence, "mistakes": mistakes})
            st.rerun()

    stats = problem_stats(problems)
    metric_grid({"Accuracy %": stats["accuracy"], "Avg Solve Time": stats["avg_time"], "Weakest Topic": stats["weakest"], "Most Attempted": stats["most_attempted"]}, 4)
    c1, c2 = st.columns(2)
    c1.plotly_chart(problem_accuracy(problems), width="stretch")
    c2.plotly_chart(difficulty_distribution(problems), width="stretch")
    save_editor(db, "Problems", problems, "problem_editor")

with books_tab:
    save_editor(db, "Books", db.read("Books"), "books_editor")

with notes_tab:
    notes_df = db.read("Notes")
    note_query = st.text_input("Search notes", key="notes_search")
    notes_view = notes_df[notes_df.apply(lambda row: contains_text(row, note_query), axis=1)] if note_query and not notes_df.empty else notes_df

    with st.form("note_form", clear_on_submit=True):
        title = st.text_input("Title")
        note_topic = st.text_input("Linked topic")
        tags = st.text_input("Tags")
        content = st.text_area("Markdown", height=180)
        if st.form_submit_button("Add note"):
            stamp = now_str()
            db.append("Notes", {"title": title, "topic": note_topic, "tags": tags, "content": content, "created_at": stamp, "updated_at": stamp})
            st.rerun()

    for _, row in notes_view.tail(8).iloc[::-1].iterrows():
        with st.expander(str(row["title"])):
            st.caption(f"{row['topic']} · {row['tags']}")
            st.markdown(str(row["content"]))

    save_editor(db, "Notes", notes_df, "notes_editor")
