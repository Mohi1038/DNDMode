"""
Configuration, constants, and environment loading for the DeepFocus engine.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
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


def parse_cors_origins(raw: str) -> tuple[str, ...]:
    raw = (raw or "*").strip()
    if raw == "*" or not raw:
        return ("*",)
    return tuple(part.strip() for part in raw.split(",") if part.strip())


def normalize_model_name(model_name: str) -> str:
    """Accept both ``models/xyz`` and ``xyz``."""
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
        tts_voice=os.getenv("TTS_VOICE", "alba").strip(),
    )
