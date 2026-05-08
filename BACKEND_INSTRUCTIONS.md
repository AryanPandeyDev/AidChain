# AidChain — Backend Instructions (Go)

> Complete specification for the Go backend. References: [USER_FLOWS.md](./USER_FLOWS.md) · [SMART_CONTRACTS_PRD.md](./SMART_CONTRACTS_PRD.md) · [PRD.md](./PRD.md)

---

## 1. Tech Stack

| Component | Technology |
|---|---|
| Language | Go 1.25 module in current repo |
| HTTP Router | Gin |
| Database | PostgreSQL |
| DB Access | pgx/pgxpool with handwritten SQL |
| Auth | Clerk session JWT verification via `github.com/clerk/clerk-sdk-go/v2` |
| User Provisioning | Clerk webhook `/api/webhooks/clerk`; dev-only `/api/dev/provision` when Gin is not in release mode |
| Blockchain | go-ethereum client wrappers and background event listener |
| File Storage | Planned, not implemented yet. Frontend currently sends URL fields/placeholders. |
| Config | Environment variables via `.env` + `godotenv` |
| Migrations | SQL files in `backend/migrations`; runner in `backend/cmd/migrate` |

Notable change from older specs: this backend no longer owns email/password auth, bcrypt password verification, or `/api/auth/register` and `/api/auth/login`. Clerk owns sign-up/sign-in; the Go backend verifies Clerk sessions and maps them to local `users` rows.

---

## 2. Architecture Overview

```
┌──────────────┐     REST/JSON      ┌──────────────────────────────────────┐
│   Frontend   │ ◄──────────────►   │           Go Backend                 │
│  (React/Vite)│                    │                                      │
└──────────────┘                    │  ┌─────────┐  ┌──────────────────┐  │
                                    │  │  HTTP    │  │  Verification    │  │
                                    │  │  Handlers│  │  Engine          │  │
                                    │  └────┬────┘  └────────┬─────────┘  │
                                    │       │                │            │
                                    │  ┌────▼────────────────▼─────────┐  │
                                    │  │         Service Layer          │  │
                                    │  └────┬──────────┬───────────────┘  │
                                    │       │          │                  │
                                    │  ┌────▼────┐ ┌───▼──────────────┐  │
                                    │  │  DB     │ │  Blockchain      │  │
                                    │  │  (PG)   │ │  Client          │  │
                                    │  └─────────┘ │  (go-ethereum)   │  │
                                    │              └──────────────────┘  │
                                    │                                    │
                                    │  ┌─────────────────────────────┐   │
                                    │  │  Event Listener (goroutine) │   │
                                    │  └─────────────────────────────┘   │
                                    └──────────────────────────────────────┘
```

### Wallets the Backend Manages

| Wallet | How Stored | Used For |
|---|---|---|
| **Verifier** (hot wallet) | Private key in env var / secret manager | Signing `releaseFunds()` txs |
| **Admin** (cold wallet) | Backend prepares unsigned tx → admin signs externally via Ledger/MetaMask | `addVerifiedNGO`, `deployPool`, `assignNGO`, `pauseDonations`, `resumeDonations` |

> **MVP simplification:** If you want the admin flow to be fully automated (no hardware wallet), the admin private key can also be stored server-side. For production, use a hardware wallet or multi-sig.

---

## 3. Database Schema

### 3.1 `users`

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('DONOR', 'NGO', 'ADMIN')),
    wallet_address  VARCHAR(42),          -- 0x-prefixed, set via connect-wallet
    trust_score     REAL,                 -- NGO only, NULL until VERIFIED, then 50.0
    flagged         BOOLEAN DEFAULT FALSE,-- true if trust_score < 20
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### 3.2 `ngo_applications`

