"""
FastAPI route handlers for the DeepFocus API.
"""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from config import MISSED_CALL_PATTERN
from models import NotificationIngestRequest, AgentQueryRequest
from services import (
    AppServices,
    epoch_ms_to_utc_string,
    format_notification_document,
    embed_text,
    generate_voice_response,
    generate_and_save_wav,
)

logger = logging.getLogger("chronoforge-screenless-focus")

router = APIRouter()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@router.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Notification Ingest
# ---------------------------------------------------------------------------
@router.post("/api/v1/notifications/ingest", status_code=status.HTTP_201_CREATED)
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

    # --- Missed-call interception from WhatsApp: generate TTS audio, skip DB ---
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

    # --- Standard notification ingestion ---
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


# ---------------------------------------------------------------------------
# Agent Query
# ---------------------------------------------------------------------------
@router.post("/api/v1/agent/query")
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
        background=BackgroundTask(os.remove, wav_filepath),
        headers={
            "X-Response-Text": response_text.replace('\n', ' '),
            "X-Matched-Notifications": str(len(context_rows)),
        },
    )
