"""Configuration loaded from environment variables."""
from __future__ import annotations

import os


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


# ── LLM ───────────────────────────────────────────────────────────────────────
OPENAI_API_KEY: str = _env("OPENAI_API_KEY")
LLM_MODEL: str = _env("LLM_MODEL", "gpt-4o-mini")
LLM_TEMPERATURE: float = float(_env("LLM_TEMPERATURE", "0.2"))

# ── Web search (Tavily) ──────────────────────────────────────────────────────
TAVILY_API_KEY: str = _env("TAVILY_API_KEY")

# ── Service ───────────────────────────────────────────────────────────────────
LOG_LEVEL: str = _env("LOG_LEVEL", "INFO")
