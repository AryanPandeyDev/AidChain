"""
Deterministic scoring engine + LLM-powered summary generation.

Core rule from agentPRD:
  - Agents collect evidence.
  - Code calculates score.      ← calculate_score()
  - LLM generates explanation.  ← generate_summary()
  - System returns structured result.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Literal

from langchain_core.messages import HumanMessage, SystemMessage

from app.llm import get_llm

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
#  DETERMINISTIC SCORE CALCULATION — no LLM, pure math
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_score(
    evidence: dict[str, Any],
    risk_signals: list[str],
) -> tuple[float, Literal["PASS", "FAIL"]]:
    """Calculate a confidence score from structured evidence.

    Starts at 0.50, adjusts based on positive and negative signals,
    clamped to [0.0, 1.0].  Score >= 0.60 → PASS, else FAIL.
    """
    score = 0.50

    registry = evidence.get("registry", {})
    website = evidence.get("website", {})
    documents = evidence.get("documents", {})
    tax_id = evidence.get("tax_id", {})
    red_flags = evidence.get("red_flags", {})

    # ── Registry signals ──────────────────────────────────────────────────
    if registry.get("name_match") is True:
        score += 0.20
    if registry.get("registration_number_match") is True:
        score += 0.15
    if any(registry.get(key) is False for key in ("name_match", "registration_number_match", "country_match")):
        score -= 0.35

    # ── Website signals ───────────────────────────────────────────────────
    if website.get("website_reachable") is True:
        score += 0.08
    if website.get("mentions_org_name") is True:
        score += 0.10
    if website.get("mentions_country") is True:
        score += 0.05
    domain_age = website.get("domain_age_days")
    if domain_age is not None and domain_age > 180:
        score += 0.07
    if domain_age is not None and domain_age < 30:
        score -= 0.10
    if website.get("suspicious") is True:
        score -= 0.20

    # ── Document signals ──────────────────────────────────────────────────
    if documents.get("registration_doc_matches_org") is True:
        score += 0.15
    if documents.get("registration_doc_matches_number") is True:
        score += 0.10
    if documents.get("registration_doc_matches_org") is False or documents.get("registration_doc_matches_number") is False:
        score -= 0.30
    if documents.get("registration_doc_valid") is False:
        score -= 0.15

    # ── Tax ID signals ────────────────────────────────────────────────────
    if tax_id.get("tax_id_format_valid") is True:
        score += 0.10
    if tax_id.get("tax_id_format_valid") is False:
        score -= 0.15

    # ── Red flag signals ──────────────────────────────────────────────────
    if red_flags.get("red_flags_found") is False:
        score += 0.05
    if red_flags.get("red_flags_found") is True:
        score -= 0.25

    # ── Suspicious keyword penalty from risk_signals ──────────────────────
    suspicious_count = sum(1 for s in risk_signals if "suspicious" in s.lower())
    score -= 0.10 * suspicious_count

    # ── Clamp and verdict ─────────────────────────────────────────────────
    score = max(0.0, min(1.0, round(score, 4)))
    verdict: Literal["PASS", "FAIL"] = "PASS" if score >= 0.60 else "FAIL"
    return score, verdict


# ═══════════════════════════════════════════════════════════════════════════════
#  LLM-POWERED SUMMARY GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

_SUMMARY_SYSTEM_PROMPT = """You are an AI analyst writing a brief summary for an admin
who is reviewing an NGO application. You are given structured evidence from an
automated screening process.

