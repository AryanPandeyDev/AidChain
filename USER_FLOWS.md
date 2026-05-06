# AidChain — User Flows

> Every action in the app, how frontend/backend/blockchain coordinate, and what data moves where.

**Platform:** Web (React/Next.js) · **Backend:** Go · **Chain:** Polygon PoS · **Token:** USDC

---

## Actors

| Actor | Description |
|---|---|
| **Donor** | Funds crisis pools with USDC. Views proofs and NGO trust scores. |
| **NGO** | Field organization. Registers, gets verified, submits proofs, receives USDC. |
| **Admin** | Platform operator. Reviews NGOs, creates pools, assigns NGOs. Uses admin panel. |
| **Backend (Verifier)** | Go server. Holds the verifier hot wallet. Runs verification, calls `releaseFunds()`. |

---

## 1. Authentication & Registration

### 1.1 Donor Registration

```
[Frontend]                          [Backend]                         [DB]
───────────────────────────────────────────────────────────────────────────
1. User fills signup form           
   (email, password, name)          
   Selects role = DONOR             
                        ──POST /api/auth/register──►
                                    2. Validate input
                                    3. Hash password (bcrypt)
                                    4. Create User record             ──► INSERT users
                                       role=DONOR, walletAddress=null
                                    5. Return JWT + user object
                        ◄──────────────────────────
6. Store JWT in localStorage
7. Redirect to donor dashboard
```

### 1.2 NGO Registration

```
[Frontend]                          [Backend]                         [DB]
───────────────────────────────────────────────────────────────────────────
1. User fills signup form
   (email, password, org name)
   Selects role = NGO
                        ──POST /api/auth/register──►
                                    2. Validate input
                                    3. Hash password
                                    4. Create User record             ──► INSERT users
                                       role=NGO, walletAddress=null
                                       trustScore=null (not yet verified)
                                    5. Return JWT + user object
                        ◄──────────────────────────
6. Redirect to NGO application page
```

### 1.3 Login (All Roles)

```
[Frontend]                          [Backend]
──────────────────────────────────────────────
1. Enter email + password
                        ──POST /api/auth/login──►
                                    2. Verify credentials
                                    3. Return JWT + user object (includes role)
                        ◄──────────────────────────
4. Store JWT
5. Route based on role:
   - DONOR → /dashboard
   - NGO   → /ngo/dashboard (or /ngo/apply if not verified)
   - ADMIN → /admin/dashboard
```

### 1.4 Wallet Connection (Donor & NGO)

```
[Frontend]                          [Backend]                         [DB]
───────────────────────────────────────────────────────────────────────────
1. User clicks "Connect Wallet"
2. Browser wallet popup (MetaMask/WalletConnect)
3. User approves connection
4. Frontend gets wallet address
5. Frontend requests signature of a nonce
   to prove wallet ownership
                        ──POST /api/auth/connect-wallet──►
                        {walletAddress, signature, nonce}
                                    6. Verify signature matches address
                                    7. Update user.walletAddress      ──► UPDATE users
                                    8. Return success
                        ◄──────────────────────────
9. UI shows connected wallet address
```

> **Important:** NGOs MUST connect a wallet before submitting their application. This wallet is what gets whitelisted on-chain and receives USDC.

---

## 2. NGO Onboarding

### 2.1 NGO Application Submission

```
[Frontend]                          [Backend]                         [Storage]    [DB]
──────────────────────────────────────────────────────────────────────────────────────
1. NGO fills application form:
   - Organization name
   - Country
   - Registration number
   - Website (optional)
   - Upload: registration certificate
   - Upload: tax ID document
   - Upload: proof of operation

                        ──POST /api/ngo/apply (multipart)──►
                                    2. Validate all fields present
                                    3. Verify user role=NGO
                                    4. Verify walletAddress is set
                                    5. Upload docs to S3/GCS         ──► Store files
                                       Get signed URLs
                                    6. Create NGOApplication          ──► INSERT ngo_applications
                                       status=AI_SCREENING
                                    7. Trigger AI pre-screening (async)
                                    8. Return application object
                        ◄──────────────────────────
9. UI shows "Application Under Review"
   with status badge
```

