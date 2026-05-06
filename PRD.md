# AidChain — Product Requirements Document

> Blockchain-powered humanitarian aid platform with transparent fund management, proof-based reimbursement, and NGO trust scoring.

---

## 1. Problem Statement

Humanitarian aid systems today face three critical issues:

1. **Lack of Transparency** — Donors cannot verify how their money is used or whether it reaches intended beneficiaries. Major organizations have faced public scrutiny for unaccountable fund usage (e.g., Red Cross post-Haiti 2010).

2. **Slow Fund Movement** — Traditional banking rails involve intermediaries and cross-border delays (3–7 days via SWIFT), slowing down critical crisis response times.

3. **Weak Verification** — NGOs operate on assumed trust. There is no structured, real-time mechanism to prove aid was actually purchased and delivered.

These problems result in inefficiency, eroded donor trust, and delayed impact during crises when speed matters most.

---

## 2. Solution Overview

AidChain is a **mobile-first, blockchain-integrated platform** that enables:

- **Direct funding** of crisis pools via stablecoins
- **Proof-based reimbursement** — NGOs submit receipt photos, OCR data, and location tags
- **Automated fund release** — smart contracts release escrowed funds after backend verification
- **Trust scoring** — NGOs build verifiable reputation through consistent, honest submissions

The system connects donors and NGOs through a single Android application, verifies real-world expenditures via a multi-signal backend, and uses smart contracts to ensure transparent, conditional fund movement.

---

## 3. Target Users

### Donors
Individuals or organizations that contribute funds and want transparency into how their donations are used. They expect real-time tracking, proof of impact, and accountability.

### NGO Field Workers
Operators on the ground responsible for purchasing supplies, delivering aid, and submitting proof of expenditure. They need a simple, fast workflow that works in low-resource environments.

### Platform Admin
The platform operator responsible for reviewing and approving NGO applications, creating crisis pools, and assigning verified NGOs to active pools. Acts as the gatekeeper for fund integrity.

---

## 4. Architecture

The system is built on four layers:

```
┌─────────────────────────────────────────────────┐
│                 📱 Android App                   │
│          (Kotlin + Jetpack Compose)              │
│         Donor UI  ←──→  NGO UI                   │
└──────────────────┬──────────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────────┐
│              ⚙️ Spring Boot Backend              │
│  Auth · OCR · Verification · Trust Scoring      │
│  Blockchain Orchestration · Event Sync          │
└────────┬────────────────────────┬───────────────┘
         │ Web3/RPC               │ Events
┌────────▼────────┐    ┌─────────▼───────────────┐
│  ⛓️ Smart        │    │  📊 Data Pipeline        │
│  Contracts       │    │  (Future: Crisis         │
│  (Polygon)       │    │   Detection)             │
│  Escrow · Pools  │    │                          │
└─────────────────┘    └──────────────────────────┘
```

### 4.1 Mobile Layer (Android)
A single Android application supporting both donor and NGO roles. The interface adapts dynamically based on authenticated user role.

- **Language:** Kotlin
- **UI:** Jetpack Compose
- **OCR:** Google ML Kit (on-device)
- **Wallet:** Web3j for Android
- **Architecture:** MVVM + Clean Architecture

### 4.2 Backend Layer (Spring Boot)
Centralized orchestrator responsible for verification, trust scoring, and blockchain interaction.

- **Framework:** Spring Boot
- **Database:** PostgreSQL
- **Responsibilities:** Auth, NGO application review, proof ingestion, OCR processing, location validation, verification engine, trust score calculation, blockchain event sync, NGO wallet whitelisting

### 4.3 Blockchain Layer (Polygon PoS)
Smart contracts managing fund pools, escrow, and conditional release.

- **Chain:** Polygon PoS (low gas fees, strong stablecoin liquidity)
- **Stablecoin:** USDC (ERC20)
- **Contract Language:** Solidity, Hardhat (tooling)
- **Key Contracts:**
  - `PoolFactory` — NGO whitelist + deploys isolated CrisisPool contracts per crisis
  - `CrisisPool` — per-pool escrow with immutable caps, timelock release, and fraud prevention
- **On-chain storage:** Minimal — only data needed for contract logic (caps, addresses, spending tracking). All metadata (names, regions, descriptions) stored off-chain in backend. Pool ID = contract address.

