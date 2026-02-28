"""
ChronoForge Google Classroom Sync — Application entrypoint.

Mounts the API router, serves downloaded assignment files statically,
and starts the Uvicorn server.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from classroom_client import DOWNLOADS_DIR
from routes import router

app = FastAPI(
    title="ChronoForge Core API",
    description="Fetches Google Classroom assignments and dynamically chunks them using Gemini.",
)

app.include_router(router)
app.mount("/files", StaticFiles(directory=DOWNLOADS_DIR), name="files")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8099, reload=True)
