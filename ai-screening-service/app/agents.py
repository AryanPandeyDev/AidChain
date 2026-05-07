"""
AI Screening Agents — each collects structured evidence about an NGO application.

- registry_agent  : LLM-powered web research for org + registration number
- website_agent   : real HTTP fetch + HTML parsing + LLM content analysis
- document_agent  : downloads docs, extracts text, validates against fields
- tax_id_agent    : deterministic regex validation per country
- red_flag_agent  : LLM-powered web search for fraud/scam/sanctions signals
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from io import BytesIO
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from langchain_core.messages import HumanMessage, SystemMessage
from pypdf import PdfReader

from app.llm import get_llm

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

NGO_TERMS = {
    "ngo", "nonprofit", "non-profit", "charity", "foundation", "relief",
    "donation", "volunteer", "welfare", "trust", "humanitarian", "aid",
}

SUSPICIOUS_TERMS = {"fake", "test", "dummy", "scam", "fraud", "unknown", "sample"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def contains_loose(haystack: str, needle: str) -> bool:
    normalized_haystack = normalize_text(haystack)
    normalized_needle = normalize_text(needle)
    if not normalized_needle:
        return False
    if normalized_needle in normalized_haystack:
        return True
    words = [w for w in re.split(r"[^a-z0-9]+", normalized_needle) if len(w) > 2]
    return bool(words) and sum(1 for w in words if w in normalized_haystack) >= max(1, len(words) - 1)


def _safe_json_parse(text: str) -> dict[str, Any]:
    """Parse JSON from LLM output, stripping markdown fences if present."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM JSON output: %s", cleaned[:200])
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
#  1. REGISTRY AGENT — LLM-powered web research
# ═══════════════════════════════════════════════════════════════════════════════

_REGISTRY_SYSTEM_PROMPT = """You are an NGO verification research assistant.
Given an organization's name, country, and registration number, perform a web
search to determine if this is a real, registered organization.

Return ONLY a JSON object with these exact keys:
{
  "registry_found": true/false/null,
  "name_match": true/false/null,
  "registration_number_match": true/false/null,
  "country_match": true/false/null,
  "confidence": 0.0-1.0,
  "source_urls": ["..."],
  "notes": "Brief explanation of findings"
}

Rules:
- If you cannot find any information, set values to null, NOT false.
- null means "unknown/not found", false means "actively contradicted".
- Be conservative — only mark true if you find clear evidence.
- Include the URLs you referenced in source_urls.
"""


async def registry_agent(app: dict[str, Any], checks: list[str]) -> tuple[dict[str, Any], list[str], list[str]]:
    """Search for the organization in public registries and web sources using LLM."""
    if "registry" not in checks:
        return {"registry_found": None, "notes": "Registry check skipped."}, [], []

    org_name = app.get("organization_name", "")
    country = app.get("country", "")
    reg_number = app.get("registration_number", "")

    # Quick local red-flag check (always runs, even before LLM)
    suspicious = any(term in normalize_text(org_name) for term in SUSPICIOUS_TERMS)
    local_risks = ["suspicious organization name detected"] if suspicious else []

    try:
        llm = get_llm()
        query = (
            f"Research this NGO and determine if it is a real, registered organization:\n"
            f"- Organization name: {org_name}\n"
            f"- Country: {country}\n"
            f"- Registration number: {reg_number}\n\n"
            f"Search for this organization in public registries, government databases, "
            f"and credible sources. Check if the registration number is valid."
        )
        response = await llm.ainvoke([
            SystemMessage(content=_REGISTRY_SYSTEM_PROMPT),
            HumanMessage(content=query),
        ])
        evidence = _safe_json_parse(response.content)

        # Ensure required keys exist
        evidence.setdefault("registry_found", None)
        evidence.setdefault("name_match", None)
        evidence.setdefault("registration_number_match", None)
        evidence.setdefault("country_match", None)
        evidence.setdefault("confidence", 0.0)
        evidence.setdefault("notes", "")
        evidence.setdefault("source_urls", [])

        # Derive risk signals from LLM findings
        risks = list(local_risks)
        if evidence.get("name_match") is False:
            risks.append("registry: organization name does not match")
        if evidence.get("registration_number_match") is False:
            risks.append("registry: registration number mismatch")
        if evidence.get("country_match") is False:
            risks.append("registry: country mismatch")

        return evidence, risks, []

    except Exception as exc:
        logger.exception("Registry agent LLM call failed")
        # Fallback: return placeholder with local checks only
        return (
            {
                "registry_found": None,
                "name_match": None,
                "registration_number_match": None,
                "country_match": None,
                "confidence": 0.0,
                "notes": f"LLM research failed: {exc}. Local keyword check only.",
            },
            local_risks,
            [f"registry LLM research failed: {exc}"],
        )