### 4.4 Data Pipeline Layer (Post-MVP)
Ingests external humanitarian datasets to detect crises and auto-create funding pools.

- **Data Sources:** GDACS, ReliefWeb, ACLED (future)
- **Status:** Deferred to post-MVP

---

## 5. MVP Scope

### 5.1 What's In

#### Admin Features
| Feature | Description |
|---|---|
| **Admin Dashboard** | Web-based panel (separate from Android app) |
| **Review NGO Applications** | View submitted documents, approve or reject with reason |
| **Create Crisis Pools** | Create pools with name, region, target amount, and description |
| **Assign NGOs to Pools** | Assign one or more verified NGOs to an active pool |
| **Whitelist NGO Wallet** | On approval, backend calls NGORegistry contract to whitelist the NGO wallet |

#### Donor Features
| Feature | Description |
|---|---|
| **Auth** | Email/password signup and login |
| **Wallet Connection** | Connect external wallet or embedded wallet |
| **Browse Crisis Pools** | View list of active crisis pools |
| **Donate** | Send USDC to a crisis pool's escrow contract |
| **Transaction History** | View personal donation history |
| **View Proof** | See proof submissions and verification status for funded pools |
| **View NGO Trust Scores** | See trust scores of NGOs operating in a pool |

#### NGO Features
| Feature | Description |
|---|---|
| **Registration + Document Upload** | Signup with org details; upload registration certificate, tax ID, proof of operation |
| **Application Status** | View current verification status (PENDING, VERIFIED, REJECTED) and rejection reason if any |
| **Dashboard** | Only accessible after VERIFIED status; view assigned crisis pools |
| **Capture Receipt** | Take photo of purchase receipt via camera |
| **OCR Preview** | Auto-extract receipt data (amount, vendor, date) with manual correction |
| **Location Tagging** | Attach GPS coordinates to submission |
| **Submit Proof** | Submit receipt image + OCR data + location for verification |
| **Track Reimbursement** | View verification status and fund release status |
| **Trust Score** | View own trust score and history |

#### Smart Contracts
| Contract | Feature | Description |
|---|---|---|
| **PoolFactory** | NGO Whitelist | Stores addresses of admin-approved NGO wallets (addVerifiedNGO / revokeNGO / isVerified) |
| **PoolFactory** | Deploy Pool | Admin deploys a new CrisisPool with immutable caps (maxPerClaim, maxPerNGOPerDay, maxPerNGOPool, timelockDuration) |
| **CrisisPool** | Accept Donations | Receive USDC deposits from donors via ERC20 transferFrom |
| **CrisisPool** | Assign NGO | Admin assigns a verified NGO to this pool |
| **CrisisPool** | Initiate Release | Verifier (backend) creates a timelock-pending release after proof verification |
| **CrisisPool** | Execute Release | Anyone can trigger USDC transfer to NGO after timelock expires |
| **CrisisPool** | Cancel Release | Admin can cancel a pending release before execution |
| **CrisisPool** | Pause/Resume | Admin can pause new donations without affecting existing funds |

#### Backend — Verification Engine
| Signal | Weight | Description |
|---|---|---|
| **OCR Match** | 40% | Does the extracted amount match the claimed reimbursement amount? |
| **Location Plausibility** | 30% | Is the submission GPS within the crisis pool's designated region? |
| **Historical Approval Rate** | 30% | What percentage of the NGO's past submissions were verified? |

#### Backend — Trust Scoring
| Rule | Detail |
|---|---|
| **Initial Score** | New NGOs start at 50/100 upon verification approval |
| **Successful Verification** | Score increases (proportional to submission value) |
| **Failed/Rejected Submission** | Score decreases |
| **Threshold Alert** | If score drops below 20, NGO is flagged for manual review |
| **Visibility** | Donors can see trust scores; NGOs can see their own score |

### 5.2 What's Deferred (Post-MVP)

| Feature | Reason for Deferral |
|---|---|
| Automated crisis detection pipeline | Separate project-level complexity; manually create pools for now |
| Crisis map visualization | A simple list of pools is sufficient for MVP |
| Peer NGO attestation | Requires critical mass of NGOs on platform |
| Beneficiary confirmation | Requires beneficiary-facing interface |
| Blockchain-agnostic abstraction | Pick one chain (Polygon), optimize later |
| Offline-first mode | Important but not blocking for initial demo |
| NGO reporting/banning system | Post-launch moderation feature |
| **Community vote for NGO approval** | Requires active donor base; admin review used for MVP |
| Token economics | Out of scope |
| Advanced AI fraud detection | Out of scope |

