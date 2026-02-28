from __future__ import annotations

import logging
import os
import re
import uuid
import tempfile
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from fastapi.responses import JSONResponse, FileResponse
from starlette.background import BackgroundTask
import os

# Disable Chroma telemetry noise before importing chromadb.
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import chromadb
import scipy.io.wavfile  # Added for Pocket TTS
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from pydantic import BaseModel, ConfigDict, Field, field_validator

from pocket_tts import TTSModel  # Added Pocket TTS import

load_dotenv()

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("chronoforge-screenless-focus")

# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------
FALLBACK_RESPONSE = "Nothing urgent right now. Keep focusing."

# Matches "Missed call", "Missed voice call", "Missed video call", etc.
MISSED_CALL_PATTERN = re.compile(
    r"missed\s+(voice\s+|video\s+)?call",
    re.IGNORECASE,
)

SYSTEM_PROMPT = """
You are an invisible, on-demand voice agent.
Use exactly 1-2 complete sentences.
Include sender + key message when available.
If nothing urgent, reply exactly: "Nothing urgent right now. Keep focusing."
Do not hallucinate; only use retrieved context.

""".strip()


# -----------------------------------------------------------------------------
# Request / Response Models
# -----------------------------------------------------------------------------
class NotificationIngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    packageName: str = Field(..., min_length=1, max_length=256)
    appName: str = Field(..., min_length=1, max_length=128)
    title: str = Field(default="", max_length=512)
    text: str = Field(default="", max_length=4000)
    time: int = Field(..., description="Unix epoch time in milliseconds")
    notificationId: str = Field(..., min_length=1, max_length=256)
    isOngoing: bool = Field(default=False)

    @field_validator("time")
    @classmethod
    def validate_time(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("time must be a positive Unix epoch in milliseconds")
        return value


class AgentQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(..., min_length=1, max_length=2000)
    topK: int | None = Field(default=None, ge=1, le=20)


class AgentQueryResponse(BaseModel):
    response: str
    matchedNotifications: int


# -----------------------------------------------------------------------------
# Config + Service State
# -----------------------------------------------------------------------------
@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_embedding_model: str
    gemini_llm_model: str
    chroma_persist_dir: str
    chroma_collection_name: str
    default_top_k: int
    cors_origins: tuple[str, ...]
    tts_voice: str


@dataclass
class AppServices:
    settings: Settings
    genai_client: Any
    chroma_client: Any
    collection: Any
    tts_model: Any        # Added for Pocket TTS
    tts_voice_state: Any  # Added for Pocket TTS


def parse_cors_origins(raw: str) -> tuple[str, ...]:
    raw = (raw or "*").strip()
    if raw == "*" or not raw:
        return ("*",)
    return tuple(part.strip() for part in raw.split(",") if part.strip())


def normalize_model_name(model_name: str) -> str:
    # Accept both "models/xyz" and "xyz"
    if model_name.startswith("models/"):
        return model_name.split("/", 1)[1]
    return model_name


def load_settings() -> Settings:
    top_k_raw = os.getenv("TOP_K", "8").strip()
    try:
        top_k = int(top_k_raw)
    except ValueError as exc:
        raise RuntimeError("TOP_K must be an integer") from exc

    if not (1 <= top_k <= 50):
        raise RuntimeError("TOP_K must be between 1 and 50")

    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        gemini_embedding_model=os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001").strip(),
        gemini_llm_model=os.getenv("GEMINI_LLM_MODEL", "gemini-2.5-flash").strip(),
        chroma_persist_dir=os.getenv("CHROMA_PERSIST_DIR", "./data/chroma").strip(),
        chroma_collection_name=os.getenv("CHROMA_COLLECTION_NAME", "chronoforge_notifications").strip(),
        default_top_k=top_k,
        cors_origins=parse_cors_origins(os.getenv("CORS_ORIGINS", "*")),
        # Changed default voice to Pocket TTS catalog voice "alba"
        tts_voice=os.getenv("TTS_VOICE", "alba").strip(),
    )


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def epoch_ms_to_utc_string(epoch_ms: int) -> str:
    dt = datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M:%S UTC")


def format_notification_document(payload: NotificationIngestRequest) -> str:
    sender = payload.title.strip() or "Unknown sender"
    message = payload.text.strip() or "No message body"
    ts = epoch_ms_to_utc_string(payload.time)
    return f"{payload.appName} message from {sender}: {message} at {ts}."