### 2.2 AI Pre-Screening (Async)

Before any application reaches the admin, an AI layer screens it. This runs as a background job triggered after submission.

```
[Backend - AI Service]                                                [DB]
──────────────────────────────────────────────────────────────────────────

Input: NGOApplication (org name, country, registration number,
       website, uploaded documents)

STEP 1 — RESEARCH & ANALYSIS
─────────────────────────────
1. AI performs automated research on the NGO:
   - Cross-reference org name + registration number
     against public registries (if available)
   - Check website (if provided): is it real,
     does it mention the org, how old is the domain?
   - Analyze uploaded documents:
     does registration cert look legitimate?
     does tax ID format match the country?
   - Look for red flags: newly created entities,
     mismatched country/registration data,
     suspicious document patterns

STEP 2 — GENERATE VERDICT
─────────────────────────
2. AI produces:
   - aiConfidenceScore: 0.0 – 1.0
     (how confident AI is that this is a legitimate NGO)
   - aiSummary: text paragraph summarizing findings
     (e.g., "Organization registered in India since 2018.
      Website active with matching details. Tax ID format
      is valid for Indian NGOs. No red flags found.")
   - aiVerdict: PASS or FAIL

STEP 3 — ROUTE APPLICATION
──────────────────────────
3a. If aiVerdict == FAIL (obvious fake):
    - Update application                     ──► UPDATE ngo_applications
      status = AI_REJECTED                       SET status='AI_REJECTED'
      ai_confidence_score = score
      ai_summary = summary
    - NGO is notified: "Application could not be
      verified. Please ensure your documents are
      valid and reapply."
    - Admin can still see AI_REJECTED applications
      in a separate tab (for oversight)

3b. If aiVerdict == PASS (looks legitimate):
    - Update application                     ──► UPDATE ngo_applications
      status = PENDING_REVIEW                    SET status='PENDING_REVIEW'
      ai_confidence_score = score
      ai_summary = summary
    - Application is now visible to admin
      with AI insights attached
```

> **Implementation Note:** The AI service is a placeholder for now. The interface is defined (input: application data → output: score + summary + verdict) but the internal logic (which LLM, which APIs, which document analysis tools) is TBD. Design the backend with a clean `AIScreeningService` interface so the implementation can be swapped later.

### 2.3 NGO Checks Application Status

```
[Frontend]                          [Backend]                         [DB]
───────────────────────────────────────────────────────────────────────────
1. NGO visits dashboard or
   status page
                        ──GET /api/ngo/application/status──►
                                    2. Fetch application by userId    ◄── SELECT ngo_applications
                                    3. Return status + rejectionReason
                        ◄──────────────────────────
4. UI renders based on status:
   - AI_SCREENING → "Application Under Review" screen
   - PENDING_REVIEW → "Application Under Review" screen
     (NGO does not know about the AI step — same UI)
   - VERIFIED → Redirect to NGO dashboard
   - REJECTED → Show reason + "Reapply" button
   - AI_REJECTED → Show generic message + "Reapply" button
     (don't reveal AI scoring details to the NGO)
```

### 2.4 NGO Reapplication (After Rejection)

```
Same as 2.1 but:
- Backend checks existing application status = REJECTED or AI_REJECTED
- Creates new NGOApplication record (old one preserved for audit)
- OR updates existing record, resets status to AI_SCREENING
```

---

## 3. Admin Flows

### 3.1 Admin Reviews NGO Applications

Admin only sees applications that have **passed AI screening** (status = PENDING_REVIEW). AI_REJECTED applications are in a separate tab for oversight.

