from __future__ import annotations

from pathlib import Path

import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from backend.analytics import dashboard_metrics
from backend.excel_db import ExcelDB, SCHEMA
from config import EXPORT_DIR
from utils.helpers import now_str, safe_float, today_str


def export_sheet_csv(db: ExcelDB, sheet: str) -> Path:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = EXPORT_DIR / f"{sheet}_{today_str()}.csv"
    db.read(sheet).to_csv(path, index=False)
    return path


def export_workbook_copy(db: ExcelDB) -> Path:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = EXPORT_DIR / f"math_database_backup_{today_str()}.xlsx"
    frames = {sheet: db.read(sheet) for sheet in SCHEMA}
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        for sheet, df in frames.items():
            df.to_excel(writer, sheet_name=sheet, index=False)
    return path


def sop_markdown(db: ExcelDB) -> str:
    topics = db.read("Topics")
    projects = db.read("Projects")
    research = db.read("Research_Papers")
    books = db.read("Books")
    applications = db.read("Applications")
    mastered = topics[topics["status"].astype(str).eq("Mastered")]["topic"].head(12).tolist()
    project_rows = projects[projects["completion_pct"].apply(safe_float) > 0].head(12)
    lines = [
        "# MathOS SOP Source Pack",
        f"Generated: {now_str()}",
        "",
        "## Mathematical Foundation",
        ", ".join(mastered) if mastered else "Core coursework in progress.",
        "",
        "## Projects",
    ]
    for _, row in project_rows.iterrows():
        lines.append(f"- {row['project']} / {row['module']}: {row['completion_pct']}% complete. {row['notes']}")
    lines.extend(["", "## Research Reading"])
    for _, row in research.head(12).iterrows():
        lines.append(f"- {row['title']} by {row['authors']}: {row['key_ideas']}")
    lines.extend(["", "## Books"])
    for _, row in books.head(12).iterrows():
        lines.append(f"- {row['book']} {row['chapter']}: {row['completion_pct']}%")
    lines.extend(["", "## Internship Targeting"])
    for _, row in applications.head(12).iterrows():
        lines.append(f"- {row['institute']} / {row['professor']} ({row['research_area']}): {row['status']}")
    lines.extend(["", "## Resume Bullets"])
    for _, row in project_rows.head(6).iterrows():
        lines.append(f"- Built {row['module']} module for {row['project']}, documenting mathematical assumptions and numerical behavior.")
    return "\n".join(lines)


def export_sop_markdown(db: ExcelDB) -> Path:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = EXPORT_DIR / f"sop_source_pack_{today_str()}.md"
    path.write_text(sop_markdown(db), encoding="utf-8")
    return path


def export_pdf_report(db: ExcelDB) -> Path:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = EXPORT_DIR / f"mathos_report_{today_str()}.pdf"
    metrics = dashboard_metrics(db)
    c = canvas.Canvas(str(path), pagesize=letter)
    width, height = letter
    y = height - 60
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, y, "MathOS Study Report")
    y -= 30
    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"Generated: {now_str()}")
    y -= 30
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Dashboard Metrics")
    y -= 22
    c.setFont("Helvetica", 10)
    for key, value in metrics.items():
        c.drawString(60, y, f"{key}: {value}")
        y -= 18
        if y < 70:
            c.showPage()
            y = height - 60
    c.save()
    return path
