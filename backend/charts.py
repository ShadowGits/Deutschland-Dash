from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from backend.progress import STATUS_WEIGHT
from utils.helpers import parse_date, safe_float

PLOT_TEMPLATE = "plotly_white"
COLORWAY = ["#1a73e8", "#f9ab00", "#d93025", "#1e8e3e", "#9334e6", "#e8710a"]


def weekly_hours(tasks: pd.DataFrame) -> go.Figure:
    start = date.today() - timedelta(days=27)
    rows = []
    for i in range(28):
        day = start + timedelta(days=i)
        rows.append({"date": day, "hours": 0.0})
    base = pd.DataFrame(rows)
    if not tasks.empty:
        df = tasks.copy()
        df["_date"] = df["date"].apply(parse_date)
        done = df["completed"].astype(str).str.lower().isin(["true", "yes", "1"])
        grouped = df[done].groupby("_date")["duration_minutes"].sum().reset_index()
        grouped["hours"] = grouped["duration_minutes"].apply(safe_float) / 60
        base = base.merge(grouped[["_date", "hours"]], left_on="date", right_on="_date", how="left", suffixes=("", "_actual"))
        base["hours"] = base["hours_actual"].fillna(base["hours"])
    fig = px.bar(base, x="date", y="hours", template=PLOT_TEMPLATE, color_discrete_sequence=[COLORWAY[0]])
    fig.update_layout(height=300, margin=dict(l=8, r=8, t=24, b=8), xaxis_title="", yaxis_title="Hours")
    return fig


def topic_completion(topics: pd.DataFrame) -> go.Figure:
    if topics.empty:
        data = pd.DataFrame({"subject": ["No data"], "completion": [0]})
    else:
        data = topics.assign(completion=topics["status"].map(STATUS_WEIGHT).fillna(0)).groupby("subject", as_index=False)["completion"].mean()
    fig = px.bar(data, x="completion", y="subject", orientation="h", template=PLOT_TEMPLATE, color="completion", color_continuous_scale="Teal")
    fig.update_layout(height=360, margin=dict(l=8, r=8, t=24, b=8), xaxis_range=[0, 100], xaxis_title="Completion %", yaxis_title="")
    return fig


def confidence_radar(topics: pd.DataFrame) -> go.Figure:
    if topics.empty:
        data = pd.DataFrame({"subject": ["No data"], "confidence": [0]})
    else:
        data = topics.groupby("subject", as_index=False)["confidence"].mean()
    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(r=data["confidence"], theta=data["subject"], fill="toself", line_color=COLORWAY[3]))
    fig.update_layout(template=PLOT_TEMPLATE, height=360, margin=dict(l=24, r=24, t=24, b=24), polar=dict(radialaxis=dict(visible=True, range=[0, 5])))
    return fig


def problem_accuracy(problems: pd.DataFrame) -> go.Figure:
    if problems.empty:
        data = pd.DataFrame({"topic": ["No data"], "accuracy": [0]})
    else:
        correct = problems["correct"].astype(str).str.lower().isin(["true", "yes", "1"])
        data = problems.assign(correct=correct).groupby("topic", as_index=False)["correct"].mean()
        data["accuracy"] = data["correct"] * 100
    fig = px.bar(data, x="topic", y="accuracy", template=PLOT_TEMPLATE, color_discrete_sequence=[COLORWAY[1]])
    fig.update_layout(height=320, margin=dict(l=8, r=8, t=24, b=8), yaxis_range=[0, 100], xaxis_title="", yaxis_title="Accuracy %")
    return fig


def difficulty_distribution(problems: pd.DataFrame) -> go.Figure:
    if problems.empty:
        data = pd.DataFrame({"difficulty": ["No data"], "count": [1]})
    else:
        data = problems["difficulty"].value_counts().rename_axis("difficulty").reset_index(name="count")
    fig = px.pie(data, names="difficulty", values="count", template=PLOT_TEMPLATE, color_discrete_sequence=COLORWAY)
    fig.update_layout(height=300, margin=dict(l=8, r=8, t=24, b=8))
    return fig


def project_progress(projects: pd.DataFrame) -> go.Figure:
    if projects.empty:
        data = pd.DataFrame({"module": ["No data"], "completion_pct": [0]})
    else:
        data = projects.copy()
        data["completion_pct"] = data["completion_pct"].apply(safe_float)
    fig = px.bar(data, x="completion_pct", y="module", orientation="h", template=PLOT_TEMPLATE, color_discrete_sequence=[COLORWAY[2]])
    fig.update_layout(height=330, margin=dict(l=8, r=8, t=24, b=8), xaxis_range=[0, 100], xaxis_title="Completion %", yaxis_title="")
    return fig