# ═══════════════════════════════════════════════════════════════════════════════
#  2. WEBSITE AGENT — HTTP fetch + LLM content analysis
# ═══════════════════════════════════════════════════════════════════════════════

_WEBSITE_ANALYSIS_PROMPT = """You are analyzing a website to determine if it belongs to a legitimate NGO.

Organization name: {org_name}
Country: {country}
Website URL: {website}

Here is the extracted text from the website (first 3000 chars):
---
{page_text}
---

Return ONLY a JSON object:
{{
  "mentions_org_name": true/false,
  "mentions_country": true/false,
  "ngo_content_detected": true/false,
  "has_contact_info": true/false,
  "has_about_page_content": true/false,
  "suspicious": true/false,
  "content_summary": "One sentence describing what this website is about"
}}
"""


async def website_agent(app: dict[str, Any], checks: list[str]) -> tuple[dict[str, Any], list[str], list[str]]:
    """Fetch the NGO's website and analyze its content with LLM."""
    website = app.get("website")
    if "website" not in checks or not website:
        return {"website_reachable": None, "notes": "Website was not provided."}, [], []

    parsed = urlparse(website)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return {
            "website_reachable": False,
            "suspicious": True,
            "notes": "Website URL is malformed.",
        }, ["malformed website URL"], ["malformed website url"]

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(website, headers={"User-Agent": "AidChainScreeningBot/0.1"})

        if response.status_code >= 400:
            return {
                "website_reachable": False,
                "status_code": response.status_code,
                "suspicious": True,
                "notes": f"Website returned HTTP {response.status_code}.",
            }, [], ["website returned error status"]

        soup = BeautifulSoup(response.text, "html.parser")
        page_text = soup.get_text(" ", strip=True)[:3000]

        # LLM content analysis
        try:
            llm = get_llm()
            prompt = _WEBSITE_ANALYSIS_PROMPT.format(
                org_name=app.get("organization_name", ""),
                country=app.get("country", ""),
                website=website,
                page_text=page_text,
            )
            llm_response = await llm.ainvoke([HumanMessage(content=prompt)])
            llm_analysis = _safe_json_parse(llm_response.content)
        except Exception as exc:
            logger.warning("Website LLM analysis failed, falling back to keyword matching: %s", exc)
            # Fallback to keyword matching
            text_lower = normalize_text(page_text)
            llm_analysis = {
                "mentions_org_name": contains_loose(page_text, app.get("organization_name", "")),
                "mentions_country": contains_loose(page_text, app.get("country", "")),
                "ngo_content_detected": any(term in text_lower for term in NGO_TERMS),
                "suspicious": False,
                "content_summary": "LLM analysis unavailable; keyword matching used.",
            }

        evidence = {
            "website_reachable": True,
            "status_code": response.status_code,
            "domain": parsed.netloc,
            "domain_age_days": None,  # WHOIS lookup placeholder
            "mentions_org_name": llm_analysis.get("mentions_org_name", False),
            "mentions_country": llm_analysis.get("mentions_country", False),
            "ngo_content_detected": llm_analysis.get("ngo_content_detected", False),
            "has_contact_info": llm_analysis.get("has_contact_info"),
            "has_about_page_content": llm_analysis.get("has_about_page_content"),
            "suspicious": llm_analysis.get("suspicious", False),
            "content_summary": llm_analysis.get("content_summary", ""),
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

        risks = []
        if evidence["suspicious"]:
            risks.append("website content appears suspicious")

        return evidence, risks, []

    except httpx.TimeoutException:
        return {
            "website_reachable": False,
            "suspicious": True,
            "notes": "Website timed out after 10 seconds.",
        }, [], ["website connection timed out"]
    except Exception as exc:
        return {
            "website_reachable": False,
            "suspicious": True,
            "notes": f"Website check failed: {exc}",
        }, [], [f"website check failed: {exc}"]


# ═══════════════════════════════════════════════════════════════════════════════
#  3. DOCUMENT AGENT — downloads + text extraction + validation
# ═══════════════════════════════════════════════════════════════════════════════

async def document_agent(app: dict[str, Any], checks: list[str]) -> tuple[dict[str, Any], list[str], list[str]]:
    """Download uploaded documents, extract text, and validate against submitted fields."""
    if "documents" not in checks:
        return {"documents_checked": False, "notes": "Document check skipped."}, [], []

    evidence: dict[str, Any] = {
        "registration_doc_valid": None,
        "registration_doc_matches_org": None,
        "registration_doc_matches_number": None,
        "tax_doc_valid": None,
        "proof_of_operation_valid": None,
        "document_red_flags": [],
    }
    risk_signals: list[str] = []
    errors: list[str] = []

    doc_specs = [
        ("registration", app.get("registration_doc_url")),
        ("tax", app.get("tax_id_doc_url")),
        ("proof", app.get("proof_of_operation_doc_url")),
    ]

    extracted: dict[str, str] = {}
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for label, url in doc_specs:
            if not url:
                errors.append(f"{label} document URL is missing")
                continue
            try:
                response = await client.get(url, headers={"User-Agent": "AidChainScreeningBot/0.1"})
                if response.status_code >= 400:
                    errors.append(f"{label} document could not be downloaded (HTTP {response.status_code})")
                    continue
                content_type = response.headers.get("content-type", "")
                text = _extract_document_text(response.content, content_type)
                extracted[label] = text
                if not text.strip():
                    risk_signals.append(f"{label} document has no extractable text")
            except Exception as exc:
                errors.append(f"{label} document extraction failed: {exc}")

    registration_text = extracted.get("registration", "")
    tax_text = extracted.get("tax", "")
    proof_text = extracted.get("proof", "")

    evidence["registration_doc_valid"] = bool(registration_text)
    evidence["registration_doc_matches_org"] = contains_loose(
        registration_text, app.get("organization_name", "")
    )
    evidence["registration_doc_matches_number"] = contains_loose(
        registration_text, app.get("registration_number", "")
    )
    evidence["tax_doc_valid"] = bool(tax_text)
    evidence["proof_of_operation_valid"] = bool(proof_text) and (
        contains_loose(proof_text, app.get("organization_name", ""))
        or any(term in normalize_text(proof_text) for term in NGO_TERMS)
    )

    # Flag mismatches
    if evidence["registration_doc_valid"] and not evidence["registration_doc_matches_org"]:
        evidence["document_red_flags"].append("registration document does not mention organization name")
        risk_signals.append("registration document organization mismatch")
    if evidence["registration_doc_valid"] and not evidence["registration_doc_matches_number"]:
        evidence["document_red_flags"].append("registration document does not mention registration number")
        risk_signals.append("registration document number mismatch")

    evidence["extracted_text_lengths"] = {key: len(value) for key, value in extracted.items()}
    return evidence, risk_signals, errors


def _extract_document_text(content: bytes, content_type: str) -> str:
    """Extract readable text from a PDF or plain-text document."""
    if "pdf" in content_type.lower() or content.startswith(b"%PDF"):
        try:
            reader = PdfReader(BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""
    try:
        return content.decode("utf-8", errors="ignore")
    except Exception:
        return ""


# ═══════════════════════════════════════════════════════════════════════════════
#  4. TAX ID AGENT — deterministic regex validation
# ═══════════════════════════════════════════════════════════════════════════════

# Country → list of regex patterns for valid tax/registration IDs.
_TAX_PATTERNS: dict[str, list[str]] = {
    "india":          [r"[A-Z]{5}[0-9]{4}[A-Z]",                         # PAN
                       r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]",  # GSTIN
                       r"[0-9]{7,12}"],                                    # Generic
    "united states":  [r"\b[0-9]{2}-[0-9]{7}\b"],                         # EIN
    "usa":            [r"\b[0-9]{2}-[0-9]{7}\b"],
    "us":             [r"\b[0-9]{2}-[0-9]{7}\b"],
    "united kingdom": [r"\b[0-9]{6,8}\b"],                                # Charity number
    "uk":             [r"\b[0-9]{6,8}\b"],
}


async def tax_id_agent(app: dict[str, Any], checks: list[str]) -> tuple[dict[str, Any], list[str], list[str]]:
    """Validate the registration/tax ID format against country-specific patterns."""
    if "tax_id" not in checks:
        return {"country_supported": None, "tax_id_format_valid": None, "notes": "Tax ID check skipped."}, [], []

    country = normalize_text(app.get("country"))
    registration_number = app.get("registration_number", "")
    supported_patterns = _TAX_PATTERNS.get(country)

    if not supported_patterns:
        return {
            "country_supported": False,
            "tax_id_format_valid": None,
            "notes": f"No tax ID patterns configured for '{app.get('country', '')}'.",
        }, [], []

    valid = any(re.search(pattern, registration_number, re.IGNORECASE) for pattern in supported_patterns)
    return (
        {
            "country_supported": True,
            "tax_id_format_valid": valid,
            "notes": "Tax ID format matched." if valid else "Tax ID format did not match any known pattern.",
        },
        [],
        [] if valid else ["tax ID format is not recognized for this country"],
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  5. RED FLAG AGENT — LLM-powered web search for fraud signals
# ═══════════════════════════════════════════════════════════════════════════════

_RED_FLAG_SYSTEM_PROMPT = """You are a due-diligence investigator checking if an NGO has any public red flags.

Search for the following queries and report what you find:
{queries}

Return ONLY a JSON object:
{{
  "red_flags_found": true/false,
  "red_flags": ["list of specific red flags found, if any"],
  "positive_mentions": ["list of positive/credible mentions found, if any"],
  "source_urls": ["URLs you referenced"],
  "notes": "Brief summary of your investigation"
}}

Rules:
- Only report a red flag if you find CONCRETE evidence (news articles, reports, legal cases).
- Do NOT make assumptions or guess. No evidence = no red flags.
- If you cannot search or find nothing, return red_flags_found: false with empty arrays.
"""


async def red_flag_agent(app: dict[str, Any], checks: list[str]) -> tuple[dict[str, Any], list[str], list[str]]:
    """Search for fraud, scam, or sanctions signals using LLM-powered research."""
    if "red_flags" not in checks:
        return {"red_flags_found": None, "red_flags": [], "notes": "Red-flag check skipped."}, [], []

    org_name = app.get("organization_name", "")
    country = app.get("country", "")

    queries = [
        f'"{org_name}" fraud',
        f'"{org_name}" scam',
        f'"{org_name}" fake NGO',
        f'"{org_name}" {country} sanctions',
        f'"{org_name}" complaints',
    ]

    # Local keyword scan (always runs)
    haystack = normalize_text(" ".join([
        org_name,
        app.get("registration_number", ""),
        app.get("website") or "",
    ]))
    local_flags = sorted(term for term in SUSPICIOUS_TERMS if term in haystack)
    local_risk_signals = [f"suspicious keyword detected: {term}" for term in local_flags]

    # LLM-powered web research
    try:
        llm = get_llm()
        prompt_queries = "\n".join(f"  - {q}" for q in queries)
        response = await llm.ainvoke([
            SystemMessage(content=_RED_FLAG_SYSTEM_PROMPT.format(queries=prompt_queries)),
            HumanMessage(content=(
                f"Investigate this NGO for any red flags:\n"
                f"Organization: {org_name}\n"
                f"Country: {country}\n"
                f"Registration: {app.get('registration_number', '')}\n"
                f"Website: {app.get('website', 'not provided')}"
            )),
        ])
        llm_result = _safe_json_parse(response.content)

        llm_flags = llm_result.get("red_flags", [])
        all_flags = local_risk_signals + [f"web search: {flag}" for flag in llm_flags]

        return (
            {
                "red_flags_found": bool(all_flags),
                "red_flags": all_flags,
                "positive_mentions": llm_result.get("positive_mentions", []),
                "source_urls": llm_result.get("source_urls", []),
                "queries": queries,
                "notes": llm_result.get("notes", ""),
            },
            all_flags,
            [],
        )

    except Exception as exc:
        logger.warning("Red flag LLM search failed, using local keyword check only: %s", exc)
        return (
            {
                "red_flags_found": bool(local_risk_signals),
                "red_flags": local_risk_signals,
                "positive_mentions": [],
                "source_urls": [],
                "queries": queries,
                "notes": f"LLM search failed ({exc}). Local keyword scan only.",
            },
            local_risk_signals,
            [f"red flag LLM search failed: {exc}"],
        )
