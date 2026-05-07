"""LLM client singleton — used by agents and the summary generator."""
from __future__ import annotations

from langchain_openai import ChatOpenAI

from app.config import LLM_MODEL, LLM_TEMPERATURE, OPENAI_API_KEY


def get_llm() -> ChatOpenAI:
    """Return a ChatOpenAI instance.

    Raises a clear error when the API key is missing so the service
    doesn't silently produce empty results.
    """
    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not set.  "
            "Export it or add it to your .env file before starting the service."
        )
    return ChatOpenAI(
        model=LLM_MODEL,
        temperature=LLM_TEMPERATURE,
        api_key=OPENAI_API_KEY,
    )