```sql
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
                            CHECK (status IN ('AI_SCREENING', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'AI_REJECTED')),
    -- AI screening results (populated async after submission)
    ai_confidence_score     REAL,                 -- 0.0 to 1.0
    ai_summary              TEXT,                 -- AI research summary shown to admin
    ai_verdict              VARCHAR(10),          -- 'PASS' or 'FAIL'
    ai_screened_at          TIMESTAMPTZ,
    -- Admin review (populated when admin approves/rejects)
    rejection_reason        TEXT,
    reviewed_by             UUID REFERENCES users(id),
    reviewed_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ngo_app_user ON ngo_applications(ngo_user_id);
CREATE INDEX idx_ngo_app_status ON ngo_applications(status);
```

### 3.3 `crisis_pools`

```sql
CREATE TABLE crisis_pools (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    description         TEXT NOT NULL,
    region              VARCHAR(255) NOT NULL,
    region_lat          DOUBLE PRECISION NOT NULL,  -- center latitude
    region_lng          DOUBLE PRECISION NOT NULL,  -- center longitude
    region_radius_km    DOUBLE PRECISION NOT NULL,  -- geofence radius
    target_amount       NUMERIC(20,6) NOT NULL,     -- display only (USDC 6 dec)
    contract_address    VARCHAR(42) NOT NULL UNIQUE, -- on-chain pool address
    max_per_claim       NUMERIC(20,6) NOT NULL,
    max_per_ngo_per_day NUMERIC(20,6) NOT NULL,
    max_per_ngo_pool    NUMERIC(20,6) NOT NULL,
    donations_paused    BOOLEAN DEFAULT FALSE,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'DRAINED')),
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.4 `pool_ngo_assignments`

```sql
CREATE TABLE pool_ngo_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id     UUID NOT NULL REFERENCES crisis_pools(id),
    ngo_user_id UUID NOT NULL REFERENCES users(id),
    request_id  UUID REFERENCES pool_assignment_requests(id),  -- link to approved request
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pool_id, ngo_user_id)
);
```

### 3.5 `pool_assignment_requests`

```sql
CREATE TABLE pool_assignment_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id             UUID NOT NULL REFERENCES crisis_pools(id),
    ngo_user_id         UUID NOT NULL REFERENCES users(id),
    justification       TEXT NOT NULL,
    supporting_doc_url  TEXT,              -- optional, S3 key
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    rejection_reason    TEXT,
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pool_id, ngo_user_id, status)  -- one PENDING request per NGO per pool
);
CREATE INDEX idx_assign_req_pool ON pool_assignment_requests(pool_id);
CREATE INDEX idx_assign_req_ngo ON pool_assignment_requests(ngo_user_id);
CREATE INDEX idx_assign_req_status ON pool_assignment_requests(status);
```

### 3.6 `donations`

```sql
CREATE TABLE donations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id    UUID NOT NULL REFERENCES users(id),
    pool_id     UUID NOT NULL REFERENCES crisis_pools(id),
    amount      NUMERIC(20,6) NOT NULL,
    tx_hash     VARCHAR(66) NOT NULL UNIQUE,  -- 0x + 64 hex chars
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_donations_donor ON donations(donor_id);
CREATE INDEX idx_donations_pool ON donations(pool_id);
```

### 3.7 `proof_submissions`

```sql
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
                        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    verification_score  REAL,
    proof_id_onchain    VARCHAR(66),  -- bytes32 hex, set after releaseFunds tx
    tx_hash             VARCHAR(66),  -- set after successful releaseFunds tx
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_proofs_ngo ON proof_submissions(ngo_user_id);
CREATE INDEX idx_proofs_pool ON proof_submissions(pool_id);
CREATE INDEX idx_proofs_status ON proof_submissions(verification_status);
```

### 3.8 `trust_score_logs`

```sql
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
```

### 3.9 `event_sync_cursor`

```sql
CREATE TABLE event_sync_cursor (
    id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
    last_block      BIGINT NOT NULL DEFAULT 0
);
```

---

## 4. API Endpoints

The table below reflects the current Go/Gin implementation in `backend/main.go`. Older register/login JWT endpoints are intentionally absent because Clerk handles auth.

### 4.1 Auth

| Method | Endpoint | Body | Auth | Description | Ref |
|---|---|---|---|---|---|
| POST | `/api/webhooks/clerk` | Clerk Svix webhook payload | Svix signature | Sync Clerk users into local `users` and write `db_user_id`/`role` into Clerk public metadata. | Auth |
| POST | `/api/dev/provision` | `{clerk_user_id, role}` | Dev only | Local development fallback when Clerk webhooks are not configured. Only registered outside Gin release mode. | Auth |
| POST | `/api/auth/connect-wallet` | `{wallet_address, signature, nonce}` | Clerk session | Verify EIP-191 signature and save wallet address on the current user. | Flow 1.4 |

**Session identity:** authenticated handlers use Clerk session JWTs. `middleware.ClerkAuth()` fetches the Clerk user, reads public metadata, and sets `userID`, `role`, and `clerkUserID` in Gin context.

**Recommended missing endpoint:** add `GET /api/me` so the frontend can load the local user profile and route by role without depending only on Clerk metadata timing.

### 4.2 NGO Verification

| Method | Endpoint | Body | Auth | Description | Ref |
|---|---|---|---|---|---|
| POST | `/api/ngo/apply` | JSON org fields + document URL fields | Clerk NGO | Create application with status `AI_SCREENING`; triggers async AI screening. Current frontend still sends placeholder document URLs until upload support exists. | Flow 2.1 |
| GET | `/api/ngo/application/status` | — | Clerk NGO | Return own latest application status and review fields. | Flow 2.3 |
| GET | `/api/admin/ngo/applications` | Query: `?status=PENDING_REVIEW` | Clerk ADMIN | List applications filtered by status; defaults to `PENDING_REVIEW`. | Flow 3.1 |
| GET | `/api/admin/ngo/applications/{id}` | — | Clerk ADMIN | Full application detail + document URLs + AI screening results/evidence. | Flow 3.1 |
| POST | `/api/admin/ngo/applications/{id}/approve` | — | Clerk ADMIN | Call `PoolFactory.addVerifiedNGO(wallet)` when blockchain is configured, then set status `VERIFIED` and trust score 50. | Flow 3.2 |
| POST | `/api/admin/ngo/applications/{id}/reject` | `{reason}` | Clerk ADMIN | Update status to `REJECTED` with reason. No on-chain action. | Flow 3.3 |

### 4.3 Crisis Pools

| Method | Endpoint | Body | Auth | Description | Ref |
|---|---|---|---|---|---|
| GET | `/api/pools` | — | None | List active pools with funded amounts, NGO count. | Flow 4.1 |
| GET | `/api/pools/{id}` | — | None | Pool detail + assigned NGOs + trust scores + recent proofs + on-chain balance. | Flow 4.2 |
| POST | `/api/admin/pools` | `{name, description, region, region_lat, region_lng, region_radius_km, target_amount, max_per_claim, max_per_ngo_per_day, max_per_ngo_pool, contract_address?}` | Clerk ADMIN | Call `PoolFactory.deployPool(caps)` when blockchain is configured; otherwise requires `contract_address` for MVP fallback. Saves metadata to DB. | Flow 3.4 |
| POST | `/api/admin/pools/{id}/pause` | — | Clerk ADMIN | Call `CrisisPool.pauseDonations()` when blockchain is configured, then update DB. | Flow 3.6 |
| POST | `/api/admin/pools/{id}/resume` | — | Clerk ADMIN | Call `CrisisPool.resumeDonations()` when blockchain is configured, then update DB. | Flow 3.6 |

### 4.4 Pool Assignment Requests

Current implementation note: assignment requests use JSON bodies, not multipart uploads. `supporting_doc_url` is an optional URL field only; file upload support is still missing. All routes below are protected by Clerk sessions and role middleware, even if older rows say JWT.

| Method | Endpoint | Body | Auth | Description | Ref |
|---|---|---|---|---|---|
| POST | `/api/ngo/pools/{poolId}/request-assignment` | Multipart: `{justification, supportingDoc?}` | JWT (NGO, VERIFIED) | Submit request to be assigned to a pool. Upload optional doc to S3. Rejects if PENDING request already exists. | Flow 5.5 |
| GET | `/api/ngo/assignment-requests` | — | JWT (NGO) | List own assignment requests with pool names and statuses. | Flow 5.5 |
| GET | `/api/admin/pools/{poolId}/assignment-requests` | Query: `?status=PENDING` | JWT (ADMIN) | List assignment requests for a pool. Includes NGO details + trust scores. | Flow 3.5 |
| POST | `/api/admin/pools/{poolId}/assignment-requests/{reqId}/approve` | — | JWT (ADMIN) | → Call `CrisisPool.assignNGO(wallet)` on-chain → update request status → create assignment. | Flow 3.5a |
| POST | `/api/admin/pools/{poolId}/assignment-requests/{reqId}/reject` | `{reason}` | JWT (ADMIN) | Reject request with reason. No on-chain action. | Flow 3.5b |

### 4.5 Donations

Current implementation note: donations are read-only from the API. The backend records donations through the blockchain event listener. There is no `POST /api/donations` in `backend/main.go`; donor transaction preparation/direct wallet donation remains an MVP gap.

| Method | Endpoint | Body | Auth | Description | Ref |
|---|---|---|---|---|---|
| POST | `/api/donations` | `{poolId, amount, txHash}` | JWT (DONOR) | Record donation after on-chain tx. Optionally verify txHash via RPC. | Flow 4.3 |
| GET | `/api/donations/my` | — | JWT (DONOR) | Own donation history with pool names. | Flow 4.4 |
| GET | `/api/donations/pool/{poolId}` | — | None | All donations for a pool. | — |

### 4.6 Proof Submissions

Current implementation note: proof submission currently accepts JSON with a `receipt_image_url` and manually supplied OCR fields. Receipt image upload and OCR extraction endpoints are not implemented yet.

| Method | Endpoint | Body | Auth | Description | Ref |
|---|---|---|---|---|---|
| POST | `/api/proofs` | Multipart: `poolId, receiptImage, ocrAmount, ocrVendor, ocrDate, claimedAmount, latitude, longitude` | JWT (NGO) | Upload image → create submission → run verification → if passed, call `releaseFunds()` on-chain. | Flow 5.2 |
| GET | `/api/proofs/my` | — | JWT (NGO) | Own submissions with statuses. | Flow 5.3 |
| GET | `/api/proofs/pool/{poolId}` | — | None | Verified proofs for a pool (transparency). Donors see this. | Flow 4.5 |
| GET | `/api/proofs/{id}` | — | JWT | Single proof detail. NGO sees own; donors see verified ones. | — |

### 4.7 Trust Score

Current implementation note: trust routes are under the Clerk-protected `/api` group. `GET /api/trust/ngo/:ngoId` is authenticated in the current backend, not public.

| Method | Endpoint | Auth | Description | Ref |
|---|---|---|---|---|
| GET | `/api/trust/my` | JWT (NGO) | Own trust score + history. | Flow 5.4 |
| GET | `/api/trust/ngo/{ngoUserId}` | None | Public trust score for an NGO. | — |

### 4.8 NGO Dashboard

| Method | Endpoint | Auth | Description | Ref |
|---|---|---|---|---|
| GET | `/api/ngo/dashboard` | JWT (NGO, VERIFIED) | Assigned pools + claim stats + trust score + recent submissions. | Flow 5.1 |

---

## 5. Verification Engine

This is the core backend logic. Runs inside the `POST /api/proofs` handler (synchronously or via async worker).

### 5.1 Three Signals

```
Signal 1: OCR Match (weight = 0.4)
──────────────────────────────────
  tolerance = 0.05  (5%)
  diff = abs(ocrAmount - claimedAmount) / claimedAmount
  ocrScore = (diff <= tolerance) ? 1.0 : 0.0

