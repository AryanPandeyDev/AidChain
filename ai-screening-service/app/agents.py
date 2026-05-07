from __future__ import annotations

import re
from datetime import datetime, timezone
from io import BytesIO
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader

NGO_TERMS = {
    "ngo",
    "nonprofit",
    "non-profit",
    "charity",
    "foundation",
    "relief",
    "donation",
    "volunteer",
    "welfare",
    "trust",
}

SUSPICIOUS_TERMS = {"fake", "test", "dummy", "scam", "fraud", "unknown", "sample"}


def normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def contains_loose(haystack: str, needle: str) -> bool:
    normalized_haystack = normalize_text(haystack)
    normalized_needle = normalize_text(needle)
    if not normalized_needle:
        return False
    if normalized_needle in normalized_haystack:
        return True
    words = [word for word in re.split(r"[^a-z0-9]+", normalized_needle) if len(word) > 2]
    return bool(words) and sum(1 for word in words if word in normalized_haystack) >= max(1, len(words) - 1)


async def registry_agent(app: dict[str, Any], checks: list[str]) -> tuple[dict[str, Any], list[str], list[str]]:
    if "registry" not in checks:
        return {"registry_found": None, "notes": "Registry check skipped."}, [], []

    country = normalize_text(app.get("country"))
    supported = country in {"india", "united states", "usa", "us", "united kingdom", "uk"}
    notes = "No direct registry adapter is configured for this country yet."
    if supported:
        notes = "Registry adapter is planned; MVP uses public-search placeholder evidence."

    suspicious = any(term in normalize_text(app.get("organization_name")) for term in SUSPICIOUS_TERMS)
    registration_number = normalize_text(app.get("registration_number"))

    return (
        {
            "registry_found": None,
            "name_match": None,
            "registration_number_match": None,
            "country_match": None,
            "confidence": 0.0,
            "supported_country": supported,
            "notes": notes,
        },
        ["suspicious organization name"] if suspicious else [],
        ["registration number is unusually short"] if len(registration_number) < 5 else [],
    )


async def website_agent(app: dict[str, Any], checks: list[str]) -> tuple[dict[str, Any], list[str], list[str]]:
    website = app.get("website")
    if "website" not in checks or not website:
        return {"website_reachable": None, "notes": "Website was not provided."}, [], []

    parsed = urlparse(website)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return {
            "website_reachable": False,
            "suspicious": True,
            "notes": "Website URL is malformed.",
        }, [], ["malformed website url"]

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            response = await client.get(website, headers={"User-Agent": "AidChainScreeningBot/0.1"})
        text = BeautifulSoup(response.text, "html.parser").get_text(" ", strip=True)
        text_lower = normalize_text(text)
        domain_age_days = None

        return (
            {
                "website_reachable": response.status_code < 400,
                "status_code": response.status_code,
                "domain": parsed.netloc,
                "domain_age_days": domain_age_days,
                "mentions_org_name": contains_loose(text, app.get("organization_name", "")),
                "mentions_country": contains_loose(text, app.get("country", "")),
                "ngo_content_detected": any(term in text_lower for term in NGO_TERMS),
                "suspicious": response.status_code >= 400,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            },
            [],
            [] if response.status_code < 400 else ["website is not reachable"],
        )
    except Exception as exc:
        return {
            "website_reachable": False,
            "suspicious": True,
            "notes": f"Website check failed: {exc}",
        }, [], ["website check failed"]


