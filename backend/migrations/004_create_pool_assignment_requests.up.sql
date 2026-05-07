CREATE TABLE pool_assignment_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id             UUID NOT NULL REFERENCES crisis_pools(id),
    ngo_user_id         UUID NOT NULL REFERENCES users(id),
    justification       TEXT NOT NULL,
    supporting_doc_url  TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    rejection_reason    TEXT,
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pool_id, ngo_user_id, status)
);
CREATE INDEX idx_assign_req_pool ON pool_assignment_requests(pool_id);
CREATE INDEX idx_assign_req_ngo ON pool_assignment_requests(ngo_user_id);
CREATE INDEX idx_assign_req_status ON pool_assignment_requests(status);