Rules:
- Do NOT invent facts. Only reference data present in the evidence.
- Mention the strongest positive signals.
- Mention the strongest red flags or risks.
- If any checks returned unknown/null, mention that clearly.
- Keep the summary to 2-4 sentences, concise and professional.
- Do not include the score or verdict — those are shown separately.
- Write in third person, e.g. "The organization..." not "We found..."
"""


async def generate_summary(
    evidence: dict[str, Any],
    risk_signals: list[str],
    errors: list[str],
    score: float,
    verdict: str,
) -> str:
    """Generate a human-readable summary using LLM.

    Falls back to a template-based summary if the LLM call fails.
    """
    try:
        llm = get_llm()
        evidence_text = _format_evidence_for_llm(evidence, risk_signals, errors, score, verdict)
        response = await llm.ainvoke([
            SystemMessage(content=_SUMMARY_SYSTEM_PROMPT),
            HumanMessage(content=evidence_text),
        ])
        summary = response.content.strip()
        if summary:
            return summary
    except Exception as exc:
        logger.warning("Summary LLM call failed, falling back to template: %s", exc)

    # Fallback: template-based summary (same logic as the old code)
    return _fallback_template_summary(evidence, risk_signals, errors, score, verdict)


def _format_evidence_for_llm(
    evidence: dict[str, Any],
    risk_signals: list[str],
    errors: list[str],
    score: float,
    verdict: str,
) -> str:
    """Format evidence into a readable text block for the LLM prompt."""
    lines = [f"Screening verdict: {verdict} (confidence: {score:.2f})\n"]

    registry = evidence.get("registry", {})
    if registry:
        lines.append("Registry check:")
        lines.append(f"  Found: {registry.get('registry_found')}")
        lines.append(f"  Name match: {registry.get('name_match')}")
        lines.append(f"  Number match: {registry.get('registration_number_match')}")
        lines.append(f"  Notes: {registry.get('notes', 'N/A')}")

    website = evidence.get("website", {})
    if website:
        lines.append("Website check:")
        lines.append(f"  Reachable: {website.get('website_reachable')}")
        lines.append(f"  Mentions org: {website.get('mentions_org_name')}")
        lines.append(f"  Mentions country: {website.get('mentions_country')}")
        lines.append(f"  NGO content: {website.get('ngo_content_detected')}")
        lines.append(f"  Suspicious: {website.get('suspicious')}")
        if website.get("content_summary"):
            lines.append(f"  Content: {website['content_summary']}")

    documents = evidence.get("documents", {})
    if documents:
        lines.append("Document check:")
        lines.append(f"  Registration doc valid: {documents.get('registration_doc_valid')}")
        lines.append(f"  Matches org name: {documents.get('registration_doc_matches_org')}")
        lines.append(f"  Matches reg number: {documents.get('registration_doc_matches_number')}")
        lines.append(f"  Tax doc valid: {documents.get('tax_doc_valid')}")
        lines.append(f"  Proof of operation valid: {documents.get('proof_of_operation_valid')}")
        if documents.get("document_red_flags"):
            lines.append(f"  Red flags: {documents['document_red_flags']}")

    tax_id = evidence.get("tax_id", {})
    if tax_id:
        lines.append("Tax ID check:")
        lines.append(f"  Country supported: {tax_id.get('country_supported')}")
        lines.append(f"  Format valid: {tax_id.get('tax_id_format_valid')}")

    red_flags = evidence.get("red_flags", {})
    if red_flags:
        lines.append("Red flag check:")
        lines.append(f"  Red flags found: {red_flags.get('red_flags_found')}")
        if red_flags.get("red_flags"):
            lines.append(f"  Flags: {red_flags['red_flags']}")
        if red_flags.get("positive_mentions"):
            lines.append(f"  Positive mentions: {red_flags['positive_mentions']}")

    if risk_signals:
        lines.append(f"\nRisk signals: {risk_signals[:5]}")
    if errors:
        lines.append(f"Errors/incomplete checks: {errors[:5]}")

    return "\n".join(lines)


def _fallback_template_summary(
    evidence: dict[str, Any],
    risk_signals: list[str],
    errors: list[str],
    score: float,
    verdict: str,
) -> str:
    """Fallback template summary when LLM is unavailable."""
    positives: list[str] = []
    unknowns: list[str] = []
    negatives: list[str] = []

    registry = evidence.get("registry", {})
    website = evidence.get("website", {})
    documents = evidence.get("documents", {})
    tax_id = evidence.get("tax_id", {})
    red_flags = evidence.get("red_flags", {})

    if registry.get("registry_found") is None:
        unknowns.append("registry confirmation was inconclusive")
    if website.get("website_reachable") is True:
        positives.append("the website is reachable")
    elif website.get("website_reachable") is False:
        negatives.append("the website could not be verified")
    if website.get("mentions_org_name") is True:
        positives.append("the website mentions the organization")
    if website.get("mentions_country") is True:
        positives.append("the website mentions the submitted country")
    if documents.get("registration_doc_matches_org") is True:
        positives.append("the registration document matches the organization name")
    if documents.get("registration_doc_matches_number") is True:
        positives.append("the registration document matches the registration number")
    if tax_id.get("tax_id_format_valid") is True:
        positives.append("the tax/registration number format matches the country rules")
    elif tax_id.get("tax_id_format_valid") is None:
        unknowns.append("country-specific tax ID validation is unavailable")
    if red_flags.get("red_flags_found") is False:
        positives.append("no red flags were found in public sources")

    negatives.extend(risk_signals[:3])
    if errors:
        unknowns.append(f"{len(errors)} check(s) had incomplete evidence")

    parts = [f"AI pre-screening returned {verdict} with confidence {score:.2f}."]
    if positives:
        parts.append("Positive signals: " + "; ".join(positives[:4]) + ".")
    if negatives:
        parts.append("Risk signals: " + "; ".join(negatives[:4]) + ".")
    if unknowns:
        parts.append("Unknowns: " + "; ".join(unknowns[:3]) + ".")
    return " ".join(parts)