```
[Frontend - Admin Panel]            [Backend]                         [DB]
───────────────────────────────────────────────────────────────────────────
1. Admin opens "NGO Applications" tab
                        ──GET /api/admin/ngo/applications──►
                        ?status=PENDING_REVIEW (default)
                                    2. Fetch applications              ◄── SELECT ngo_applications
                                       with status filter
                                    3. Return list
                        ◄──────────────────────────
4. Admin sees table: org name, country,
   AI confidence score, submitted date

5. Admin clicks an application
                        ──GET /api/admin/ngo/applications/{id}──►
                                    6. Return full details + doc URLs  ◄── SELECT ...
                        ◄──────────────────────────
7. Admin sees:
   ┌─────────────────────────────────────────────┐
   │  🤖 AI Screening Results                    │
   │  Confidence: 0.87 / 1.0                     │
   │  Summary: "Organization registered in        │
   │  India since 2018. Website active with       │
   │  matching details. Tax ID format valid       │
   │  for Indian NGOs. No red flags found."       │
   └─────────────────────────────────────────────┘
   - Uploaded documents (signed URLs)
   - Org details (name, country, reg number, website)
   - [Approve] [Reject] buttons
```

### 3.2 Admin Approves NGO

```
[Frontend - Admin Panel]  [Backend]                    [Blockchain]           [DB]
─────────────────────────────────────────────────────────────────────────────────
1. Admin clicks "Approve"
                ──POST /api/admin/ngo/applications/{id}/approve──►
                          2. Validate application exists
                             and status = PENDING_REVIEW
                          3. Get NGO's walletAddress from User
                          4. Call PoolFactory.addVerifiedNGO(walletAddress) ──► TX
                             using ADMIN wallet (cold wallet signs)
                          5. Wait for tx confirmation
                          6. Update application                     ──► UPDATE ngo_applications
                             status = VERIFIED                          SET status='VERIFIED'
                             reviewedBy = admin.id
                             reviewedAt = now()
                          7. Update user.trustScore = 50.0          ──► UPDATE users
                          8. Return success
                ◄──────────────────────────
9. Application row updates to VERIFIED
```

> **On-chain effect:** `PoolFactory.verifiedNGOs[ngoWallet] = true`

### 3.3 Admin Rejects NGO

```
[Frontend - Admin Panel]  [Backend]                                  [DB]
─────────────────────────────────────────────────────────────────────────
1. Admin clicks "Reject"
   Enters rejection reason
                ──POST /api/admin/ngo/applications/{id}/reject──►
                {reason: "Documents expired..."}
                          2. Validate application exists
                          3. Update application                     ──► UPDATE ngo_applications
                             status = REJECTED                          SET status='REJECTED'
                             rejectionReason = reason
                             reviewedBy, reviewedAt
                          4. Return success
                ◄──────────────────────────
5. No on-chain action needed
```

### 3.4 Admin Creates Crisis Pool

```
[Frontend - Admin Panel]  [Backend]                    [Blockchain]           [DB]
─────────────────────────────────────────────────────────────────────────────────
1. Admin fills pool form:
   - Name (e.g. "Turkey Earthquake Relief")
   - Description
   - Region (e.g. "Hatay, Turkey")
   - Region coordinates (lat, lng, radius)
   - Target amount (display only)
   - maxPerClaim (USDC)
   - maxPerNGOPerDay (USDC)
   - maxPerNGOPool (USDC)

                ──POST /api/admin/pools──►
                          2. Validate caps:
                             maxPerClaim > 0
                             maxPerNGOPerDay >= maxPerClaim
                             maxPerNGOPool >= maxPerNGOPerDay
                          3. Call PoolFactory.deployPool(             ──► TX
                               maxPerClaim, maxPerNGOPerDay, maxPerNGOPool
                             ) using ADMIN wallet
                          4. Get pool contract address from event
                          5. Create CrisisPool record               ──► INSERT crisis_pools
                             Store: name, description, region,
                             coordinates, targetAmount, caps,
                             contractAddress, status=ACTIVE
                          6. Return pool object
                ◄──────────────────────────
7. Pool appears in admin pool list
```

> **Key:** Name, description, region — stored ONLY in the backend DB. The smart contract stores nothing except caps and addresses.

### 3.5 Admin Reviews Pool Assignment Requests

NGOs submit requests to be assigned to pools (see Flow 5.5). Admin reviews them here.

