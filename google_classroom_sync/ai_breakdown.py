"""
Gemini-powered assignment task breakdown.

Sends assignment details (title, description, attachments) to Gemini
and returns a structured ``AssignmentBreakdown`` with ≤60-minute chunks.
"""

from __future__ import annotations

import json
import os

from google import genai
from google.genai import types
from dotenv import load_dotenv

from models import AssignmentBreakdown

load_dotenv()

client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))


async def generate_breakdown(
    title: str,
    description: str,
    subject: str,
    deadline: str,
    file_content: str,
) -> dict:
    """Passes assignment details to Gemini to generate time-boxed sub-tasks."""
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
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=AssignmentBreakdown,
                temperature=0.2,
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Error calling LLM for '{title}': {e}")
        return {"error": "Failed to generate breakdown"}
