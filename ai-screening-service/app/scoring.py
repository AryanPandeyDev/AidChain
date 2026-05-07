from __future__ import annotations

from typing import Any, Literal


def calculate_score(evidence: dict[str, Any], risk_signals: list[str]) -> tuple[float, Literal["PASS", "FAIL"]]:
    score = 0.50

    registry = evidence.get("registry", {})
    website = evidence.get("website", {})
    documents = evidence.get("documents", {})
    tax_id = evidence.get("tax_id", {})
    red_flags = evidence.get("red_flags", {})

    if registry.get("name_match") is True:
        score += 0.20
    if registry.get("registration_number_match") is True:
        score += 0.15
    if any(registry.get(key) is False for key in ("name_match", "registration_number_match", "country_match")):
        score -= 0.35

    if website.get("website_reachable") is True:
        score += 0.08
    if website.get("mentions_org_name") is True:
        score += 0.10
    if website.get("mentions_country") is True:
        score += 0.05
    if website.get("domain_age_days") is not None and website["domain_age_days"] > 180:
        score += 0.07
    if website.get("domain_age_days") is not None and website["domain_age_days"] < 30:
        score -= 0.10
    if website.get("suspicious") is True:
        score -= 0.20

    if documents.get("registration_doc_matches_org") is True:
        score += 0.15
    if documents.get("registration_doc_matches_number") is True:
        score += 0.10
    if documents.get("registration_doc_matches_org") is False or documents.get("registration_doc_matches_number") is False:
        score -= 0.30
    if documents.get("registration_doc_valid") is False:
        score -= 0.15

    if tax_id.get("tax_id_format_valid") is True:
        score += 0.10
    if tax_id.get("tax_id_format_valid") is False:
        score -= 0.15

    if red_flags.get("red_flags_found") is False:
        score += 0.05
    if red_flags.get("red_flags_found") is True:
        score -= 0.25

    suspicious_count = sum(1 for signal in risk_signals if "suspicious keyword" in signal or "suspicious" in signal)
    score -= 0.10 * suspicious_count

    score = max(0.0, min(1.0, round(score, 4)))
    verdict: Literal["PASS", "FAIL"] = "PASS" if score >= 0.60 else "FAIL"
    return score, verdict


def generate_summary(evidence: dict[str, Any], risk_signals: list[str], errors: list[str], score: float, verdict: str) -> str:
    positives: list[str] = []
    unknowns: list[str] = []
    negatives: list[str] = []

    registry = evidence.get("registry", {})
    website = evidence.get("website", {})
    documents = evidence.get("documents", {})
    tax_id = evidence.get("tax_id", {})
    red_flags = evidence.get("red_flags", {})

    if registry.get("registry_found") is None:
        unknowns.append("registry confirmation is unavailable in the MVP")
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
        positives.append("the tax or registration number format matches the country rules")
    elif tax_id.get("tax_id_format_valid") is None:
        unknowns.append("country-specific tax ID validation is unavailable")
    if red_flags.get("red_flags_found") is False:
        positives.append("no local red-flag keywords were found")

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