```
[Frontend - Admin Panel]  [Backend]                                  [DB]
─────────────────────────────────────────────────────────────────────────
1. Admin opens pool detail page
2. Sees "Pending Assignment Requests" section
                ──GET /api/admin/pools/{poolId}/assignment-requests──►
                                    3. Fetch requests for this pool   ◄── SELECT pool_assignment_requests
                                       with NGO details, trust scores     JOIN users
                                    4. Return list
                ◄──────────────────────────
5. Admin clicks a request to view details:
   - NGO org name, country, trust score
   - Justification text
   - Supporting document (signed URL)
   - Date submitted
```

#### 3.5a Admin Approves Assignment Request

```
[Frontend - Admin Panel]  [Backend]                    [Blockchain]           [DB]
─────────────────────────────────────────────────────────────────────────────────
1. Admin clicks "Approve"
                ──POST /api/admin/pools/{poolId}/assignment-requests/{reqId}/approve──►
                          2. Validate request exists & status=PENDING
                          3. Validate NGO is still VERIFIED
                          4. Get NGO wallet address
                          5. Get pool contract address
                          6. Call CrisisPool.assignNGO(ngoWallet)    ──► TX
                             using ADMIN wallet
                          7. Wait for tx confirmation
                          8. Update request status = APPROVED        ──► UPDATE pool_assignment_requests
                          9. Create assignment record                ──► INSERT pool_ngo_assignments
                         10. Return success
                ◄──────────────────────────
11. Request moves to "Approved" section
12. NGO appears in pool's assigned NGO list
```

#### 3.5b Admin Rejects Assignment Request

```
[Frontend - Admin Panel]  [Backend]                                  [DB]
─────────────────────────────────────────────────────────────────────────
1. Admin clicks "Reject"
   Enters rejection reason
                ──POST /api/admin/pools/{poolId}/assignment-requests/{reqId}/reject──►
                {reason: "NGO does not operate in this region"}
                          2. Validate request exists & status=PENDING
                          3. Update request status = REJECTED        ──► UPDATE pool_assignment_requests
                             rejection_reason = reason
                          4. Return success
                ◄──────────────────────────
5. No on-chain action
6. NGO sees rejection reason in their dashboard
```

### 3.6 Admin Pauses/Resumes Donations

```
[Frontend - Admin Panel]  [Backend]                    [Blockchain]
──────────────────────────────────────────────────────────────────
1. Admin clicks "Pause Donations"
                ──POST /api/admin/pools/{poolId}/pause──►
                          2. Call CrisisPool.pauseDonations()  ──► TX
                          3. Update DB pool.donationsPaused=true
                ◄──────────────────────────
(Resume is the reverse: /resume → resumeDonations())
```

---

## 4. Donor Flows

### 4.1 Browse Crisis Pools

```
[Frontend]                          [Backend]                         [DB]
───────────────────────────────────────────────────────────────────────────
1. Donor visits /pools
                        ──GET /api/pools──►
                                    2. Fetch active pools             ◄── SELECT crisis_pools
                                       with funded amounts,               JOIN donations (SUM)
                                       assigned NGO count
                                    3. Return list
                        ◄──────────────────────────
4. UI renders pool cards:
   - Name, region, description
   - Progress bar (funded / target)
   - Number of assigned NGOs
   - "Donate" button
```

### 4.2 View Pool Details

```
[Frontend]                          [Backend]                         [DB]
───────────────────────────────────────────────────────────────────────────
1. Donor clicks a pool card
                        ──GET /api/pools/{id}──►
                                    2. Fetch pool + assigned NGOs     ◄── SELECT ... JOIN
                                       + NGO trust scores
                                       + recent proof submissions
                                       + on-chain balance (via RPC)
                                    3. Return detailed object
                        ◄──────────────────────────
4. UI shows:
   - Pool info (name, region, description)
   - Funding progress (from on-chain balance)
   - Cap rules (maxPerClaim, etc.)
   - Assigned NGOs with trust scores
   - Recent verified proofs (transparency feed)
   - "Donate" button
```

### 4.3 Donate USDC (Two-Transaction Flow)

