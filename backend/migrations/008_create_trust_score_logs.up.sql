CREATE TABLE trust_score_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ngo_user_id     UUID NOT NULL REFERENCES users(id),
    previous_score  REAL NOT NULL,
    new_score       REAL NOT NULL,
    reason          TEXT NOT NULL,
    submission_id   UUID REFERENCES proof_submissions(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trust_logs_ngo ON trust_score_logs(ngo_user_id);
