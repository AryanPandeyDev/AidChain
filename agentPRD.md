# PRD: AI Pre-Screening Agent Workflow for NGO Verification

## 1. Summary

AidChain needs an AI pre-screening system that evaluates NGO applications before they reach admin review. The system should run asynchronously after application submission, collect evidence from multiple sources, calculate a transparent legitimacy score, generate a human-readable summary, and return a final `PASS` or `FAIL` verdict.

The recommended design is a **LangGraph-based multi-agent workflow** where agents collect and interpret evidence, while deterministic backend code calculates the final score.

Core rule:

```text
Agents collect evidence.
Code calculates score.
LLM generates explanation.
System returns structured result.
```

## 2. Goals

- Screen NGO applications before admin review.
- Reduce admin workload by filtering obvious fake or suspicious applications.
- Produce explainable AI results, not black-box decisions.
- Keep final scoring deterministic and auditable.
- Allow future upgrades to registry APIs, OCR tools, LLMs, and document intelligence providers.
- Support async execution, retries, logs, and failure recovery.

## 3. Non-Goals

- AI does not finally approve NGOs.
- AI does not whitelist wallets.
- AI does not directly update production records without backend validation.
- AI does not rely on one free-form LLM judgment for `PASS` or `FAIL`.
- Full global registry coverage is not required for MVP.

## 4. High-Level Flow

```text
NGO submits application
        ↓
Application saved as AI_SCREENING
        ↓
AI screening job starts
        ↓
LangGraph workflow runs
        ↓
Agents collect evidence:
  - registry
  - website
  - documents
  - tax ID
  - red flags
        ↓
Evidence is normalized
        ↓
Deterministic score is calculated
        ↓
LLM generates summary
        ↓
Result returned:
  aiConfidenceScore
  aiSummary
  aiVerdict
        ↓
Backend routes:
  PASS → PENDING_REVIEW
  FAIL → AI_REJECTED
```

## 5. Recommended Tech Stack

- **LangGraph**: workflow orchestration, state machine, conditional routing, retries, checkpoints.
- **LangChain**: tool wrappers for LLM calls, search tools, web tools, and structured output.
- **Python AI service**: best ecosystem for agents, scraping, OCR, document parsing, and ML.
- **Playwright or HTTPX/BeautifulSoup**: website crawling and visible text extraction.
- **RDAP/WHOIS API**: domain age and ownership metadata.
- **OCR / document parsing**:
  - MVP: basic PDF/text extraction + OCR provider.
  - Later: LlamaParse, Google Document AI, AWS Textract, Azure Document Intelligence, or similar.
- **Custom scoring module**: deterministic score and verdict calculation.
- **Postgres/backend integration**: backend triggers the job and persists final results.

## 6. LangGraph Agent Design

The graph should be designed as a controlled workflow, not an autonomous open-ended agent.

```text
START
  ↓
intake_node
  ↓
planning_node
  ↓
parallel evidence nodes:
  registry_agent
  website_agent
  document_agent
  tax_id_agent
  red_flag_agent
  ↓
evidence_normalizer_node
  ↓
score_calculator_node
  ↓
summary_agent_node
  ↓
final_result_node
  ↓
END
```

## 7. Graph State

The workflow state should contain the application, collected evidence, risk signals, errors, score, verdict, and summary.

Required state shape:

```json
{
  "application": {
    "application_id": "uuid",
    "organization_name": "string",
    "country": "string",
    "registration_number": "string",
    "website": "string|null",
    "registration_doc_url": "string",
    "tax_id_doc_url": "string",
    "proof_of_operation_doc_url": "string"
  },
  "evidence": {},
  "risk_signals": [],
  "errors": [],
  "score": null,
  "verdict": null,
  "summary": null
}
```

## 8. Agent Responsibilities

### Intake Node

Validates required input fields and normalizes names, country, URLs, and document references.

Output:

```json
{
  "input_valid": true,
  "missing_fields": []
}
```

### Planning Node

Decides which checks are required.

Rules:

- Always run document check.
- Always run red-flag search.
- Run website check only if website exists.
- Run registry check if country is supported or generic web registry search is possible.
- Run tax ID check if tax document exists.

Output:

```json
{
  "checks": ["registry", "website", "documents", "tax_id", "red_flags"]
}
```

### Registry Agent

Checks whether the organization name and registration number appear in a public registry or public web result.

Output:

```json
{
  "registry_found": true,
  "name_match": true,
  "registration_number_match": true,
  "country_match": true,
  "confidence": 0.8,
  "notes": "Matching registry-like source found."
}
```

Unknown registry support should return `null`, not `false`.

### Website Agent

Checks whether the website is real and connected to the NGO.

Checks:

- Website loads.
- Domain exists.
- Domain age.
- Page mentions organization name.
- Page mentions country.
- Site contains NGO-like content.
- Contact/about pages are present.

Output:

```json
{
  "website_reachable": true,
  "domain_age_days": 730,
  "mentions_org_name": true,
  "mentions_country": true,
  "ngo_content_detected": true,
  "suspicious": false
}
```

### Document Agent

Extracts text from uploaded documents and compares it with submitted fields.

Checks:

- Registration certificate contains org name.
- Registration certificate contains registration number.
- Tax document contains tax ID-like value.
- Proof of operation appears relevant.
- Documents are not blank, duplicate, corrupted, or unrelated.

Output:

```json
{
  "registration_doc_valid": true,
  "registration_doc_matches_org": true,
  "registration_doc_matches_number": true,
  "tax_doc_valid": true,
  "proof_of_operation_valid": true,
  "document_red_flags": []
}
```

### Tax ID Agent

Validates country-specific tax/registration formats using code-first regex rules.

Example:

```text
India → PAN / 80G / FCRA-style patterns where applicable
US → EIN pattern
UK → charity number/company number style patterns
Other countries → unsupported/null
```

Output:

```json
{
  "country_supported": true,
  "tax_id_format_valid": true,
  "notes": "Tax ID format matches expected country pattern."
}
```

### Red Flag Agent

Searches for public risk signals.

Queries:

```text
"{organization_name}" fraud
"{organization_name}" scam
"{organization_name}" fake NGO
"{organization_name}" registration number
"{organization_name}" sanctions
```

Output:

```json
{
  "red_flags_found": false,
  "red_flags": []
}
```

## 9. Scoring Engine

The final score must be calculated by deterministic code.

Initial score:

```text
score = 0.50
```

Positive signals:

```text
Registry name match                 +0.20
Registry number match               +0.15
Website reachable                   +0.08
Website mentions organization        +0.10
Website mentions country             +0.05
Domain age greater than 180 days     +0.07
Registration doc matches org         +0.15
Registration doc matches number      +0.10
Tax ID format valid                  +0.10
No red flags found                   +0.05
```

Negative signals:

```text
Registry mismatch                    -0.35
Document mismatch                    -0.30
Website contradicts org/country      -0.20
Domain age less than 30 days         -0.10
Invalid tax ID format                -0.15
Major public red flag                -0.25
Suspicious keywords                  -0.10 each
```

Clamp result:

```text
score = max(0.0, min(1.0, score))
```

Verdict:

```text
score >= 0.60 → PASS
score < 0.60  → FAIL
```

## 10. Summary Generation

After scoring, an LLM may generate the admin-facing summary using only structured evidence.

The prompt must instruct the model:

- Do not invent facts.
- Mention unknown checks clearly.
- Mention strongest positive signals.
- Mention strongest red flags.
- Keep summary concise.
- Return only a paragraph.

Example output:

```text
The organization details appear mostly consistent. The submitted website is reachable and mentions the organization name and country. Uploaded registration documents appear to match the submitted organization name and registration number. No major public red flags were found. Registry confirmation was unavailable for this country, so the confidence is based on website and document evidence.
```

## 11. Final Result Contract

The AI service must return:

```json
{
  "application_id": "uuid",
  "aiConfidenceScore": 0.87,
  "aiVerdict": "PASS",
  "aiSummary": "Organization details appear consistent...",
  "evidence": {
    "registry": {},
    "website": {},
    "documents": {},
    "tax_id": {},
    "red_flags": {}
  }
}
```

Only these fields are required by the backend:

```json
{
  "aiConfidenceScore": 0.87,
  "aiVerdict": "PASS",
  "aiSummary": "..."
}
```

The full evidence object should be stored/logged for audit if possible.

## 12. Failure Handling

- If one agent fails, the graph continues with partial evidence.
- Failed checks are marked as `unknown`, not automatic failure.
- If document extraction fails, apply a confidence penalty.
- If the whole graph fails, return an error and leave application in `AI_SCREENING`.
- Backend or worker should retry failed jobs.
- Every agent should record source URLs, timestamps, and errors.

## 13. Acceptance Criteria

- Valid application produces a score between `0.0` and `1.0`.
- Every result includes score, verdict, and summary.
- Final verdict is calculated by deterministic scoring code.
- LLM is not allowed to directly decide final verdict.
- Unknown registry support does not automatically fail an application.
- Suspicious documents or mismatched registration details significantly reduce score.
- Workflow can run with partial evidence.
- Engineer can add or replace agents without changing the full flow.

## 14. MVP Implementation Recommendation

Build v1 in this order:

1. LangGraph state and workflow skeleton.
2. Website Agent with real HTTP/domain checks.
3. Document Agent with basic text extraction/OCR.
4. Tax ID Agent with simple country regex support.
5. Red Flag Agent with search tool abstraction.
6. Placeholder Registry Agent.
7. Deterministic scoring module.
8. Summary Agent.
9. Final result API contract.

## 15. Assumptions

- The backend already stores application data and document URLs.
- AI screening runs asynchronously after submission.
- Admin remains the final decision-maker.
- The LLM provider can be changed later.
- The workflow should prioritize explainability over fully autonomous decision-making.