---

## 6. User Flows

### 6.1 NGO Onboarding Flow

```
NGO Signup → Enter org details (name, country, registration number)
    │
    ▼
Upload documents (registration certificate, tax ID, proof of operation)
    │
    ▼
Status: PENDING_REVIEW → App shows "Under Review" screen
    │
    ▼
Admin reviews documents on admin panel
    │
    ├──Approved──→ Backend whitelists NGO wallet in NGORegistry contract
    │               Status: VERIFIED → NGO gets notified → Can access dashboard
    │
    └──Rejected──→ Status: REJECTED → NGO notified with reason → Can reapply
```

### 6.2 Admin Flow

```
Admin logs into web panel
    │
    ▼
Review pending NGO applications → View submitted documents
    │
    ├──Approve──→ Backend calls NGORegistry.addVerifiedNGO(walletAddress)
    │              NGO status set to VERIFIED
    │
    └──Reject───→ Admin provides rejection reason → NGO notified
    │
    ▼
Create Crisis Pool → Enter name, region, target amount, description
    │
    ▼
Assign verified NGO(s) to the pool
    │
    ▼
Pool goes live → Donors can now fund it
```

### 6.3 Donor Flow

```
Login/Signup
    │
    ▼
Connect Wallet
    │
    ▼
Browse Active Crisis Pools
    │
    ▼
Select Pool → View Details (region, target, funded %, NGO trust scores)
    │
    ▼
Donate USDC → Transaction sent to escrow contract
    │
    ▼
View Transaction History + Proof Submissions for funded pools
```

### 6.4 NGO Proof Submission Flow (Post-Verification)

```
NGO logs in (VERIFIED status required)
    │
    ▼
View Dashboard → Assigned crisis pools
    │
    ▼
Purchase supplies in the field
    │
    ▼
Capture Receipt Photo → OCR extracts data (amount, vendor, date)
    │
    ▼
Correct any OCR errors manually
    │
    ▼
Attach GPS location → Submit Proof
    │
    ▼
Backend runs multi-signal verification:
  ├─ OCR amount match (40%)
  ├─ Location plausibility (30%)
  └─ Historical approval rate (30%)
    │
    ▼
Verification passed? ──Yes──→ Backend calls CrisisPool.releaseFunds() → USDC sent to NGO wallet
                     └──No──→ Rejected → NGO notified, trust score adjusted
    │
    ▼
NGO views reimbursement status + updated trust score
```

---

## 7. Data Models

### User
```
id: UUID
email: String
passwordHash: String
role: Enum (DONOR, NGO, ADMIN)
walletAddress: String (nullable)
trustScore: Float (NGO only, default 50.0, set on approval)
createdAt: Timestamp
```

### NGOApplication
```
id: UUID
ngoUserId: UUID (FK → User)
organizationName: String
country: String
registrationNumber: String
registrationDocUrl: String
taxIdDocUrl: String
proofOfOperationDocUrl: String
website: String (nullable)
status: Enum (PENDING_REVIEW, VERIFIED, REJECTED)
rejectionReason: String (nullable)
reviewedBy: UUID (FK → User/Admin, nullable)
reviewedAt: Timestamp (nullable)
createdAt: Timestamp
```

### CrisisPool
```
id: UUID
name: String
description: String
region: String
targetAmount: BigDecimal
fundedAmount: BigDecimal
contractAddress: String
assignedNgoIds: List<UUID>
maxPerClaim: BigDecimal          // immutable, set at creation
maxPerNGOPerDay: BigDecimal      // immutable, set at creation
maxPerNGOPool: BigDecimal        // immutable, set at creation
timelockDuration: Int            // immutable, in hours (e.g. 24h)
donationsPaused: Boolean
status: Enum (ACTIVE, DRAINED)   // no manual close — drains naturally
createdBy: UUID (FK → Admin User)
createdAt: Timestamp
```

