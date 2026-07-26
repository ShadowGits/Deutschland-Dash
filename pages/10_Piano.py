from __future__ import annotations

import streamlit as st
from utils.ui import setup_page

db = setup_page("Piano", "🎹")

st.caption("Track your piano practice, repertoire, and music goals.")
st.info("Additional widgets for piano will go here.")
