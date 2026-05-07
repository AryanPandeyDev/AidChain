from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator


class ScreeningRequest(BaseModel):
    application_id: str
    organization_name: str = Field(min_length=1)
    country: str = Field(min_length=1)
    registration_number: str = Field(min_length=1)
    website: str | None = None
    registration_doc_url: HttpUrl
    tax_id_doc_url: HttpUrl
    proof_of_operation_doc_url: HttpUrl

    @field_validator("website", mode="before")
    @classmethod
    def empty_website_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = str(value).strip()
        return value or None


class ScreeningResponse(BaseModel):
    application_id: str
    aiConfidenceScore: float = Field(ge=0.0, le=1.0)
    aiVerdict: Literal["PASS", "FAIL"]
    aiSummary: str
    evidence: dict[str, Any] = Field(default_factory=dict)


def request_to_application(request: ScreeningRequest) -> dict[str, Any]:
    data = request.model_dump(mode="json")
    return {
        "application_id": data["application_id"],
        "organization_name": data["organization_name"].strip(),
        "country": data["country"].strip(),
        "registration_number": data["registration_number"].strip(),
        "website": data.get("website"),
        "registration_doc_url": str(data["registration_doc_url"]),
        "tax_id_doc_url": str(data["tax_id_doc_url"]),
        "proof_of_operation_doc_url": str(data["proof_of_operation_doc_url"]),
    }

