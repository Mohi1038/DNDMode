"""
FastAPI route handlers for the Google Classroom Sync API.
"""

from __future__ import annotations

import asyncio
import os
from datetime import date

from fastapi import APIRouter

from classroom_client import (
    DOWNLOADS_DIR,
    get_services,
    sanitize,
    download_drive_file,
    extract_local_file_text,
)
from ai_breakdown import generate_breakdown

router = APIRouter()


@router.get("/api/v1/sync-and-breakdown")
async def sync_and_breakdown():
    """Fetch upcoming assignments from Google Classroom and break them down via Gemini."""
    classroom, drive = get_services()
    results = classroom.courses().list(pageSize=10).execute()
    courses = results.get("courses", [])
    today = date.today()

    tasks = []
    metadata = []

    for course in courses:
        coursework_results = (
            classroom.courses().courseWork().list(courseId=course["id"]).execute()
        )
        items = coursework_results.get("courseWork", [])
        course_name = sanitize(course["name"])

        for item in items:
            due_date = item.get("dueDate")
            if not due_date:
                continue

            d = date(due_date["year"], due_date["month"], due_date["day"])
            if d < today:
                continue

            due_str = f"{due_date['year']}-{due_date['month']:02d}-{due_date['day']:02d}"
            title = item.get("title", "Untitled")
            description = item.get("description", "")
            assignment_folder = os.path.join(DOWNLOADS_DIR, course_name, sanitize(title))

            combined_file_text = ""
            materials = item.get("materials", [])

            for mat in materials:
                drive_file = mat.get("driveFile", {}).get("driveFile")
                if drive_file:
                    fname = drive_file.get("title", "file")
                    downloaded_name = download_drive_file(
                        drive, drive_file["id"], fname, assignment_folder
                    )

                    if downloaded_name:
                        filepath = os.path.join(assignment_folder, downloaded_name)
                        combined_file_text += extract_local_file_text(filepath) + "\n"

            # Queue up the async Gemini call
            task = generate_breakdown(
                title=title,
                description=description,
                subject=course["name"],
                deadline=due_str,
                file_content=combined_file_text,
            )
            tasks.append(task)

            metadata.append(
                {
                    "course": course["name"],
                    "title": title,
                    "deadline": due_str,
                    "original_description": description,
                }
            )

    # Fire all Gemini API calls concurrently
    print(f"Firing {len(tasks)} parallel Gemini requests...")
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Stitch results back with metadata
    final_output = []
    for meta, breakdown_result in zip(metadata, results):
        if isinstance(breakdown_result, Exception):
            print(f"Failed to process {meta['title']}: {breakdown_result}")
            meta["ai_breakdown"] = {"error": "Failed due to API or processing error"}
        else:
            meta["ai_breakdown"] = breakdown_result
        final_output.append(meta)

    return {"status": "success", "data": final_output}
