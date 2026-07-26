from __future__ import annotations

import streamlit as st
from utils.ui import setup_page

db = setup_page("Fitness", "🏋️")

st.caption("Track your fitness goals, workouts, and health.")
st.info("Additional widgets for fitness will go here.")
