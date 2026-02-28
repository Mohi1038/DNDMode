"""
ChronoForge Screenless Deep Focus API — Application entrypoint.

Initialises Gemini, ChromaDB, and Pocket TTS at startup, wires up
routes, CORS, and global error handlers, then exposes the ASGI app.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import chromadb
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from pocket_tts import TTSModel

from config import load_settings, parse_cors_origins
from routes import router
from services import AppServices

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("chronoforge-screenless-focus")


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is required")

    persist_dir = Path(settings.chroma_persist_dir)
    persist_dir.mkdir(parents=True, exist_ok=True)

    genai_client = genai.Client(api_key=settings.gemini_api_key)
    chroma_client = chromadb.PersistentClient(path=str(persist_dir))
    collection = chroma_client.get_or_create_collection(
        name=settings.chroma_collection_name,
        metadata={"hnsw:space": "cosine"},
    )

    # Pocket TTS initialisation (runs once at startup)
    logger.info("Loading Pocket TTS model into memory... (This happens only once)")
    tts_model = TTSModel.load_model()

    logger.info("Loading Pocket TTS voice profile: %s...", settings.tts_voice)
    tts_voice_state = tts_model.get_state_for_audio_prompt("azelma")

    app.state.services = AppServices(
        settings=settings,
        genai_client=genai_client,
        chroma_client=chroma_client,
        collection=collection,
        tts_model=tts_model,
        tts_voice_state=tts_voice_state,
    )

    logger.info(
        "Startup complete | collection=%s | persist_dir=%s",
        settings.chroma_collection_name,
        settings.chroma_persist_dir,
    )

    try:
        yield
    finally:
        close_fn = getattr(genai_client, "close", None)
        if callable(close_fn):
            close_fn()


# ---------------------------------------------------------------------------
# App Factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="ChronoForge Screenless Deep Focus API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(parse_cors_origins(os.getenv("CORS_ORIGINS", "*"))),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


# ---------------------------------------------------------------------------
# Global Error Handlers
# ---------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def request_validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