### Donation
```
id: UUID
donorId: UUID (FK → User)
poolId: UUID (FK → CrisisPool)
amount: BigDecimal
txHash: String
createdAt: Timestamp
```

### ProofSubmission
```
id: UUID
ngoId: UUID (FK → User)
poolId: UUID (FK → CrisisPool)
receiptImageUrl: String
ocrAmount: BigDecimal
ocrVendor: String
ocrDate: String
claimedAmount: BigDecimal
latitude: Double
longitude: Double
verificationStatus: Enum (PENDING, VERIFIED, REJECTED)
verificationScore: Float
releaseId: String (nullable, on-chain releaseId from initiateRelease)
timelockExpiresAt: Timestamp (nullable)
txHash: String (nullable, set after executeRelease)
createdAt: Timestamp
```

### PendingRelease (on-chain, mirrored in DB)
```
id: UUID
releaseIdOnChain: String (bytes32)
submissionId: UUID (FK → ProofSubmission)
ngoId: UUID (FK → User)
poolContractAddress: String
amount: BigDecimal
initiatedAt: Timestamp
timelockExpiresAt: Timestamp
status: Enum (PENDING, EXECUTED, CANCELLED)
cancelReason: String (nullable)
```

### TrustScoreLog
```
id: UUID
ngoId: UUID (FK → User)
previousScore: Float
newScore: Float
reason: String
submissionId: UUID (FK → ProofSubmission, nullable)
createdAt: Timestamp
```

---

## 8. API Endpoints (Backend)

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user (donor or NGO) |
| POST | `/api/auth/login` | Login, returns JWT |

### NGO Verification
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ngo/apply` | Submit NGO application + documents (multipart) |
| GET | `/api/ngo/application/status` | Get own application status + rejection reason |
| GET | `/api/admin/ngo/applications` | List all NGO applications (admin only) |
| GET | `/api/admin/ngo/applications/{id}` | View single application + documents (admin only) |
| POST | `/api/admin/ngo/applications/{id}/approve` | Approve NGO → whitelist wallet on-chain (admin only) |
| POST | `/api/admin/ngo/applications/{id}/reject` | Reject NGO with reason (admin only) |

### Crisis Pools
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/pools` | List all active crisis pools |
| GET | `/api/pools/{id}` | Get pool details + assigned NGOs + trust scores |
| POST | `/api/admin/pools` | Create new pool (admin only) |
| POST | `/api/admin/pools/{id}/assign-ngo` | Assign verified NGO to a pool (admin only) |

### Donations
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/donations` | Record a donation (after on-chain tx) |
| GET | `/api/donations/my` | Get current donor's donation history |
| GET | `/api/donations/pool/{poolId}` | Get all donations for a pool |

### Proof Submissions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/proofs` | Submit proof (multipart: image + metadata) |
| GET | `/api/proofs/my` | Get current NGO's submissions |
| GET | `/api/proofs/pool/{poolId}` | Get all proofs for a pool |
| GET | `/api/proofs/{id}` | Get proof detail + verification result |

### Trust Score
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/trust/my` | Get current NGO's trust score + history |
| GET | `/api/trust/ngo/{ngoId}` | Get an NGO's trust score (public) |

---

## 9. Smart Contract Interface

> Full details in [SMART_CONTRACTS_PRD.md](./SMART_CONTRACTS_PRD.md). Summary below.

### PoolFactory.sol (NGO Registry + Pool Deployer)

```solidity
// State
address public admin;
address public verifier;
IERC20 public immutable usdc;
mapping(address => bool) public verifiedNGOs;
mapping(address => bool) public isPool;
uint256 public poolCount;

// NGO registry functions
function addVerifiedNGO(address ngo) external onlyAdmin;
function revokeNGO(address ngo) external onlyAdmin;
function isVerified(address ngo) external view returns (bool);

// Pool deployment — no strings stored, only caps
function deployPool(
    uint256 maxPerClaim,
    uint256 maxPerNGOPerDay,
    uint256 maxPerNGOPool,
    uint256 timelockDuration
) external onlyAdmin returns (address poolAddress);