Signal 2: Location Plausibility (weight = 0.3)
──────────────────────────────────────────────
  distance = haversine(submissionLat, submissionLng, pool.regionLat, pool.regionLng)
  locationScore = (distance <= pool.regionRadiusKm) ? 1.0 : 0.0

Signal 3: Historical Approval Rate (weight = 0.3)
─────────────────────────────────────────────────
  SELECT COUNT(*) FILTER (WHERE verification_status = 'VERIFIED') AS verified,
         COUNT(*) AS total
  FROM proof_submissions WHERE ngo_user_id = ?

  If total == 0 → historicalScore = 0.5  (neutral for new NGOs)
  Else → historicalScore = verified / total
```

### 5.2 Decision

```
verificationScore = (0.4 * ocrScore) + (0.3 * locationScore) + (0.3 * historicalScore)

if verificationScore >= 0.6 → PASS → call releaseFunds() on-chain
else                        → REJECT → no on-chain call
```

### 5.3 Trust Score Update (after every submission)

```
if VERIFIED:
    newScore = min(100, trustScore + 2)
if REJECTED:
    newScore = max(0, trustScore - 5)

UPDATE users SET trust_score = newScore WHERE id = ngoUserId
INSERT INTO trust_score_logs (ngo_user_id, previous_score, new_score, reason, submission_id)