def extract_embedding_vector(embed_response: Any) -> list[float]:
    embeddings = getattr(embed_response, "embeddings", None)
    if embeddings and len(embeddings) > 0:
        values = getattr(embeddings[0], "values", None)
        if values is not None:
            return [float(v) for v in values]

    if isinstance(embed_response, dict):
        embs = embed_response.get("embeddings")
        if isinstance(embs, list) and embs:
            first = embs[0]
            if isinstance(first, dict) and isinstance(first.get("values"), list):
                return [float(v) for v in first["values"]]

        single = embed_response.get("embedding")
        if isinstance(single, list):
            return [float(v) for v in single]

    raise ValueError("No embedding vector found in Gemini response")


def embed_text(services: AppServices, text: str, task_type: str, title: str | None = None) -> list[float]:
    config: dict[str, Any] = {"task_type": task_type}
    if task_type == "RETRIEVAL_DOCUMENT" and title:
        config["title"] = title

    try:
        response = services.genai_client.models.embed_content(
            model=normalize_model_name(services.settings.gemini_embedding_model),
            contents=[text],
            config=config,
        )
        return extract_embedding_vector(response)
    except Exception as exc:
        logger.exception("Embedding generation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Embedding generation failed: {exc}",
        ) from exc


def extract_generation_text(response: Any) -> str:
    text = getattr(response, "text", None)
    if isinstance(text, str) and text.strip():
        return text.strip()

    parts: list[str] = []
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        if not content:
            continue
        for part in (getattr(content, "parts", None) or []):
            part_text = getattr(part, "text", None)
            if isinstance(part_text, str) and part_text.strip():
                parts.append(part_text.strip())

    return " ".join(parts).strip()


def build_query_prompt(user_query: str, context_rows: list[str]) -> str:
    context_block = "\n".join(f"{idx + 1}. {row}" for idx, row in enumerate(context_rows))
    return f"""
User wake query:
{user_query}

Retrieved notifications:
{context_block}

Speak the best concise response now.
""".strip()


def generate_voice_response(services: AppServices, user_query: str, context_rows: list[str]) -> str:
    if not context_rows:
        return FALLBACK_RESPONSE

    prompt = build_query_prompt(user_query, context_rows)
    try:
        response = services.genai_client.models.generate_content(
            model=normalize_model_name(services.settings.gemini_llm_model),
            contents=prompt,
            config={
                "system_instruction": SYSTEM_PROMPT,
                "temperature": 0.2,
                "max_output_tokens": 1200,
            },
        )
        answer = extract_generation_text(response)
    except Exception as exc:
        logger.exception("LLM response generation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM generation failed: {exc}",
        ) from exc

    if not answer:
        return FALLBACK_RESPONSE
    if "nothing urgent" in answer.lower():
        return FALLBACK_RESPONSE
    return answer


def generate_and_save_wav(text: str, services: AppServices) -> str:
    """Uses Pocket TTS to generate a .wav file from text."""
    try:
        logger.info("Generating Pocket TTS audio for: %s", text)
        
        # 1. Generate the audio tensor from the text
        audio = services.tts_model.generate_audio(services.tts_voice_state, text)
        
        # 2. Create a unique filename for the output
        output_filepath = f"voice_response_{uuid.uuid4().hex[:8]}.wav"
        
        # 3. Save it to disk using the model's sample rate
        scipy.io.wavfile.write(output_filepath, services.tts_model.sample_rate, audio.numpy())
        
        logger.info("Successfully saved TTS audio to %s", output_filepath)
        return output_filepath
        
    except Exception as exc:
        logger.exception("Failed to generate and save TTS audio")
        return ""


