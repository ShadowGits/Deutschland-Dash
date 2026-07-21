from __future__ import annotations

import streamlit as st

from backend.charts import monthly_cashflow, savings_progress
from backend.progress import finance_progress
from utils.helpers import safe_float
from utils.ui import metric_grid, save_editor, setup_page

db = setup_page("Finance", "€")

goals = db.read("Finance_Goals")
log = db.read("Finance_Log")

target_total = goals["target_amount"].apply(safe_float).sum()
saved_total = goals["saved_amount"].apply(safe_float).sum()
metric_grid({
    "Target (EUR)": f"{target_total:,.0f}",
    "Saved (EUR)": f"{saved_total:,.0f}",
    "Remaining (EUR)": f"{max(0, target_total - saved_total):,.0f}",
    "Funded %": finance_progress(goals),
}, 4)

st.subheader("Savings goals")
st.plotly_chart(savings_progress(goals), width="stretch")
save_editor(db, "Finance_Goals", goals, "finance_goals_editor")

st.subheader("Ledger")
with st.form("finance_entry", clear_on_submit=True):
    cols = st.columns([1, 1, 2, 1, 1])
    entry_date = cols[0].date_input("Date")
    entry_type = cols[1].selectbox("Type", ["saved", "spent"])
    description = cols[2].text_input("Description")
    amount = cols[3].number_input("Amount", min_value=0.0, step=100.0)
    currency = cols[4].selectbox("Currency", ["INR", "EUR"])
    category = st.selectbox("Category", ["Blocked account", "Tests", "Applications", "Visa", "Travel", "Coaching", "Other"])
    if st.form_submit_button("Add entry"):
        db.append("Finance_Log", {"date": entry_date.strftime("%Y-%m-%d"), "category": category, "description": description, "amount": amount, "currency": currency, "type": entry_type, "notes": ""})
        st.rerun()

st.plotly_chart(monthly_cashflow(log), width="stretch")
save_editor(db, "Finance_Log", log, "finance_log_editor")
