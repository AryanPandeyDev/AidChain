"""
Standalone test for the AI screening workflow.
Run from the ai-screening-service directory:

    python test_screening.py

No server needed — invokes the LangGraph graph directly.
Uses public PDF URLs so no S3 access required.
"""
import asyncio
import json
import os

from dotenv import load_dotenv

load_dotenv()

from app.graph import screening_graph  # noqa: E402 (must be after load_dotenv)

# ── Test cases ────────────────────────────────────────────────────────────────

# A public PDF that's simple enough to download for document testing
PUBLIC_PDF = "https://www.w3.org/WAI/WCAG21/wcag21.pdf"

TEST_CASES = [
    {
        "label": "LEGIT — Real-looking Indian NGO with website",
        "payload": {
            "application_id": "test-001",
            "organization_name": "HelpAge India",
            "country": "India",
            "registration_number": "AABCH1234F",
            "website": "https://www.helpageindia.org",
            "registration_doc_url": PUBLIC_PDF,
            "tax_id_doc_url": PUBLIC_PDF,
            "proof_of_operation_doc_url": PUBLIC_PDF,
        },
        "expected_verdict": "PASS",
    },
    {
        "label": "SUSPICIOUS — Obvious fake keywords in org name",
        "payload": {
            "application_id": "test-002",
            "organization_name": "Fake Test Dummy NGO Foundation",
            "country": "India",
            "registration_number": "abc",  # too short
            "website": None,
            "registration_doc_url": PUBLIC_PDF,
            "tax_id_doc_url": PUBLIC_PDF,
            "proof_of_operation_doc_url": PUBLIC_PDF,
        },
        "expected_verdict": "FAIL",
    },
    {
        "label": "NO WEBSITE — Legit US NGO, no website provided",
        "payload": {
            "application_id": "test-003",
            "organization_name": "Doctors Without Borders USA",
            "country": "United States",
            "registration_number": "13-3433452",  # real EIN format
            "website": None,
            "registration_doc_url": PUBLIC_PDF,
            "tax_id_doc_url": PUBLIC_PDF,
            "proof_of_operation_doc_url": PUBLIC_PDF,
        },
        "expected_verdict": "PASS",
    },
]

# ── Runner ────────────────────────────────────────────────────────────────────

async def run_test(case: dict) -> None:
    print(f"\n{'='*65}")
    print(f"  {case['label']}")
    print(f"{'='*65}")

    payload = case["payload"]
    print(f"  Org:     {payload['organization_name']}")
    print(f"  Country: {payload['country']}")
    print(f"  Reg#:    {payload['registration_number']}")
    print(f"  Website: {payload.get('website') or '(none)'}")
    print()

    try:
        state = await screening_graph.ainvoke({
            "application": payload,
            "risk_signals": [],
            "errors": [],
        })
        result = state["result"]

        score   = result["aiConfidenceScore"]
        verdict = result["aiVerdict"]
        summary = result["aiSummary"]
        errors  = result["evidence"].get("errors", [])
        risks   = result["evidence"].get("risk_signals", [])

        expected = case["expected_verdict"]
        match = "✅ MATCH" if verdict == expected else f"⚠️  EXPECTED {expected}"

        print(f"  Verdict:  {verdict}  {match}")
        print(f"  Score:    {score:.2f}")
        print(f"  Summary:  {summary}")
        if risks:
            print(f"  Risks:    {risks[:4]}")
        if errors:
            print(f"  Errors:   {errors[:4]}")

    except Exception as exc:
        print(f"  ❌ FAILED: {exc}")


async def main() -> None:
    print("\n🔍  AidChain AI Screening — Isolation Test")
    print(f"    Model: {os.getenv('LLM_MODEL', 'gpt-4o-mini')}")
    print(f"    Base:  {os.getenv('OPENAI_API_BASE', 'https://models.inference.ai.azure.com')}")

    for case in TEST_CASES:
        await run_test(case)

    print(f"\n{'='*65}")
    print("  Done.")
    print(f"{'='*65}\n")


if __name__ == "__main__":
    asyncio.run(main())
