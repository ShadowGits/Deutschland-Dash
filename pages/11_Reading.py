from __future__ import annotations

import streamlit as st
from utils.ui import setup_page

db = setup_page("Reading", "📚")

st.caption("Track your reading list, book notes, and literary goals.")
st.info("Additional widgets for reading will go here.")
