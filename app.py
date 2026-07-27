import streamlit as st

st.set_page_config(page_title="MathOS", page_icon="∑", layout="wide", initial_sidebar_state="expanded")

pages = {
    "Deutschland-Dash": [
        st.Page("app_pages/0_Dashboard.py", title="Dashboard", icon=":material/dashboard:"),
        st.Page("app_pages/1_Study.py", title="Study", icon="π"),
        st.Page("app_pages/2_Internship_and_Project.py", title="Internship & Project", icon="💼"),
        st.Page("app_pages/3_Germany.py", title="Germany", icon="🇩🇪"),
        st.Page("app_pages/4_Language.py", title="Language", icon="🗣️"),
        st.Page("app_pages/5_Colleges.py", title="Colleges", icon="🎓"),
        st.Page("app_pages/6_Finance.py", title="Finance", icon="💰"),
        st.Page("app_pages/7_Settings.py", title="Settings", icon="⚙️"),
        st.Page("app_pages/8_Week.py", title="Week View", icon=":material/calendar_view_week:"),
    ],
    "Non-Dash(Persona)": [
        st.Page("app_pages/9_Fitness.py", title="Fitness", icon="🏋️"),
        st.Page("app_pages/10_Piano.py", title="Piano", icon="🎹"),
        st.Page("app_pages/11_Reading.py", title="Reading", icon="📚"),
    ]
}

pg = st.navigation(pages)
pg.run()