def track_progress_bars(tracks: dict[str, float]) -> go.Figure:
    data = pd.DataFrame({"track": list(tracks.keys()), "progress": list(tracks.values())})
    data = data.sort_values("progress")
    fig = px.bar(data, x="progress", y="track", orientation="h", template=PLOT_TEMPLATE, color="progress", color_continuous_scale="Blues", range_color=[0, 100])
    fig.update_layout(height=380, margin=dict(l=8, r=8, t=24, b=8), xaxis_range=[0, 100], xaxis_title="Progress %", yaxis_title="", coloraxis_showscale=False)
    return fig


def milestone_timeline(milestones: pd.DataFrame) -> go.Figure:
    if milestones.empty:
        return go.Figure().update_layout(template=PLOT_TEMPLATE, height=300)
    df = milestones.copy()
    df["_date"] = pd.to_datetime(df["target_date"], errors="coerce")
    df = df.dropna(subset=["_date"]).sort_values("_date")
    df["done"] = df["status"].astype(str).eq("Done").map({True: "Done", False: "Pending"})
    fig = px.scatter(df, x="_date", y="track", text="milestone", color="done", template=PLOT_TEMPLATE, color_discrete_map={"Done": COLORWAY[3], "Pending": COLORWAY[0]})
    fig.update_traces(marker=dict(size=12), textposition="top center", textfont_size=10)
    fig.add_vline(x=pd.Timestamp.today(), line_dash="dash", line_color=COLORWAY[2])
    fig.update_layout(height=420, margin=dict(l=8, r=8, t=24, b=8), xaxis_title="", yaxis_title="", legend_title="")
    return fig


def savings_progress(goals: pd.DataFrame) -> go.Figure:
    if goals.empty:
        return go.Figure().update_layout(template=PLOT_TEMPLATE, height=300)
    df = goals.copy()
    df["target"] = df["target_amount"].apply(safe_float)
    df["saved"] = df["saved_amount"].apply(safe_float)
    fig = go.Figure()
    fig.add_trace(go.Bar(y=df["goal"], x=df["target"], orientation="h", name="Target", marker_color="#dadce0"))
    fig.add_trace(go.Bar(y=df["goal"], x=df["saved"], orientation="h", name="Saved", marker_color=COLORWAY[3]))
    fig.update_layout(template=PLOT_TEMPLATE, barmode="overlay", height=340, margin=dict(l=8, r=8, t=24, b=8), xaxis_title="EUR", yaxis_title="")
    return fig


def monthly_cashflow(log: pd.DataFrame) -> go.Figure:
    if log.empty:
        return go.Figure().update_layout(template=PLOT_TEMPLATE, height=280)
    df = log.copy()
    df["_date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["_date"])
    df["month"] = df["_date"].dt.to_period("M").astype(str)
    df["amount"] = df["amount"].apply(safe_float)
    grouped = df.groupby(["month", "type"], as_index=False)["amount"].sum()
    fig = px.bar(grouped, x="month", y="amount", color="type", barmode="group", template=PLOT_TEMPLATE, color_discrete_map={"saved": COLORWAY[3], "spent": COLORWAY[2]})
    fig.update_layout(height=280, margin=dict(l=8, r=8, t=24, b=8), xaxis_title="", yaxis_title="Amount", legend_title="")
    return fig


def heatmap(tasks: pd.DataFrame) -> go.Figure:
    days = []
    start = date.today() - timedelta(days=83)
    for i in range(84):
        d = start + timedelta(days=i)
        days.append({"date": d, "week": i // 7, "weekday": d.strftime("%a"), "hours": 0.0})
    base = pd.DataFrame(days)
    if not tasks.empty:
        df = tasks.copy()
        df["_date"] = df["date"].apply(parse_date)
        done = df["completed"].astype(str).str.lower().isin(["true", "yes", "1"])
        grouped = df[done].groupby("_date")["duration_minutes"].sum().reset_index()
        grouped["hours_actual"] = grouped["duration_minutes"].apply(safe_float) / 60
        base = base.merge(grouped[["_date", "hours_actual"]], left_on="date", right_on="_date", how="left")
        base["hours"] = base["hours_actual"].fillna(base["hours"])
    pivot = base.pivot(index="weekday", columns="week", values="hours").reindex(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
    fig = px.imshow(pivot, template=PLOT_TEMPLATE, color_continuous_scale="Viridis", aspect="auto")
    fig.update_layout(height=260, margin=dict(l=8, r=8, t=24, b=8), xaxis_title="Week", yaxis_title="")
    return fig