// Events
event NGOApproved(address indexed ngo);
event NGORevoked(address indexed ngo);
event PoolDeployed(address indexed poolAddress, uint256 maxPerClaim, uint256 maxPerNGOPerDay, uint256 maxPerNGOPool, uint256 timelockDuration);
```

---

### CrisisPool.sol (Per-Pool Escrow)

```solidity
// Immutable — only data needed for contract logic, no strings
uint256 public immutable maxPerClaim;
uint256 public immutable maxPerNGOPerDay;
uint256 public immutable maxPerNGOPool;
uint256 public immutable timelockDuration;
IERC20 public immutable usdc;
address public immutable factory;
address public immutable admin;
address public immutable verifier;

// Mutable — all used in require checks or transfers
bool public donationsPaused;
uint256 public totalDonated;
uint256 public totalReleased;
mapping(address => bool) public assignedNGOs;
mapping(address => uint256) public totalClaimedByNGO;
mapping(address => uint256) public dailyClaimedByNGO;
mapping(address => uint256) public lastClaimDayByNGO;
mapping(bytes32 => PendingRelease) public pendingReleases;

struct PendingRelease {
    address ngo;
    uint256 amount;
    uint256 initiatedAt;    // proofId emitted in event, NOT stored
    bool executed;
    bool cancelled;
}

// Functions
function donate(uint256 amount) external;
function assignNGO(address ngo) external onlyAdmin;
function initiateRelease(address ngo, uint256 amount, bytes32 proofId) external onlyVerifier returns (bytes32);
function executeRelease(bytes32 releaseId) external;
function cancelRelease(bytes32 releaseId, string memory reason) external onlyAdmin;
function pauseDonations() external onlyAdmin;
function resumeDonations() external onlyAdmin;
function getPoolBalance() external view returns (uint256);
function getDailyClaimedAmount(address ngo) external view returns (uint256);

// Events
event DonationReceived(address indexed donor, uint256 amount);
event NGOAssigned(address indexed ngo);
event ReleaseInitiated(bytes32 indexed releaseId, address indexed ngo, uint256 amount, bytes32 proofId);
event ReleaseExecuted(bytes32 indexed releaseId, address indexed ngo, uint256 amount);
event ReleaseCancelled(bytes32 indexed releaseId, address indexed ngo, uint256 amount, string reason);
event DonationsPaused();
event DonationsResumed();
```

**Access Control:**
- `donate()` — anyone (when not paused)
- `assignNGO()` — admin only
- `initiateRelease()` — verifier (backend) only
- `executeRelease()` — anyone, but only after timelock expires
- `cancelRelease()` — admin only
- `pauseDonations()` / `resumeDonations()` — admin only
- **No withdrawal or closePool function exists** — funds can only ever leave via `executeRelease()` to a verified, assigned NGO wallet
- **Pool ID = contract address** — no separate ID needed

---

## 10. Security Model

### Layer 1 — Backend Verification (first filter)

```
For each ProofSubmission:

  1. ocrMatchScore    = (ocrAmount matches claimedAmount within 5% tolerance) ? 1.0 : 0.0

  2. locationScore    = (GPS coordinates within crisis pool region radius) ? 1.0 : 0.0

  3. historicalScore  = (total verified submissions) / (total submissions) for this NGO
                        (0.0 for new NGOs with no history → treated neutrally)

  4. verificationScore = (0.4 × ocrMatchScore) + (0.3 × locationScore) + (0.3 × historicalScore)

  5. If verificationScore >= 0.6 → pass to Layer 2
     Else → REJECTED, do not call smart contract

  6. NGO trust score update (universal, cumulative):
     - If VERIFIED: trustScore = min(100, trustScore + 2)
     - If REJECTED: trustScore = max(0, trustScore - 5)
     - Asymmetric penalty discourages repeated fraud attempts

  7. If trustScore < 20 → flag NGO for admin manual review
```

### Layer 2 — On-Chain Timelock (safety net when backend is fooled)

```
If Layer 1 passes:

  Backend (verifier wallet) calls CrisisPool.initiateRelease(ngo, amount, proofId)
    → Contract validates all caps on-chain (see Layer 4)
    → Stores PendingRelease with timestamp
    → Does NOT transfer funds yet
    → Emits ReleaseInitiated event

  Timelock window (e.g. 24 hours):
    → Admin can monitor and call cancelRelease() if suspicious
    → After window expires, anyone calls executeRelease()
    → USDC transfers to NGO wallet
    → Emits ReleaseExecuted event

  If cancelled:
    → Funds remain in pool
    → Emits ReleaseCancelled event with reason
    → Backend marks submission REJECTED, adjusts trust score