if newScore < 20:
    UPDATE users SET flagged = true WHERE id = ngoUserId
    // Admin should see flagged NGOs in their dashboard
```

### 5.4 Haversine Formula (Go)

```go
func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
    const R = 6371.0 // Earth radius km
    dLat := (lat2 - lat1) * math.Pi / 180
    dLng := (lng2 - lng1) * math.Pi / 180
    a := math.Sin(dLat/2)*math.Sin(dLat/2) +
        math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
        math.Sin(dLng/2)*math.Sin(dLng/2)
    return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}
```

---

## 6. Blockchain Interaction

### 6.1 Setup

1. Generate Go bindings from contract ABIs using `abigen`:
   ```bash
   abigen --abi PoolFactory.abi --pkg contracts --type PoolFactory --out pool_factory.go
   abigen --abi CrisisPool.abi --pkg contracts --type CrisisPool --out crisis_pool.go
   ```

2. Connect via `ethclient.Dial(polygonRPC)`

### 6.2 Contract Calls the Backend Makes

| When | Contract Call | Signed By | Triggered By |
|---|---|---|---|
| NGO approved | `PoolFactory.addVerifiedNGO(ngoWallet)` | Admin | `POST .../approve` |
| Pool created | `PoolFactory.deployPool(caps)` | Admin | `POST /admin/pools` |
| NGO assigned to pool | `CrisisPool.assignNGO(ngoWallet)` | Admin | `POST .../assignment-requests/{id}/approve` |
| Proof verified | `CrisisPool.releaseFunds(ngo, amount, proofId)` | **Verifier** | `POST /api/proofs` |
| Pause donations | `CrisisPool.pauseDonations()` | Admin | `POST .../pause` |
| Resume donations | `CrisisPool.resumeDonations()` | Admin | `POST .../resume` |

### 6.3 proofId Generation

```go
// proofId must be unique per submission. Use keccak256(submissionUUID + nonce)
proofId := crypto.Keccak256Hash(
    []byte(submission.ID.String()),
    []byte(strconv.FormatInt(time.Now().UnixNano(), 10)),
)
// proofId is [32]byte → pass as bytes32 to releaseFunds()
```

### 6.4 Tx Flow for releaseFunds()

```go
// 1. Build tx
auth, _ := bind.NewKeyedTransactorWithChainID(verifierPrivKey, chainID)
auth.GasPrice = suggestedGasPrice

