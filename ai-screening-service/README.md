# AidChain AI Screening Service

LangGraph + LLM-powered service for NGO application pre-screening.

## Architecture

```
POST /screen  →  LangGraph workflow:

  intake → planning → ┬─ registry_agent  (LLM web research)
                       ├─ website_agent   (HTTP fetch + LLM analysis)
                       ├─ document_agent  (PDF extraction + field matching)
                       ├─ tax_id_agent    (regex validation)
                       └─ red_flag_agent  (LLM web search)
                              ↓
                       evidence_normalizer
                              ↓
                       score_calculator  (deterministic math, NO LLM)
                              ↓
                       summary_generator (LLM writes admin-facing paragraph)
                              ↓
                       final_result  →  {score, verdict, summary, evidence}
```

**Core rule:** Agents collect evidence. Code calculates score. LLM generates explanation.

## Setup

```bash
cd ai-screening-service
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -e .
```

## Environment Variables

```env
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini       # optional, default: gpt-4o-mini
LLM_TEMPERATURE=0.2          # optional, default: 0.2
LOG_LEVEL=INFO                # optional
```

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

The Go backend calls `POST /screen` using `AI_SCREENING_URL`.

```env
# In Go backend .env
AI_SCREENING_URL=http://localhost:8090
```

## API Contract

**Request:**

```json
{
  "application_id": "uuid",
  "organization_name": "Helping Hands India",
  "country": "India",
  "registration_number": "DL/2020/12345",
  "website": "https://helpinghandsindia.org",
  "registration_doc_url": "https://s3.../reg.pdf",
  "tax_id_doc_url": "https://s3.../tax.pdf",
  "proof_of_operation_doc_url": "https://s3.../proof.pdf"
}
```

**Response:**

```json
{
  "application_id": "uuid",
  "aiConfidenceScore": 0.83,
  "aiVerdict": "PASS",
  "aiSummary": "The organization appears to be a legitimate NGO registered in India...",
  "evidence": {
    "registry": {},
    "website": {},
    "documents": {},
    "tax_id": {},
    "red_flags": {},
    "risk_signals": [],
    "errors": []
  }
}
```

## Graceful Degradation

Every LLM-powered agent falls back to rule-based logic if the LLM call fails:
- **Registry agent** → local suspicious-keyword check
- **Website agent** → keyword matching on page text
- **Red flag agent** → local suspicious-term scan
- **Summary generator** → template-based string builder

The service never fails silently — partial evidence is scored, and errors are logged.
