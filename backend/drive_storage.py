import io
import logging
from typing import Any
import streamlit as st
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

logger = logging.getLogger(__name__)

def _get_folder_id() -> str | None:
    try:
        return st.secrets.get("gcp_drive_folder_id")
    except Exception:
        return None

def _get_drive_service() -> Any:
    """Initialize the Google Drive API client using Streamlit secrets."""
    # User must add a "gcp_service_account" dictionary in their secrets.toml
    if "gcp_service_account" not in st.secrets:
        raise ValueError("Missing 'gcp_service_account' in Streamlit secrets.")
    
    creds_info = st.secrets["gcp_service_account"]
    creds_dict = dict(creds_info)
    
    scopes = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.readonly"]
    creds = service_account.Credentials.from_service_account_info(creds_dict, scopes=scopes)
    return build("drive", "v3", credentials=creds)

def upload_file(filename: str, mime_type: str, file_stream: io.BytesIO) -> str | None:
    """Upload a file to Google Drive and return its File ID."""
    folder_id = _get_folder_id()
    if not folder_id:
        logger.warning("gcp_drive_folder_id secret is missing; skipping upload.")
        return None
        
    try:
        service = _get_drive_service()
        file_metadata = {
            "name": filename,
            "parents": [folder_id]
        }
        media = MediaIoBaseUpload(file_stream, mimetype=mime_type, resumable=True)
        file = service.files().create(body=file_metadata, media_body=media, fields="id").execute()
        return file.get("id")
    except Exception as e:
        logger.exception("Failed to upload file to Google Drive: %s", e)
        return None

def download_file(file_id: str) -> bytes | None:
    """Download a file from Google Drive."""
    try:
        service = _get_drive_service()
        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
        return fh.getvalue()
    except Exception as e:
        logger.exception("Failed to download file from Google Drive: %s", e)
        return None

def list_files() -> list[dict[str, str]]:
    """List files in the configured Drive folder. Returns a list of dicts with 'id' and 'name'."""
    folder_id = _get_folder_id()
    if not folder_id:
        return []
        
    try:
        service = _get_drive_service()
        query = f"'{folder_id}' in parents and trashed = false"
        results = service.files().list(q=query, fields="files(id, name)").execute()
        return results.get("files", [])
    except Exception as e:
        logger.exception("Failed to list files from Google Drive: %s", e)
        return []

def delete_file(file_id: str) -> bool:
    """Delete a file from Google Drive."""
    try:
        service = _get_drive_service()
        service.files().delete(fileId=file_id).execute()
        return True
    except Exception as e:
        logger.exception("Failed to delete file from Google Drive: %s", e)
        return False
