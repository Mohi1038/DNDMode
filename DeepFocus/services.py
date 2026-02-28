"""
Business-logic service layer for the DeepFocus engine.

Contains the ``AppServices`` container, embedding / LLM helpers,
and Pocket TTS audio generation.
"""

from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import scipy.io.wavfile
from fastapi import HTTPException, status

from config import Settings, FALLBACK_RESPONSE, SYSTEM_PROMPT, normalize_model_name
from models import NotificationIngestRequest

logger = logging.getLogger("chronoforge-screenless-focus")


# ---------------------------------------------------------------------------
# Service Container
# ---------------------------------------------------------------------------
@dataclass
class AppServices:
    settings: Settings
    genai_client: Any
    chroma_client: Any
    collection: Any
    tts_model: Any
    tts_voice_state: Any


# ---------------------------------------------------------------------------
# Timestamp Helpers
# ---------------------------------------------------------------------------
def epoch_ms_to_utc_string(epoch_ms: int) -> str:
    dt = datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M:%S UTC")


def format_notification_document(payload: NotificationIngestRequest) -> str:
    sender = payload.title.strip() or "Unknown sender"
    message = payload.text.strip() or "No message body"
    ts = epoch_ms_to_utc_string(payload.time)
    return f"{payload.appName} message from {sender}: {message} at {ts}."


# ---------------------------------------------------------------------------
# Embedding Helpers
# ---------------------------------------------------------------------------
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


def embed_text(
    services: AppServices,
    text: str,
    task_type: str,
    title: str | None = None,
) -> list[float]:
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


# ---------------------------------------------------------------------------
# LLM Generation Helpers
# ---------------------------------------------------------------------------
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
        for part in getattr(content, "parts", None) or []:
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


def generate_voice_response(
    services: AppServices,
    user_query: str,
    context_rows: list[str],
) -> str:
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


# ---------------------------------------------------------------------------
# TTS Audio Generation
# ---------------------------------------------------------------------------
def generate_and_save_wav(text: str, services: AppServices) -> str:
    """Uses Pocket TTS to generate a ``.wav`` file from *text*."""
    try:
        logger.info("Generating Pocket TTS audio for: %s", text)

        audio = services.tts_model.generate_audio(services.tts_voice_state, text)

        output_filepath = f"voice_response_{uuid.uuid4().hex[:8]}.wav"

        scipy.io.wavfile.write(output_filepath, services.tts_model.sample_rate, audio.numpy())

        logger.info("Successfully saved TTS audio to %s", output_filepath)
        return output_filepath

    except Exception as exc:
        logger.exception("Failed to generate and save TTS audio")
        return ""