```
[Frontend]                          [Wallet/Chain]                    [Backend]         [DB]
──────────────────────────────────────────────────────────────────────────────────────────
1. Donor enters amount (e.g. 100 USDC)
2. Clicks "Donate"

3. Frontend sends USDC.approve(poolAddress, amount)  ──► TX 1
   Wallet popup → user confirms
4. Wait for TX 1 confirmation

5. Frontend sends CrisisPool.donate(amount)          ──► TX 2
   Wallet popup → user confirms
6. Wait for TX 2 confirmation
7. Get txHash from TX 2

8. Frontend calls backend to record donation:
                        ──POST /api/donations──►
                        {poolId, amount, txHash}
                                                      9. Verify txHash on-chain (optional)
                                                     10. Create Donation record     ──► INSERT donations
                                                     11. Update pool funded amount
                                                     12. Return donation object
                        ◄──────────────────────────
13. UI shows success + updated pool balance
```

### 4.4 View Donation History

```
[Frontend]                          [Backend]                         [DB]
───────────────────────────────────────────────────────────────────────────
1. Donor visits /my/donations
                        ──GET /api/donations/my──►
                                    2. Fetch donations by userId      ◄── SELECT donations
                                       with pool names                    JOIN crisis_pools
                                    3. Return list
                        ◄──────────────────────────
4. UI shows table:
   - Pool name, amount, date, txHash (linked to Polygonscan)
```

### 4.5 View Proofs for a Pool (Transparency)

```
[Frontend]                          [Backend]                         [DB]
───────────────────────────────────────────────────────────────────────────
1. Donor clicks "View Proofs" on a pool
                        ──GET /api/proofs/pool/{poolId}──►
                                    2. Fetch proof submissions        ◄── SELECT proof_submissions
                                       (only VERIFIED ones for donors)
                                    3. Return list with:
                                       receipt thumbnail URL,
                                       amount, vendor, date,
                                       verification score, txHash
                        ◄──────────────────────────
4. UI shows proof feed:
   - Receipt image (thumbnail)
   - "500 USDC to ABC Vendor on Jan 5"
   - Verification status badge
   - Link to on-chain tx
```

---

## 5. NGO Flows (Post-Verification)

### 5.1 NGO Dashboard

```
[Frontend]                          [Backend]                         [DB]
───────────────────────────────────────────────────────────────────────────
1. NGO logs in (status must be VERIFIED)
                        ──GET /api/ngo/dashboard──►
                                    2. Verify user is VERIFIED
                                    3. Fetch assigned pools           ◄── SELECT crisis_pools
                                       + claim stats per pool             JOIN pool_ngo_assignments
                                    4. Fetch trust score + history
                                    5. Fetch recent submissions
                                    6. Return dashboard data
                        ◄──────────────────────────
7. UI shows:
   - Trust score (prominent)
   - Assigned pools list
   - Per-pool: balance, your claims today, your total claims
   - Recent submission statuses
   - "Submit Proof" button per pool
   - "Browse Pools" button to request new assignments
```

### 5.2 Submit Proof of Expenditure

