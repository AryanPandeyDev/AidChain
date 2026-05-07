CREATE TABLE crisis_pools (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    description         TEXT NOT NULL,
    region              VARCHAR(255) NOT NULL,
    region_lat          DOUBLE PRECISION NOT NULL,
    region_lng          DOUBLE PRECISION NOT NULL,
    region_radius_km    DOUBLE PRECISION NOT NULL,
    target_amount       NUMERIC(20,6) NOT NULL,
    contract_address    VARCHAR(42) NOT NULL UNIQUE,
    max_per_claim       NUMERIC(20,6) NOT NULL,
    max_per_ngo_per_day NUMERIC(20,6) NOT NULL,
    max_per_ngo_pool    NUMERIC(20,6) NOT NULL,
    donations_paused    BOOLEAN DEFAULT FALSE,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','DRAINED')),
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
