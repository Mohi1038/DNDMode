"""
Google Classroom & Drive API client.

Handles OAuth2 authentication, course/assignment fetching,
file downloads, and local text extraction from PDF/DOCX/TXT.
"""

from __future__ import annotations

import io
import os
import re

import PyPDF2
import docx
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

SCOPES = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

DOWNLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
os.makedirs(DOWNLOADS_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------
def sanitize(name: str) -> str:
    """Remove characters that are unsafe for file/folder names."""
    return re.sub(r"[^\w\s\-.]", "", name).strip()


def extract_local_file_text(filepath: str) -> str:
    """Reads a local file and extracts text based on its extension."""
    if not os.path.exists(filepath):
        return ""

    extracted_text = ""
    filename = filepath.lower()

    try:
        if filename.endswith(".pdf"):
            with open(filepath, "rb") as f:
                pdf_reader = PyPDF2.PdfReader(f)
                extracted_text = "\n".join(
                    [page.extract_text() for page in pdf_reader.pages if page.extract_text()]
                )

        elif filename.endswith(".docx"):
            doc = docx.Document(filepath)
            extracted_text = "\n".join([paragraph.text for paragraph in doc.paragraphs])

        elif filename.endswith(".txt"):
            with open(filepath, "r", encoding="utf-8") as f:
                extracted_text = f.read()

    except Exception as e:
        print(f"Error parsing file {filename}: {e}")

    return extracted_text


# ---------------------------------------------------------------------------
# OAuth2 + Service Builders
# ---------------------------------------------------------------------------
def get_services():
    """Authenticate with Google and return (classroom_service, drive_service)."""
    creds = None
    token_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "token.json")
    creds_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "credentials.json")

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, "w") as token:
            token.write(creds.to_json())

    classroom = build("classroom", "v1", credentials=creds)
    drive = build("drive", "v3", credentials=creds)
    return classroom, drive


# ---------------------------------------------------------------------------
# Drive File Download
# ---------------------------------------------------------------------------
def download_drive_file(
    drive_service,
    file_id: str,
    file_name: str,
    dest_folder: str,
) -> str | None:
    """Download a file from Google Drive. Returns the relative path on success."""
    os.makedirs(dest_folder, exist_ok=True)
    safe_name = sanitize(file_name)
    filepath = os.path.join(dest_folder, safe_name)

    try:
        request = drive_service.files().get_media(fileId=file_id)
        with io.FileIO(filepath, "wb") as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
        return safe_name
    except Exception:
        try:
            request = drive_service.files().export_media(
                fileId=file_id, mimeType="application/pdf"
            )
            export_name = safe_name if safe_name.endswith(".pdf") else safe_name + ".pdf"
            export_path = os.path.join(dest_folder, export_name)
            with io.FileIO(export_path, "wb") as fh:
                downloader = MediaIoBaseDownload(fh, request)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
            return export_name
        except Exception:
            return None
