from __future__ import annotations

from fastapi import FastAPI

from app.graph import screening_graph
from app.models import ScreeningRequest, ScreeningResponse, request_to_application

app = FastAPI(title="AidChain AI Screening Service", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/screen", response_model=ScreeningResponse)
async def screen_application(request: ScreeningRequest) -> ScreeningResponse:
    state = await screening_graph.ainvoke({
        "application": request_to_application(request),
        "risk_signals": [],
        "errors": [],
    })
    return ScreeningResponse(**state["result"])