async def document_agent(app: dict[str, Any], checks: list[str]) -> tuple[dict[str, Any], list[str], list[str]]:
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
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        for label, url in doc_specs:
            try:
                response = await client.get(url, headers={"User-Agent": "AidChainScreeningBot/0.1"})
                if response.status_code >= 400:
                    errors.append(f"{label} document could not be downloaded")
                    continue
                content_type = response.headers.get("content-type", "")
                text = extract_document_text(response.content, content_type)
                extracted[label] = text
                if not text.strip():
                    risk_signals.append(f"{label} document has no extractable text")
            except Exception as exc:
                errors.append(f"{label} document extraction failed: {exc}")

    registration_text = extracted.get("registration", "")
    tax_text = extracted.get("tax", "")
    proof_text = extracted.get("proof", "")

    evidence["registration_doc_valid"] = bool(registration_text)
    evidence["registration_doc_matches_org"] = contains_loose(registration_text, app.get("organization_name", ""))
    evidence["registration_doc_matches_number"] = contains_loose(registration_text, app.get("registration_number", ""))
    evidence["tax_doc_valid"] = bool(tax_text)
    evidence["proof_of_operation_valid"] = bool(proof_text) and (
        contains_loose(proof_text, app.get("organization_name", "")) or any(term in normalize_text(proof_text) for term in NGO_TERMS)
    )

    if evidence["registration_doc_valid"] and not evidence["registration_doc_matches_org"]:
        evidence["document_red_flags"].append("registration document does not mention organization name")
        risk_signals.append("registration document organization mismatch")
    if evidence["registration_doc_valid"] and not evidence["registration_doc_matches_number"]:
        evidence["document_red_flags"].append("registration document does not mention registration number")
        risk_signals.append("registration document number mismatch")

    evidence["extracted_text_lengths"] = {key: len(value) for key, value in extracted.items()}
    return evidence, risk_signals, errors


def extract_document_text(content: bytes, content_type: str) -> str:
    if "pdf" in content_type.lower() or content.startswith(b"%PDF"):
        reader = PdfReader(BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    try:
        return content.decode("utf-8", errors="ignore")
    except Exception:
        return ""


async def tax_id_agent(app: dict[str, Any], checks: list[str]) -> tuple[dict[str, Any], list[str], list[str]]:
    if "tax_id" not in checks:
        return {"country_supported": None, "tax_id_format_valid": None, "notes": "Tax ID check skipped."}, [], []

    country = normalize_text(app.get("country"))
    registration_number = app.get("registration_number", "")
    patterns = {
        "india": [r"[A-Z]{5}[0-9]{4}[A-Z]", r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]", r"[0-9]{7,12}"],
        "united states": [r"\b[0-9]{2}-[0-9]{7}\b"],
        "usa": [r"\b[0-9]{2}-[0-9]{7}\b"],
        "us": [r"\b[0-9]{2}-[0-9]{7}\b"],
        "united kingdom": [r"\b[0-9]{6,8}\b"],
        "uk": [r"\b[0-9]{6,8}\b"],
    }
    supported_patterns = patterns.get(country)
    if not supported_patterns:
        return {"country_supported": False, "tax_id_format_valid": None, "notes": "No tax ID pattern for this country."}, [], []

    valid = any(re.search(pattern, registration_number, re.IGNORECASE) for pattern in supported_patterns)
    return (
        {"country_supported": True, "tax_id_format_valid": valid, "notes": "Tax ID pattern checked against submitted registration number."},
        [],
        [] if valid else ["tax id format is not recognized for country"],
    )


async def red_flag_agent(app: dict[str, Any], checks: list[str]) -> tuple[dict[str, Any], list[str], list[str]]:
    if "red_flags" not in checks:
        return {"red_flags_found": None, "red_flags": [], "notes": "Red-flag check skipped."}, [], []

    haystack = normalize_text(" ".join([
        app.get("organization_name", ""),
        app.get("registration_number", ""),
        app.get("website") or "",
    ]))
    found = sorted(term for term in SUSPICIOUS_TERMS if term in haystack)
    red_flags = [f"suspicious keyword detected: {term}" for term in found]

    return (
        {
            "red_flags_found": bool(red_flags),
            "red_flags": red_flags,
            "queries": [
                f"{app.get('organization_name')} fraud",
                f"{app.get('organization_name')} scam",
                f"{app.get('organization_name')} fake NGO",
                f"{app.get('organization_name')} sanctions",
            ],
            "notes": "MVP uses local suspicious-keyword detection; plug in search/sanctions providers here.",
        },
        red_flags,
        [],
    )

