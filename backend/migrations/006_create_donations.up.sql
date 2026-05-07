CREATE TABLE donations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id    UUID NOT NULL REFERENCES users(id),
    pool_id     UUID NOT NULL REFERENCES crisis_pools(id),
    amount      NUMERIC(20,6) NOT NULL,
    tx_hash     VARCHAR(66) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_donations_donor ON donations(donor_id);
CREATE INDEX idx_donations_pool ON donations(pool_id);
