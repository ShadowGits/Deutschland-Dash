"""One place to look up a secret, whatever the deployment.

Streamlit secrets win (that is where a hosted deployment puts them), the environment
covers local runs and scripts. Nothing here ever logs or returns a value to the UI.

`st.secrets` *raises* rather than returning None when no `secrets.toml` exists at all,
so every access has to be guarded — the un-guarded version crashes on exactly the
path it is meant to handle. This module exists so that guard is written once.
"""
from __future__ import annotations

import os


def _from_streamlit(name: str) -> str | None:
    try:
        import streamlit as st

        value = st.secrets.get(name)
    except Exception:  # noqa: BLE001 - no secrets file, or not running under Streamlit
        return None
    return str(value) if value else None


def secret(*names: str, default: str | None = None) -> str | None:
    """First non-empty value among `names`, checking Streamlit secrets then the environment."""
    for name in names:
        value = _from_streamlit(name)
        if value:
            return value
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return default
