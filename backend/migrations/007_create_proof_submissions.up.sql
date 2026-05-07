CREATE TABLE proof_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ngo_user_id         UUID NOT NULL REFERENCES users(id),
    pool_id             UUID NOT NULL REFERENCES crisis_pools(id),
    receipt_image_url   TEXT NOT NULL,
    ocr_amount          NUMERIC(20,6) NOT NULL,
    ocr_vendor          VARCHAR(255) NOT NULL,
    ocr_date            VARCHAR(50) NOT NULL,
    claimed_amount      NUMERIC(20,6) NOT NULL,
    latitude            DOUBLE PRECISION NOT NULL,
    longitude           DOUBLE PRECISION NOT NULL,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED')),
    verification_score  REAL,
    proof_id_onchain    VARCHAR(66),
    tx_hash             VARCHAR(66),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_proofs_ngo ON proof_submissions(ngo_user_id);
CREATE INDEX idx_proofs_pool ON proof_submissions(pool_id);
CREATE INDEX idx_proofs_status ON proof_submissions(verification_status);