# -----------------------------------------------------------------------------
# FastAPI lifecycle + app
# -----------------------------------------------------------------------------
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

    # --- NEW: Pocket TTS Initialization ---
    logger.info("Loading Pocket TTS model into memory... (This happens only once)")
    tts_model = TTSModel.load_model()
    
    logger.info(f"Loading Pocket TTS voice profile: {settings.tts_voice}...")
    # Use the predefined catalog voice (e.g. 'alba') so we don't need HuggingFace auth
    tts_voice_state = tts_model.get_state_for_audio_prompt("azelma")

    app.state.services = AppServices(
        settings=settings,
        genai_client=genai_client,
        chroma_client=chroma_client,
        collection=collection,
        tts_model=tts_model,              # Stored in state
        tts_voice_state=tts_voice_state,  # Stored in state
    )

    logger.info(
        "Startup complete | collection=%s | persist_dir=%s",
        settings.chroma_collection_name,
        settings.chroma_persist_dir,
    )

    try:
        yield
    finally:
        # Explicitly close Gemini client if supported by installed version.
        close_fn = getattr(genai_client, "close", None)
        if callable(close_fn):
            close_fn()


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


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/notifications/ingest", status_code=status.HTTP_201_CREATED)
def ingest_notification(payload: NotificationIngestRequest, request: Request):
    services: AppServices = request.app.state.services

    # --- Missed-call interception: generate TTS audio, skip DB ---
    if MISSED_CALL_PATTERN.search(payload.title):
        caller = payload.text.strip() or "an unknown caller"
        tts_text = f"You received a missed call from {caller}"
        logger.info(
            "Missed call detected — generating TTS instead of ingesting. Caller: %s",
            caller,
        )

        wav_filepath = generate_and_save_wav(tts_text, services)
        if not wav_filepath or not os.path.exists(wav_filepath):
            raise HTTPException(
                status_code=500,
                detail="Failed to generate missed-call audio",
            )

        return FileResponse(
            path=wav_filepath,
            media_type="audio/wav",
            filename="missed_call.wav",
            background=BackgroundTask(os.remove, wav_filepath),
            headers={
                "X-Response-Text": tts_text,
                "X-Missed-Call": "true",
            },
        )
    # --- Missed-call interception from whatsapp: generate TTS audio, skip DB ---
    if MISSED_CALL_PATTERN.search(payload.text):
        caller = payload.title.strip() or "an unknown caller"
        tts_text = f"You received a missed call from {caller}"
        logger.info(
            "Missed call detected — generating TTS instead of ingesting. Caller: %s",
            caller,
        )

        wav_filepath = generate_and_save_wav(tts_text, services)
        if not wav_filepath or not os.path.exists(wav_filepath):
            raise HTTPException(
                status_code=500,
                detail="Failed to generate missed-call audio",
            )

        return FileResponse(
            path=wav_filepath,
            media_type="audio/wav",
            filename="missed_call.wav",
            background=BackgroundTask(os.remove, wav_filepath),
            headers={
                "X-Response-Text": tts_text,
                "X-Missed-Call": "true",
            },
        )
    formatted_document = format_notification_document(payload)
    embedding = embed_text(
        services=services,
        text=formatted_document,
        task_type="RETRIEVAL_DOCUMENT",
        title=payload.appName,
    )

    metadata = {
        "notificationId": payload.notificationId,
        "packageName": payload.packageName,
        "appName": payload.appName,
        "title": payload.title,
        "time": payload.time,
        "timeUtc": epoch_ms_to_utc_string(payload.time),
        "isOngoing": payload.isOngoing,
    }

    try:
        services.collection.upsert(
            ids=[payload.notificationId],
            embeddings=[embedding],
            documents=[formatted_document],
            metadatas=[metadata],
        )
    except Exception as exc:
        logger.exception("Vector DB upsert failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist notification: {exc}",
        ) from exc

    return {
        "status": "ingested",
        "notificationId": payload.notificationId,
        "storedDocument": formatted_document,
    }

@app.post("/api/v1/agent/query")
def agent_query(payload: AgentQueryRequest, request: Request):
    services: AppServices = request.app.state.services
    top_k = payload.topK or services.settings.default_top_k

    query_embedding = embed_text(
        services=services,
        text=payload.query,
        task_type="RETRIEVAL_QUERY",
    )

    try:
        result = services.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
    except Exception as exc:
        logger.exception("Vector DB query failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vector search failed: {exc}",
        ) from exc

    docs_outer = result.get("documents") or [[]]
    metas_outer = result.get("metadatas") or [[]]
    docs = docs_outer[0] if docs_outer else []
    metas = metas_outer[0] if metas_outer else []

    context_rows: list[str] = []
    for i, doc in enumerate(docs):
        if not doc:
            continue
        meta = metas[i] if i < len(metas) and metas[i] else {}
        app_name = str(meta.get("appName", "Unknown App"))
        title = str(meta.get("title", "")).strip()
        time_utc = str(meta.get("timeUtc", "Unknown time"))
        sender_part = f" from {title}" if title else ""
        context_rows.append(f"{app_name}{sender_part} at {time_utc}: {doc}")

    # 1. Generate the text
    response_text = generate_voice_response(services, payload.query, context_rows)
    
    # 2. Generate and save the .wav file locally
    wav_filepath = generate_and_save_wav(response_text, services)

    if not wav_filepath or not os.path.exists(wav_filepath):
        raise HTTPException(status_code=500, detail="Failed to generate audio file")

    # 3. Send the file back, and delete it from the server once finished
    return FileResponse(
        path=wav_filepath,
        media_type="audio/wav",
        filename="agent_response.wav",
        background=BackgroundTask(os.remove, wav_filepath), # Cleans up the disk!
        headers={
            # Pass the text back in the headers just in case the client needs it
            "X-Response-Text": response_text.replace('\n', ' '), 
            "X-Matched-Notifications": str(len(context_rows))
        }
    )

# -----------------------------------------------------------------------------
# Error handlers
# -----------------------------------------------------------------------------
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