// 2. Send tx
tx, err := crisisPool.ReleaseFunds(auth, ngoAddr, amountBigInt, proofId)

// 3. Wait for receipt
receipt, err := bind.WaitMined(ctx, client, tx)
if receipt.Status != 1 { /* tx reverted — on-chain cap hit */ }

// 4. Save txHash
txHash := tx.Hash().Hex()
```

### 6.5 Error Handling

If `releaseFunds()` reverts on-chain (cap exceeded, NGO revoked, etc.):
- Mark submission as `REJECTED` in DB
- Do NOT update trust score (this is an infrastructure error, not fraud)
- Log the revert reason for debugging

---

## 7. Event Listener (Blockchain → DB Sync)

A background goroutine that polls or subscribes to on-chain events. Ensures the DB mirrors on-chain state.

### Events to Listen For

| Event | Contract | Action |
|---|---|---|
| `DonationReceived(donor, amount)` | CrisisPool | Upsert donation if not recorded via API. Update pool funded amount cache. |
| `FundsReleased(ngo, amount, proofId)` | CrisisPool | Verify matches DB submission. Mark as VERIFIED if not already. |
| `NGOAssigned(ngo)` | CrisisPool | Sync assignment if not recorded via API. |
| `DonationsPausedEvent()` | CrisisPool | Set `crisis_pools.donations_paused = true`. |
| `DonationsResumedEvent()` | CrisisPool | Set `crisis_pools.donations_paused = false`. |
| `NGOApproved(ngo)` | PoolFactory | Verify NGO application status matches. |
| `PoolDeployed(addr, idx, caps)` | PoolFactory | Verify pool record exists. |

### Cursor Tracking

```go
// On startup: read last_block from event_sync_cursor
// Poll loop: query events from last_block+1 to latest
// After processing: UPDATE event_sync_cursor SET last_block = processedBlock
// This allows replay on restart — events are idempotent
```

---

## 8. File Storage (S3/GCS)

Current implementation status: storage is planned but not implemented. The frontend currently sends document and receipt URL fields, and the NGO application screen still creates development placeholder URLs. Add presigned upload endpoints before treating this section as active behavior.

### Upload Flow

1. Receive multipart file in handler
2. Generate key: `ngo-docs/{userId}/{uuid}.{ext}` or `receipts/{submissionId}.{ext}`
3. Upload to S3 bucket with `private` ACL
4. Store the S3 key in DB

### Serving Files

- Generate **pre-signed URLs** (15-min expiry) when the frontend requests doc/image URLs
- Never expose raw S3 keys to the frontend

---

## 9. Environment Variables

```env
# Server
PORT=8080
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/aidchain?sslmode=disable