```

### Layer 4 — On-Chain Hard Caps (absolute ceiling, enforced by contract)

```
Before storing a PendingRelease, contract enforces:

  1. amount <= maxPerClaim
     → Single receipt cannot exceed the per-claim cap set at pool creation

  2. dailyClaimedByNGO[ngo] + amount <= maxPerNGOPerDay
     → NGO cannot exceed daily limit regardless of how many submissions pass backend
     → Daily counter resets at UTC midnight

  3. totalClaimedByNGO[ngo] + amount <= maxPerNGOPool
     → NGO cannot exceed their lifetime cap for this pool

  All three checks are in the smart contract.
  Backend cannot override them. Admin cannot override them.
  Caps are immutable — set at pool creation and never changeable.
```

---

## 11. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | API responses < 500ms; blockchain tx confirmation depends on Polygon block time (~2s) |
| **Reliability** | Retry mechanisms for failed uploads and blockchain transactions |
| **Scalability** | Stateless backend APIs; horizontal scaling via containerization |
| **Security** | JWT-based auth; input sanitization; wallet signature verification; HTTPS only |
| **Usability** | Simple workflows designed for non-technical field workers; minimal steps to submit proof |
| **Storage** | Receipt images stored in cloud storage (S3/GCS) with signed URLs |

---

## 12. Tech Stack Summary

| Layer | Technology |
|---|---|
| Android App | Kotlin, Jetpack Compose, MVVM + Clean Architecture |
| On-device OCR | Google ML Kit Text Recognition |
| Wallet Integration | Web3j for Android |
| Backend | Spring Boot (Java/Kotlin) |
| Database | PostgreSQL |
| File Storage | AWS S3 or Google Cloud Storage |
| Blockchain | Polygon PoS |
| Smart Contracts | Solidity, Hardhat (dev tooling) |
| Stablecoin | USDC (Polygon) |
| Auth | JWT (Spring Security) |

---

## 13. Future Scope (Post-MVP)

| Feature | Priority |
|---|---|
| Automated crisis detection via data pipeline (GDACS, ReliefWeb) | High |
| Crisis map visualization (donor-facing) | High |
| Offline-first proof capture with deferred submission | High |
| **Community vote for NGO approval** (replaces admin-only review once donor base grows) | High |
| Embedded/abstracted wallets (account abstraction) | Medium |
| Peer NGO attestation as verification signal | Medium |
| Beneficiary confirmation as verification signal | Medium |
| NGO reputation dashboard + advanced analytics | Medium |
| Multi-chain support (Base, Celo, etc.) | Low |
| NGO reporting and banning system | Low |
| Advanced AI-based fraud detection | Low |

---

## 14. Success Metrics

| Metric | Target (MVP) |
|---|---|
| End-to-end flow works | Donor can fund → NGO can submit proof → Funds are released |
| NGO verification gate works | Unverified NGOs cannot access pools or receive funds |
| Average admin review time | Admin can review and approve/reject an NGO application in < 5 minutes |
| Average proof verification time | < 30 seconds (backend processing) |
| OCR extraction accuracy | > 70% on clean receipts |
| Trust score reflects behavior | Score trends up for honest NGOs, down for bad actors |
| Donor can trace funds | Every donation maps to proof submissions and on-chain txs |

---

*Document Version: 1.3*
*Last Updated: May 4, 2026*
*Changelog v1.1: Added admin role, NGO verification/onboarding flow, NGORegistry smart contract, NGOApplication data model, admin API endpoints. Crisis pools are admin-created. Community vote for NGO approval moved to post-MVP.*
*Changelog v1.2: Finalized smart contract design. Added CrisisPoolFactory. CrisisPool redesigned with immutable caps, timelock release pattern, no pool closure function. Replaced trust score section with full 3-layer security model. Added PendingRelease data model.*
*Changelog v1.3: Merged NGORegistry into PoolFactory (2 contracts instead of 3). Removed all string storage from on-chain contracts. Removed arrays. Removed proofId from PendingRelease struct (emitted in event only). Pool ID = contract address. Minimal on-chain footprint — only data needed for contract logic is stored.*