```
[Frontend]                          [Backend]                   [Storage]  [Chain]  [DB]
──────────────────────────────────────────────────────────────────────────────────────────

STEP 1 — CAPTURE & PREVIEW
───────────────────────────
1. NGO selects a pool from dashboard
2. Clicks "Submit Proof"
3. Opens camera or uploads receipt photo
4. Frontend runs OCR (client-side via Tesseract.js
   or server-side) to extract:
   - Amount, Vendor name, Date
5. UI shows OCR preview with editable fields
6. NGO corrects any OCR errors
7. NGO enters claimed reimbursement amount
8. Browser captures GPS coordinates

STEP 2 — SUBMIT TO BACKEND
───────────────────────────
9. NGO clicks "Submit"
                        ──POST /api/proofs (multipart)──►
                        Fields: poolId, receiptImage,
                        ocrAmount, ocrVendor, ocrDate,
                        claimedAmount, latitude, longitude
                                    10. Validate all fields
                                    11. Validate NGO is assigned to pool
                                    12. Upload receipt image to S3     ──► Store
                                    13. Create ProofSubmission          ──► INSERT proof_submissions
                                        status = PENDING
                                    14. Return submission object
                        ◄──────────────────────────
15. UI shows "Proof Submitted — Verifying..."

STEP 3 — BACKEND VERIFICATION
──────────────────────────────
                                    16. Run verification engine:

                                    Signal 1: OCR Match (40%)
                                    → ocrAmount vs claimedAmount
                                    → If within 5% tolerance → 1.0, else → 0.0

                                    Signal 2: Location (30%)
                                    → Distance from (lat,lng) to pool region center
                                    → If within radius → 1.0, else → 0.0

                                    Signal 3: Historical Rate (30%)
                                    → (verified count) / (total count)
                                    → New NGO with 0 submissions → 0.5 (neutral)

                                    verificationScore = 0.4×S1 + 0.3×S2 + 0.3×S3

STEP 4A — PASSED (score >= 0.6)
───────────────────────────────
                                    17. Generate proofId = keccak256(submissionId + nonce)
                                    18. Call CrisisPool.releaseFunds(   ──► TX (immediate)
                                          ngoWallet, claimedAmount, proofId
                                        ) using VERIFIER hot wallet
                                    19. Wait for tx confirmation, get txHash
                                    20. Update ProofSubmission:         ──► UPDATE
                                        status=VERIFIED, txHash=txHash
                                    21. trustScore = min(100, trustScore + 2) ──► UPDATE users
                                    22. Log change                     ──► INSERT trust_score_logs

STEP 4B — FAILED (score < 0.6)
──────────────────────────────
                                    17. Update ProofSubmission:         ──► UPDATE
                                        status=REJECTED, verificationScore=score
                                    18. trustScore = max(0, trustScore - 5) ──► UPDATE users
                                    19. Log change                     ──► INSERT trust_score_logs
                                    20. If trustScore < 20: flag NGO for admin review
```

### 5.3 Track Reimbursements

```
GET /api/proofs/my → Table of all submissions with status, amount, txHash link
```

### 5.4 View Trust Score

```
GET /api/trust/my → Current score + history graph + per-change breakdown
```

### 5.5 Request Pool Assignment

Verified NGOs can browse available pools and request to be assigned.

```
[Frontend]                          [Backend]                         [Storage]  [DB]
──────────────────────────────────────────────────────────────────────────────────────

STEP 1 — BROWSE AVAILABLE POOLS
────────────────────────────────
1. NGO clicks "Browse Pools" from dashboard
                        ──GET /api/pools──►
                                    2. Return active pools            ◄── SELECT crisis_pools
                        ◄──────────────────────────
3. UI shows pool cards (same as donor view)
   but with "Request Assignment" button
   Pools the NGO is already assigned to show
   a "Currently Assigned" badge instead
   Pools with pending requests show "Request Pending"

STEP 2 — SUBMIT REQUEST
───────────────────────
4. NGO clicks "Request Assignment" on a pool
5. Modal/page opens with:
   - Pool details (read-only)
   - Justification text field (why this NGO
     should be assigned — region experience,
     capacity, past work, etc.)
   - Supporting document upload (optional —
     e.g., past project reports, regional
     registration, partner letters)
6. NGO submits request

                        ──POST /api/ngo/pools/{poolId}/request-assignment──►
                        Multipart: {justification, supportingDoc (optional)}
                                    7. Validate NGO is VERIFIED
                                    8. Validate pool exists & is ACTIVE
                                    9. Check no existing PENDING request
                                       for this NGO + pool combo
                                   10. Upload doc to S3 (if provided) ──► Store
                                   11. Create assignment request       ──► INSERT pool_assignment_requests
                                       status = PENDING
                                   12. Return request object
                        ◄──────────────────────────
13. UI shows "Request Submitted — Pending Admin Review"

STEP 3 — TRACK REQUEST STATUS
─────────────────────────────
14. NGO can view their requests:
                        ──GET /api/ngo/assignment-requests──►
                                   15. Return all requests by NGO     ◄── SELECT pool_assignment_requests
                                       with pool names, statuses
                        ◄──────────────────────────
16. UI shows table:
    - Pool name, region
    - Status: PENDING / APPROVED / REJECTED
    - If REJECTED: rejection reason
    - Date submitted
```