# AI screening
AI_SCREENING_URL=http://localhost:8090
INTERNAL_SECRET=shared-secret-if-enabled

# Blockchain
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
CHAIN_ID=137
POOL_FACTORY_ADDRESS=0x...
VERIFIER_PRIVATE_KEY=0x...
ADMIN_PRIVATE_KEY=0x...  # only for MVP; production uses hardware wallet

# USDC
USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359

# Storage
AWS_REGION=us-east-1
S3_BUCKET=aidchain-uploads
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## 10. Project Structure

Current repository structure is flatter than the older internal/service layout below:

```text
backend/
  main.go
  handlers/
  middleware/
  db/
  blockchain/
  migrations/
  cmd/migrate/
```

The older tree below is retained only as an architectural reference and should not be treated as the current file layout.

```
backend/
├── cmd/
│   └── server/
│       └── main.go              # Entry point, wire up deps
├── internal/
│   ├── config/
│   │   └── config.go            # Load env vars
│   ├── middleware/
│   │   ├── auth.go              # JWT validation middleware
│   │   └── role.go              # Role-based access (ADMIN, NGO, DONOR)
│   ├── handler/
│   │   ├── auth.go              # Register, login, connect-wallet
│   │   ├── ngo.go               # NGO apply, status, assignment requests
│   │   ├── admin_ngo.go         # Admin NGO review, approve, reject
│   │   ├── admin_pool.go        # Admin pool create, assignment request review, pause
│   │   ├── pool.go              # Public pool list, detail
│   │   ├── donation.go          # Record donation, history
│   │   ├── proof.go             # Submit proof, list proofs
│   │   └── trust.go             # Trust score endpoints
│   ├── service/
│   │   ├── auth_service.go
│   │   ├── ngo_service.go
│   │   ├── ai_screening_service.go  # AI pre-screening interface + impl
│   │   ├── pool_service.go
│   │   ├── donation_service.go
│   │   ├── proof_service.go     # Contains verification engine
│   │   ├── trust_service.go
│   │   └── blockchain_service.go # All on-chain calls
│   ├── repository/
│   │   ├── user_repo.go
│   │   ├── ngo_app_repo.go
│   │   ├── pool_repo.go
│   │   ├── donation_repo.go
│   │   ├── proof_repo.go
│   │   └── trust_repo.go
│   ├── blockchain/
│   │   ├── client.go            # ethclient wrapper
│   │   ├── contracts/           # abigen-generated Go bindings
│   │   │   ├── pool_factory.go
│   │   │   └── crisis_pool.go
│   │   └── listener.go          # Event sync goroutine
│   ├── storage/
│   │   └── s3.go                # S3 upload + presigned URL
│   └── model/
│       ├── user.go
│       ├── ngo_application.go
│       ├── crisis_pool.go
│       ├── donation.go
│       ├── proof_submission.go
│       └── trust_score_log.go
├── migrations/
│   ├── 001_create_users.up.sql
│   ├── 001_create_users.down.sql
│   ├── 002_create_ngo_applications.up.sql
│   └── ...
├── go.mod
├── go.sum
├── Dockerfile
└── .env.example
```

