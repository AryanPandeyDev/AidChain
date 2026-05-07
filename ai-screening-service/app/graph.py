from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents import document_agent, red_flag_agent, registry_agent, tax_id_agent, website_agent
from app.models import ScreeningResponse
from app.scoring import calculate_score, generate_summary


class ScreeningState(TypedDict, total=False):
    application: dict[str, Any]
    checks: list[str]
    registry: dict[str, Any]
    website: dict[str, Any]
    documents: dict[str, Any]
    tax_id: dict[str, Any]
    red_flags: dict[str, Any]
    evidence: dict[str, Any]
    risk_signals: Annotated[list[str], operator.add]
    errors: Annotated[list[str], operator.add]
    score: float
    verdict: str
    summary: str
    result: dict[str, Any]


def intake_node(state: ScreeningState) -> ScreeningState:
    app = dict(state["application"])
    missing = [
        key
        for key in ("application_id", "organization_name", "country", "registration_number", "registration_doc_url", "tax_id_doc_url", "proof_of_operation_doc_url")
        if not app.get(key)
    ]
    app["organization_name"] = app.get("organization_name", "").strip()
    app["country"] = app.get("country", "").strip()
    app["registration_number"] = app.get("registration_number", "").strip()
    return {"application": app, "errors": [f"missing field: {field}" for field in missing]}


def planning_node(state: ScreeningState) -> ScreeningState:
    app = state["application"]
    checks = ["registry", "documents", "tax_id", "red_flags"]
    if app.get("website"):
        checks.append("website")
    return {"checks": checks}


async def registry_node(state: ScreeningState) -> ScreeningState:
    evidence, risks, errors = await registry_agent(state["application"], state.get("checks", []))
    return {"registry": evidence, "risk_signals": risks, "errors": errors}


async def website_node(state: ScreeningState) -> ScreeningState:
    evidence, risks, errors = await website_agent(state["application"], state.get("checks", []))
    return {"website": evidence, "risk_signals": risks, "errors": errors}


async def document_node(state: ScreeningState) -> ScreeningState:
    evidence, risks, errors = await document_agent(state["application"], state.get("checks", []))
    return {"documents": evidence, "risk_signals": risks, "errors": errors}


async def tax_id_node(state: ScreeningState) -> ScreeningState:
    evidence, risks, errors = await tax_id_agent(state["application"], state.get("checks", []))
    return {"tax_id": evidence, "risk_signals": risks, "errors": errors}


async def red_flag_node(state: ScreeningState) -> ScreeningState:
    evidence, risks, errors = await red_flag_agent(state["application"], state.get("checks", []))
    return {"red_flags": evidence, "risk_signals": risks, "errors": errors}


def evidence_normalizer_node(state: ScreeningState) -> ScreeningState:
    return {
        "evidence": {
            "registry": state.get("registry", {}),
            "website": state.get("website", {}),
            "documents": state.get("documents", {}),
            "tax_id": state.get("tax_id", {}),
            "red_flags": state.get("red_flags", {}),
        }
    }


def score_calculator_node(state: ScreeningState) -> ScreeningState:
    score, verdict = calculate_score(state.get("evidence", {}), state.get("risk_signals", []))
    return {"score": score, "verdict": verdict}


def summary_agent_node(state: ScreeningState) -> ScreeningState:
    summary = generate_summary(
        state.get("evidence", {}),
        state.get("risk_signals", []),
        state.get("errors", []),
        state["score"],
        state["verdict"],
    )
    return {"summary": summary}


def final_result_node(state: ScreeningState) -> ScreeningState:
    app = state["application"]
    response = ScreeningResponse(
        application_id=app["application_id"],
        aiConfidenceScore=state["score"],
        aiVerdict=state["verdict"],
        aiSummary=state["summary"],
        evidence={
            **state.get("evidence", {}),
            "risk_signals": state.get("risk_signals", []),
            "errors": state.get("errors", []),
        },
    )
    return {"result": response.model_dump()}


def build_graph():
    builder = StateGraph(ScreeningState)
    builder.add_node("intake_node", intake_node)
    builder.add_node("planning_node", planning_node)
    builder.add_node("registry_agent", registry_node)
    builder.add_node("website_agent", website_node)
    builder.add_node("document_agent", document_node)
    builder.add_node("tax_id_agent", tax_id_node)
    builder.add_node("red_flag_agent", red_flag_node)
    builder.add_node("evidence_normalizer_node", evidence_normalizer_node)
    builder.add_node("score_calculator_node", score_calculator_node)
    builder.add_node("summary_agent_node", summary_agent_node)
    builder.add_node("final_result_node", final_result_node)

    builder.add_edge(START, "intake_node")
    builder.add_edge("intake_node", "planning_node")
    builder.add_edge("planning_node", "registry_agent")
    builder.add_edge("planning_node", "website_agent")
    builder.add_edge("planning_node", "document_agent")
    builder.add_edge("planning_node", "tax_id_agent")
    builder.add_edge("planning_node", "red_flag_agent")
    builder.add_edge(["registry_agent", "website_agent", "document_agent", "tax_id_agent", "red_flag_agent"], "evidence_normalizer_node")
    builder.add_edge("evidence_normalizer_node", "score_calculator_node")
    builder.add_edge("score_calculator_node", "summary_agent_node")
    builder.add_edge("summary_agent_node", "final_result_node")
    builder.add_edge("final_result_node", END)
    return builder.compile()


screening_graph = build_graph()

