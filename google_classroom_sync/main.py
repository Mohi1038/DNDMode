import os
import io
import re
import json
from datetime import date
from typing import Optional
import asyncio
# FastAPI & Pydantic
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import uvicorn

# Google Classroom & Drive APIs
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# File Parsing
import PyPDF2
import docx

# Google GenAI SDK
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# ==========================================
# 1. Configuration & Setup
# ==========================================
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'
SCOPES = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
    'https://www.googleapis.com/auth/drive.readonly'
]
DOWNLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'downloads')
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))

app = FastAPI(
    title="ChronoForge Core API",
    description="Fetches Google Classroom assignments and dynamically chunks them using Gemini."
)

# ==========================================
# 2. Pydantic Models
# ==========================================
class TaskChunk(BaseModel):
    chunk_id: int = Field(description="Sequential ID of the chunk (1, 2, 3...)")
    task_name: str = Field(description="Actionable name of the task, starting with a verb")
    estimated_minutes: int = Field(description="Estimated time in minutes. MUST be strictly <= 60.")
    completion_weight_percent: float = Field(description="Percentage this chunk contributes to the total assignment")

class AssignmentBreakdown(BaseModel):
    assignment_title: str
    estimated_total_hours: float = Field(description="Total estimated hours to complete the assignment from scratch")
    chunks: list[TaskChunk] = Field(description="List of sub-tasks broken down into 1-hour maximum chunks")

# ==========================================
# 3. Helper Functions: Utilities & Parsing
# ==========================================
def sanitize(name: str) -> str:
    return re.sub(r'[^\w\s\-.]', '', name).strip()

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
                extracted_text = "\n".join([page.extract_text() for page in pdf_reader.pages if page.extract_text()])
                
        elif filename.endswith(".docx"):
            doc = docx.Document(filepath)
            extracted_text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            
        elif filename.endswith(".txt"):
            with open(filepath, "r", encoding="utf-8") as f:
                extracted_text = f.read()
                
    except Exception as e:
        print(f"Error parsing file {filename}: {e}")
        
    return extracted_text

# ==========================================
# 4. Core Logic: Gemini Breakdown
# ==========================================
async def generate_breakdown(title: str, description: str, subject: str, deadline: str, file_content: str) -> dict:
    """Passes the assignment details to Gemini to generate time chunks."""
    system_instruction = (
        "You are the 'Dynamic Gap Routing Engine' for ChronoForge, an AI attention "
        "operating system for college students. Your goal is to intercept academic "
        "assignments, accurately estimate their total completion time, and break them "
        "down into highly specific, manageable sub-tasks that strictly take 60 minutes or less. "
        "Account for the cognitive load required for a typical college student."
    )

    user_prompt = f"""
    Analyze the following assignment details:
    - Title: {title}
    - Subject: {subject}
    - Deadline: {deadline}
    
    - Google Classroom Description: 
    {description}
    
    - Attached Document Content (if any):
    {file_content}

    Task:
    1. Estimate the realistic total hours required to finish this from scratch.
    2. Divide the assignment into sequential chunks. NO CHUNK CAN EXCEED 60 MINUTES.
    3. Name each chunk starting with an action verb.
    4. Assign a completion weight. The sum of all chunk weights must equal 100%.
    """

    try:
        # NOTICE the 'await' and the '.aio.' added here
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=AssignmentBreakdown,
                temperature=0.2, 
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Error calling LLM for '{title}': {e}")
        return {"error": "Failed to generate breakdown"}

# ==========================================
# 5. Core Logic: Classroom Fetching (Abridged for brevity)
# ==========================================
def get_services():
    # ... (Keep your exact get_services logic here from gc_fetch.py) ...
    creds = None
    token_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'token.json')
    creds_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'credentials.json')

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, 'w') as token:
            token.write(creds.to_json())

    classroom = build('classroom', 'v1', credentials=creds)
    drive = build('drive', 'v3', credentials=creds)
    return classroom, drive

def download_drive_file(drive_service, file_id, file_name, dest_folder) -> str | None:
    """Download a file from Google Drive. Returns the relative path on success."""
    os.makedirs(dest_folder, exist_ok=True)
    safe_name = sanitize(file_name)
    filepath = os.path.join(dest_folder, safe_name)

    try:
        request = drive_service.files().get_media(fileId=file_id)
        with io.FileIO(filepath, 'wb') as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
        return safe_name
    except Exception:
        try:
            request = drive_service.files().export_media(fileId=file_id, mimeType='application/pdf')
            export_name = safe_name if safe_name.endswith('.pdf') else safe_name + '.pdf'
            export_path = os.path.join(dest_folder, export_name)
            with io.FileIO(export_path, 'wb') as fh:
                downloader = MediaIoBaseDownload(fh, request)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
            return export_name
        except Exception:
            return None


# ==========================================
# 6. Unified Endpoints
# ==========================================
@app.get("/api/v1/sync-and-breakdown")
async def sync_and_breakdown():
    classroom, drive = get_services()
    results = classroom.courses().list(pageSize=10).execute()
    courses = results.get('courses', [])
    today = date.today()
    
    tasks = []
    metadata = []

    for course in courses:
        coursework_results = classroom.courses().courseWork().list(courseId=course['id']).execute()
        items = coursework_results.get('courseWork', [])
        course_name = sanitize(course['name'])

        for item in items:
            due_date = item.get('dueDate')
            if not due_date: continue
            
            d = date(due_date['year'], due_date['month'], due_date['day'])
            if d < today: continue 
                
            due_str = f"{due_date['year']}-{due_date['month']:02d}-{due_date['day']:02d}"
            title = item.get('title', 'Untitled')
            description = item.get('description', '')
            assignment_folder = os.path.join(DOWNLOADS_DIR, course_name, sanitize(title))
            
            combined_file_text = ""
            materials = item.get('materials', [])
            
            for mat in materials:
                drive_file = mat.get('driveFile', {}).get('driveFile')
                if drive_file:
                    fname = drive_file.get('title', 'file')
                    downloaded_name = download_drive_file(drive, drive_file['id'], fname, assignment_folder)
                    
                    if downloaded_name:
                        filepath = os.path.join(assignment_folder, downloaded_name)
                        combined_file_text += extract_local_file_text(filepath) + "\n"

            # 1. Queue up the async task instead of awaiting it immediately
            task = generate_breakdown(
                title=title,
                description=description,
                subject=course['name'],
                deadline=due_str,
                file_content=combined_file_text
            )
            tasks.append(task)
            
            # 2. Store metadata to map the results back to the right assignment
            metadata.append({
                "course": course['name'],
                "title": title,
                "deadline": due_str,
                "original_description": description,
            })

    # 3. Fire all Gemini API calls concurrently
    print(f"Firing {len(tasks)} parallel Gemini requests...")
    # Using return_exceptions=True prevents one failed assignment from crashing the whole batch
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 4. Stitch the results back together with their original metadata
    final_output = []
    for meta, breakdown_result in zip(metadata, results):
        if isinstance(breakdown_result, Exception):
            print(f"Failed to process {meta['title']}: {breakdown_result}")
            meta["ai_breakdown"] = {"error": "Failed due to API or processing error"}
        else:
            meta["ai_breakdown"] = breakdown_result
        final_output.append(meta)

    return {"status": "success", "data": final_output}

app.mount("/files", StaticFiles(directory=DOWNLOADS_DIR), name="files")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8099, reload=True)
