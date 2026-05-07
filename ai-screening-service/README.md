# AidChain AI Screening Service

LangGraph service for NGO application pre-screening.

## Run Locally

```bash
cd ai-screening-service
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

The Go backend calls `POST /screen` using `AI_SCREENING_SERVICE_URL`.

```env
AI_SCREENING_SERVICE_URL=http://localhost:8090
```

## Contract

Request:

```json
{
  "application_id": "uuid",
  "organization_name": "Helping Hands India",
  "country": "India",
  "registration_number": "DL/2020/12345",
  "website": "https://helpinghandsindia.org",
  "registration_doc_url": "https://...",
  "tax_id_doc_url": "https://...",
  "proof_of_operation_doc_url": "https://..."
}
```

Response:

```json
{
  "application_id": "uuid",
  "aiConfidenceScore": 0.87,
  "aiVerdict": "PASS",
  "aiSummary": "Organization details appear consistent...",
  "evidence": {}
}
```

## Design Rule

Agents collect evidence. Code calculates score. The summary is generated only from structured evidence.

