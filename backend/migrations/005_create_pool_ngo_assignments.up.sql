CREATE TABLE pool_ngo_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id     UUID NOT NULL REFERENCES crisis_pools(id),
    ngo_user_id UUID NOT NULL REFERENCES users(id),
    request_id  UUID REFERENCES pool_assignment_requests(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pool_id, ngo_user_id)
);
