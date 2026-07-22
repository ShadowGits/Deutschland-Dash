"""Keep the workbook in Supabase Storage so the dashboard can be deployed.

Why the workbook and not tables: Planner OS models five tables (projects, milestones,
planner_tasks, task_completions, reminder_log). This dashboard also owns sheets that
have no Planner OS equivalent — Germany_Documents, Tests, Language, Colleges,
Finance_Goals, Finance_Log, Curriculum, Topics, Books, Projects, Notes. Rather than
invent a parallel schema for those, the workbook itself lives in the same Supabase
project as a stored object: pulled once when the process starts, pushed after each
write. Planner data still comes from the API (`backend/planner_api.py`); this bucket
only holds what Planner OS does not model.

Safety property worth stating plainly: if the remote is configured but the pull
*fails*, pushing is disabled for the rest of the process. Otherwise a transient
network error would let a freshly-seeded empty workbook overwrite the good remote
copy — silent, total data loss. A 404 is not a failure; it just means nothing has
been uploaded yet, and the first push seeds the bucket.

Single-writer assumption: two sessions editing at once will clobber each other, since
the unit of storage is the whole file. That is fine for one user and is the same
trade-off the local file already makes.
"""
from __future__ import annotations

import logging
import urllib.error
import urllib.request
from pathlib import Path

from utils.secrets import secret

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 30
DEFAULT_BUCKET = "dashboard"
DEFAULT_OBJECT = "math_database.xlsx"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# Process-level state. `_pulled` makes the download happen once per process rather
# than on every Streamlit rerun; `_push_blocked` is the safety latch described above.
_pulled = False
_push_blocked = False
_status = "Local file only — Supabase Storage not configured."


class RemoteConfig:
    __slots__ = ("url", "key", "bucket", "obj")

    def __init__(self, url: str, key: str, bucket: str, obj: str) -> None:
        self.url = url.rstrip("/")
        self.key = key
        self.bucket = bucket
        self.obj = obj.lstrip("/")

    @property
    def object_url(self) -> str:
        return f"{self.url}/storage/v1/object/{self.bucket}/{self.obj}"

    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.key}", "apikey": self.key}


def remote_config() -> RemoteConfig | None:
    """The configured bucket, or None when the app should just use the local file."""
    url = secret("SUPABASE_URL")
    key = secret("SUPABASE_SERVICE_KEY", "SUPABASE_KEY")
    if not url or not key:
        return None
    return RemoteConfig(
        url=url,
        key=key,
        bucket=secret("SUPABASE_BUCKET", default=DEFAULT_BUCKET) or DEFAULT_BUCKET,
        obj=secret("SUPABASE_WORKBOOK_OBJECT", default=DEFAULT_OBJECT) or DEFAULT_OBJECT,
    )


def configured() -> bool:
    return remote_config() is not None


def status() -> str:
    """Human-readable one-liner for the sidebar. Never contains a credential."""
    return _status


def pull(path: Path, config: RemoteConfig | None = None) -> tuple[bool, str]:
    """Download the workbook over `path`. Returns (ok, message).

    `ok` is False only for a real failure — a missing remote object counts as fine.
    """
    global _push_blocked, _status

    config = config or remote_config()
    if config is None:
        _status = "Local file only — Supabase Storage not configured."
        return True, _status

    request = urllib.request.Request(config.object_url, headers=config.headers())
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            payload = response.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            _status = f"Supabase bucket `{config.bucket}` is empty — the next save will seed it."
            return True, _status
        _push_blocked = True
        logger.warning("Supabase pull failed with HTTP %s", exc.code)
        _status = f"Supabase pull failed (HTTP {exc.code}). Saving is disabled to protect the remote copy."
        return False, _status
    except (urllib.error.URLError, TimeoutError) as exc:
        _push_blocked = True
        logger.warning("Supabase unreachable: %s", exc)
        _status = f"Supabase unreachable ({exc}). Saving is disabled to protect the remote copy."
        return False, _status

    if not payload:
        _push_blocked = True
        _status = "Supabase returned an empty workbook. Saving is disabled — check the bucket."
        return False, _status

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    _status = f"Loaded from Supabase `{config.bucket}/{config.obj}` ({len(payload) // 1024} KB)."
    return True, _status


def pull_once(path: Path) -> None:
    """Pull on the first call in this process; a no-op afterwards.

    Streamlit re-runs a page on every interaction and `ExcelDB()` is constructed each
    time, so an unconditional pull would put a network round-trip in front of every
    click. After the first pull the local file is authoritative — this app is the only
    writer of these sheets.
    """
    global _pulled
    if _pulled:
        return
    _pulled = True
    pull(path)


def refresh(path: Path) -> tuple[bool, str]:
    """Force a re-pull, e.g. from a sidebar button after editing elsewhere."""
    global _pulled, _push_blocked
    _pulled = True
    _push_blocked = False
    return pull(path)


def push(path: Path, config: RemoteConfig | None = None) -> tuple[bool, str]:
    """Upload the workbook. Returns (ok, message)."""
    global _status

    config = config or remote_config()
    if config is None:
        return True, "Saved locally."
    if _push_blocked:
        return False, "Not uploaded — the earlier Supabase pull failed, so the remote copy is left untouched."
    if not path.exists():
        return False, "Nothing to upload — the workbook does not exist yet."

    request = urllib.request.Request(
        config.object_url,
        data=path.read_bytes(),
        method="POST",
        headers={**config.headers(), "Content-Type": XLSX_MIME, "x-upsert": "true"},
    )
    try:
        urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS).close()
    except urllib.error.HTTPError as exc:
        logger.warning("Supabase push failed with HTTP %s", exc.code)
        _status = f"Saved locally, but the Supabase upload failed (HTTP {exc.code})."
        return False, _status
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.warning("Supabase push unreachable: %s", exc)
        _status = f"Saved locally, but Supabase was unreachable ({exc})."
        return False, _status

    _status = f"Synced to Supabase `{config.bucket}/{config.obj}`."
    return True, _status
