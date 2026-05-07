"""AidChain AI Screening Service — FastAPI entry point."""
from __future__ import annotations

import logging

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from app.config import LOG_LEVEL
from app.graph import screening_graph
from app.models import ScreeningRequest, ScreeningResponse, request_to_application

load_dotenv()

logging.basicConfig(level=getattr(logging, LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AidChain AI Screening Service",
    version="0.2.0",
    description="LangGraph-based NGO application pre-screening with LLM-powered research.",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/screen", response_model=ScreeningResponse)
async def screen_application(request: ScreeningRequest) -> ScreeningResponse:
    """Run the full screening workflow for an NGO application."""
    logger.info("Screening application %s (%s)", request.application_id, request.organization_name)

    try:
        state = await screening_graph.ainvoke({
            "application": request_to_application(request),
            "risk_signals": [],
            "errors": [],
        })
        result = ScreeningResponse(**state["result"])
        logger.info(
            "Screening complete for %s: verdict=%s score=%.2f",
            request.application_id,
            result.aiVerdict,
            result.aiConfidenceScore,
        )
        return result

    except Exception as exc:
        logger.exception("Screening workflow failed for %s", request.application_id)
        raise HTTPException(
            status_code=500,
            detail=f"Screening workflow failed: {exc}",
        )
