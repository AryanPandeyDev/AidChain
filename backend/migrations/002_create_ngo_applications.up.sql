CREATE TABLE ngo_applications (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ngo_user_id             UUID NOT NULL REFERENCES users(id),
    organization_name       VARCHAR(255) NOT NULL,
    country                 VARCHAR(100) NOT NULL,
    registration_number     VARCHAR(100) NOT NULL,
    website                 VARCHAR(255),
    registration_doc_url    TEXT NOT NULL,
    tax_id_doc_url          TEXT NOT NULL,
    proof_of_operation_url  TEXT NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'AI_SCREENING'
                            CHECK (status IN ('AI_SCREENING','PENDING_REVIEW','VERIFIED','REJECTED','AI_REJECTED')),
    ai_confidence_score     REAL,
    ai_summary              TEXT,
    ai_verdict              VARCHAR(10),
    ai_screened_at          TIMESTAMPTZ,
    rejection_reason        TEXT,
    reviewed_by             UUID REFERENCES users(id),
    reviewed_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ngo_app_user ON ngo_applications(ngo_user_id);
CREATE INDEX idx_ngo_app_status ON ngo_applications(status);
