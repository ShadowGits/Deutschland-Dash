from __future__ import annotations

import re

import pandas as pd
import streamlit as st

from backend.progress import docs_progress, language_progress, tests_progress, visa_progress
from config import DOC_CATEGORY_OPTIONS, TEST_STATUS_OPTIONS, TRACK_STATUS_OPTIONS, UPLOADS_DIR
from utils.ui import metric_grid, setup_page


def _slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", str(text)).strip("_") or "file"

db = setup_page("Germany", "🇩🇪")

docs = db.read("Germany_Documents")
tests = db.read("Tests")
language = db.read("Language")

metric_grid({
    "Documents %": docs_progress(docs),
    "Tests %": tests_progress(tests),
    "German B1 %": language_progress(language),
    "Visa & Passport %": visa_progress(docs),
}, 4)

st.caption("German study lives on its own page now — see **German** in the sidebar for the A1 plan, grammar ladder, and pace.")

docs_tab, tests_tab, visa_tab = st.tabs(["Documents", "Tests", "Visa & Passport"])

DOC_COLUMN_CONFIG = {
    "category": st.column_config.SelectboxColumn("Category", options=DOC_CATEGORY_OPTIONS),
    "status": st.column_config.SelectboxColumn("Status", options=TRACK_STATUS_OPTIONS),
    "needs_apostille": st.column_config.CheckboxColumn("Apostille"),
    "needs_translation": st.column_config.CheckboxColumn("Translation"),
}

with docs_tab:
    st.caption("Every certificate, translation, and apostille needed for applications and the visa file.")
    edited_docs = st.data_editor(docs, key="docs_editor", num_rows="dynamic", width="stretch", hide_index=True, column_config=DOC_COLUMN_CONFIG)
    if st.button("Save documents", type="primary"):
        db.write("Germany_Documents", edited_docs)
        st.success("Documents saved.")
        st.rerun()

    st.divider()
    st.subheader("Attached files")
    st.caption("Upload scans/PDFs and link them to a document. Stored in data/uploads/.")
    doc_names = [d for d in docs["document"].astype(str).tolist() if d.strip()]
    target_doc = st.selectbox("Document", doc_names, key="upload_target_doc") if doc_names else None
    uploaded = st.file_uploader("Files", accept_multiple_files=True, key="doc_file_uploader")
    if uploaded and target_doc and st.button("Attach files", type="primary", key="attach_files"):
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        for file in uploaded:
            (UPLOADS_DIR / f"{_slug(target_doc)}__{_slug(file.name)}").write_bytes(file.getbuffer())
        st.success(f"Attached {len(uploaded)} file(s) to {target_doc}.")
        st.rerun()

    stored = sorted(UPLOADS_DIR.glob("*__*")) if UPLOADS_DIR.exists() else []
    if not stored:
        st.caption("No files uploaded yet.")
    for path in stored:
        doc_part, _, file_part = path.name.partition("__")
        name_col, dl_col, rm_col = st.columns([6, 2, 2])
        name_col.write(f"**{doc_part.replace('_', ' ')}** · {file_part}")
        dl_col.download_button("Download", data=path.read_bytes(), file_name=file_part, key=f"dl_{path.name}")
        if rm_col.button("Delete", key=f"rm_{path.name}"):
            path.unlink(missing_ok=True)
            st.rerun()

with tests_tab:
    st.caption("Language and aptitude tests: registration deadlines, dates, fees, results.")
    edited_tests = st.data_editor(
        tests,
        key="tests_editor",
        num_rows="dynamic",
        width="stretch",
        hide_index=True,
        column_config={"status": st.column_config.SelectboxColumn("Status", options=TEST_STATUS_OPTIONS)},
    )
    if st.button("Save tests", type="primary"):
        db.write("Tests", edited_tests)
        st.success("Tests saved.")
        st.rerun()

with visa_tab:
    st.caption("The visa file: identity and visa-category documents, in dependency order.")
    steps = ["Passport valid", "APS certificate", "Admission letter", "Blocked account", "Health insurance", "Visa appointment booked", "Visa approved"]
    visa_docs = docs[docs["category"].astype(str).isin(["Identity", "Visa"])]
    done_docs = set(visa_docs[visa_docs["status"].astype(str) == "Done"]["document"].astype(str))
    for step in steps:
        matched = any(step.split()[0].lower() in d.lower() for d in done_docs)
        st.checkbox(step, value=matched, disabled=True, key=f"visa_step_{step}")
    st.divider()
    edited_visa = st.data_editor(visa_docs, key="visa_editor", num_rows="dynamic", width="stretch", hide_index=True, column_config=DOC_COLUMN_CONFIG)
    if st.button("Save visa documents", type="primary"):
        base = docs.drop(index=visa_docs.index, errors="ignore")
        db.write("Germany_Documents", pd.concat([base, edited_visa], ignore_index=True))
        st.success("Visa documents saved.")
        st.rerun()