---

## 6. Backend Event Sync (Blockchain → DB)

```
[Blockchain]                        [Backend Listener]                [DB]
───────────────────────────────────────────────────────────────────────────
DonationReceived(donor, amount)     → Upsert donation record, update fundedAmount
FundsReleased(ngo, amount, proof)   → Verify matches DB submission, update if needed
NGOAssigned(ngo)                    → Sync assignment status
DonationsPaused/Resumed             → Update pool.donationsPaused
```

> The DB is the fast-read layer. On-chain events are the source of truth. The listener ensures consistency. If it misses events, it can replay from a saved block number.

---

## 7. Page Map (Frontend Routes)

### Public Pages
| Route | Page |
|---|---|
| `/` | Landing page (hero, how it works, CTA) |
| `/login` | Login |
| `/register` | Register (choose Donor/NGO) |
| `/pools` | Browse crisis pools |
| `/pools/:id` | Pool detail (public) |

### Donor Pages (auth, role=DONOR)
| Route | Page |
|---|---|
| `/dashboard` | Donor dashboard |
| `/my/donations` | Donation history |
| `/wallet` | Wallet management |

### NGO Pages (auth, role=NGO)
| Route | Page |
|---|---|
| `/ngo/apply` | Application form (if not verified) |
| `/ngo/status` | Application status (pending/rejected) |
| `/ngo/dashboard` | Dashboard (assigned pools, trust score) |
| `/ngo/browse-pools` | Browse pools + request assignment |
| `/ngo/assignment-requests` | Track assignment request statuses |
| `/ngo/pools/:id/submit` | Submit proof |
| `/ngo/submissions` | All submissions |
| `/ngo/trust-score` | Trust score + history |

### Admin Pages (auth, role=ADMIN)
| Route | Page |
|---|---|
| `/admin/dashboard` | Stats overview |
| `/admin/ngo-applications` | NGO applications list |
| `/admin/ngo-applications/:id` | Application detail (approve/reject) |
| `/admin/pools` | Pool list + create |
| `/admin/pools/create` | Create pool form |
| `/admin/pools/:id` | Pool detail (review assignment requests, manage NGOs, pause) |

---

## 8. Data Flow Summary

```
Frontend  → UI, wallet interactions (approve + donate), OCR preview
Backend   → Auth, verification engine, trust scoring, event sync (Go)
            Holds VERIFIER wallet key → calls releaseFunds()
Admin     → Signs admin txs (addVerifiedNGO, deployPool, assignNGO, pause)
Chain     → Source of truth for funds, caps, NGO whitelist

On-chain:   USDC balances, caps, whitelist, assignments, spending trackers, usedProofIds
Backend DB: Users, NGO apps, pool metadata, donations, proofs, trust scores
S3/GCS:     Receipt images, NGO documents
```

---

## 9. Key Invariants Across the Stack

| # | Invariant | Enforced By |
|---|---|---|
| 1 | Unverified NGOs cannot receive funds | Smart contract |
| 2 | Unassigned NGOs cannot receive funds from a pool | Smart contract |
| 3 | No single release exceeds `maxPerClaim` | Smart contract |
| 4 | No NGO exceeds daily limit per pool | Smart contract |
| 5 | No NGO exceeds total limit per pool | Smart contract |
| 6 | Same proof can't be used twice | Smart contract (`usedProofIds`) |
| 7 | Only verifier wallet can call `releaseFunds()` | Smart contract |
| 8 | Only admin can create pools, assign NGOs, whitelist | Smart contract |
| 9 | Verification score ≥ 0.6 required before release | Backend |
| 10 | Trust score < 20 triggers admin review | Backend |
| 11 | Funds cannot be withdrawn or drained by anyone | Smart contract (no withdraw fn) |

---

*Document Version: 1.0 · Last Updated: May 6, 2026*
*Parent: [PRD.md](./PRD.md) · Contracts: [SMART_CONTRACTS_PRD.md](./SMART_CONTRACTS_PRD.md)*