---

## 11. Key Implementation Notes

### 11.1 Wallet Signature Verification

```go
// Frontend signs: "AidChain Wallet Verification\nNonce: {nonce}"
// Backend verifies using ecrecover
msg := fmt.Sprintf("AidChain Wallet Verification\nNonce: %s", nonce)
hash := accounts.TextHash([]byte(msg))  // EIP-191 prefix
pubKey, err := crypto.SigToPub(hash, signatureBytes)
recoveredAddr := crypto.PubkeyToAddress(*pubKey)
// Compare recoveredAddr with claimed walletAddress
```

### 11.2 USDC Amount Handling

USDC has **6 decimals**. The frontend/API uses human-readable amounts (e.g., `1000.50`). The smart contract uses raw uint256 (e.g., `1000500000`).

```go
// Human → On-chain: multiply by 1e6
amountOnChain := new(big.Int).Mul(
    big.NewInt(int64(claimedAmount * 1e6)),
    big.NewInt(1),
)

// On-chain → Human: divide by 1e6
amountHuman := float64(amountOnChain.Int64()) / 1e6
```

### 11.3 Admin TX Signing Strategy

For MVP, the backend holds the admin private key and signs directly. For production:

1. Backend prepares unsigned tx data
2. Returns it to the admin frontend
3. Admin signs with MetaMask/Ledger in browser
4. Frontend submits signed tx to chain
5. Frontend sends txHash back to backend for DB update

### 11.4 Concurrency Safety

- Wrap verification + releaseFunds + DB update in a **database transaction**
- Use `SELECT ... FOR UPDATE` on the proof submission row to prevent double-processing
- The on-chain `usedProofIds` mapping is the ultimate dedup safety net

### 11.5 Rate Limiting

- Clerk handles frontend sign-up/sign-in rate limiting; there are no Go `/api/auth/register` or `/api/auth/login` endpoints in the current repo.
- `/api/proofs`: 10 req/min per NGO user
- All admin endpoints: 30 req/min per admin

---

## 12. Deployment

```
Docker Compose (dev):
  - go-backend (port 8080)
  - postgres (port 5432)
  - (optional) localstack for S3

Production:
  - Docker container on AWS ECS / GCP Cloud Run / Railway
  - Managed PostgreSQL (RDS / Cloud SQL)
  - S3 bucket with IAM role
  - Polygon RPC via Alchemy / Infura
```

---

*Document Version: 1.0 · Last Updated: May 6, 2026*
*References: [USER_FLOWS.md](./USER_FLOWS.md) · [SMART_CONTRACTS_PRD.md](./SMART_CONTRACTS_PRD.md) · [PRD.md](./PRD.md)*
