# AidChain — Smart Contracts PRD

> Detailed specification for all on-chain contracts powering the AidChain humanitarian aid platform.

---

## 1. Overview

The smart contract layer is responsible for:

- **Managing NGO verification** on-chain via a whitelist
- **Deploying isolated crisis pools** via a factory pattern
- **Holding donated USDC in escrow** within each pool
- **Enforcing immutable spending caps** per claim, per day, and per NGO
- **Transferring funds immediately** upon verified release — USDC is sent directly to the NGO in a single transaction
- **Guaranteeing that no one (including admin) can withdraw or drain funds** — money only ever flows to verified, assigned NGO wallets through `releaseFunds()`

### Design Principles

1. **Funds are untouchable** — No withdrawal, no closePool, no admin override. USDC leaves only via the verified release path.
2. **Caps are immutable** — Set at pool deployment, never changeable. Donors can trust the rules they see at donation time.
3. **Pool isolation** — Each crisis gets its own contract. A bug or exploit in Pool A cannot affect Pool B.
4. **Separation of roles** — Admin (cold wallet) and Verifier (backend hot wallet) have distinct, minimal permissions.
5. **Minimal on-chain storage** — Only data needed for contract logic is stored. All metadata (names, descriptions, regions) lives off-chain in the backend. Events are used for transparency and auditability.
6. **Immediate transfers** — No timelock or challenge period. Once the verifier calls `releaseFunds()`, USDC is transferred to the NGO in the same transaction.

---

## 2. Chain & Token

| Parameter | Value |
|---|---|
| **Network** | Polygon PoS |
| **Stablecoin** | USDC (ERC20 on Polygon) |
| **USDC Contract (Mainnet)** | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| **USDC Contract (Amoy Testnet)** | Deploy a mock ERC20 for testing |
| **USDC Decimals** | 6 (all uint256 amounts are in 6-decimal precision) |
| **Solidity Version** | ^0.8.20 |
| **Dev Framework** | Foundry (Forge) |
| **Testing** | Forge tests (Solidity) |

---

## 3. Roles

Two privileged roles exist across the contracts. They are **separate wallets**.

| Role | Wallet Type | Purpose | Used In |
|---|---|---|---|
| **Admin** | Cold/hardware wallet (e.g. Ledger) | NGO approval, pool creation, NGO assignment, donation pausing | PoolFactory, CrisisPool |
| **Verifier** | Hot wallet controlled by Spring Boot backend | Initiates and immediately executes fund releases after backend verification passes | CrisisPool only |

### Why separate?

- Admin is high-security, used infrequently (pool creation, NGO review)
- Verifier is used programmatically by the backend for every approved proof — if this key is compromised, the attacker is still limited by immutable caps
- Compromising the verifier does NOT give access to admin functions (pause, assign)

---

## 4. Contract Architecture

Two contracts. NGO registry is merged into the factory to minimize deployment cost and contract count.

```
┌─────────────────────────────────┐
│     PoolFactory.sol              │  ← Single global instance
│  (NGO whitelist + pool deployer) │
└──────────────┬──────────────────┘
               │ deploys
     ┌─────────▼──────┐  ┌────────────────┐  ┌────────────────┐
     │  CrisisPool    │  │  CrisisPool    │  │  CrisisPool    │
     │  (Pool A)      │  │  (Pool B)      │  │  (Pool C)      │
     └────────────────┘  └────────────────┘  └────────────────┘
     Each holds its own USDC, isolated from others
     Pool ID = contract address
```

**Deployment order:**
1. Deploy `PoolFactory` (with admin address + verifier address + USDC token address)
2. Admin calls `factory.deployPool(...)` for each crisis → deploys a new `CrisisPool`

---

## 5. Contract #1 — PoolFactory.sol

### Purpose
Single global contract that serves two functions:
1. **NGO registry** — maintains a whitelist of admin-approved NGO wallet addresses
2. **Pool deployer** — deploys isolated CrisisPool contracts per crisis

### State

```solidity
address public admin;
address public verifier;
IERC20 public immutable usdc;

// NGO registry
mapping(address => bool) public verifiedNGOs;

// Pool tracking
mapping(address => bool) public isPool;
uint256 public poolCount;
```

### Constructor

```solidity
constructor(address _admin, address _verifier, address _usdc) {
    require(_admin != address(0), "Invalid admin");
    require(_verifier != address(0), "Invalid verifier");
    require(_usdc != address(0), "Invalid USDC");
    admin = _admin;
    verifier = _verifier;
    usdc = IERC20(_usdc);
}
```

### Functions — NGO Registry

| Function | Access | Description |
|---|---|---|
| `addVerifiedNGO(address ngo)` | `onlyAdmin` | Adds an NGO wallet to the whitelist. Reverts if already verified or zero address. Emits `NGOApproved`. |
| `revokeNGO(address ngo)` | `onlyAdmin` | Removes an NGO wallet from the whitelist. Reverts if not currently verified. Emits `NGORevoked`. |
| `isVerified(address ngo)` | Public (view) | Returns `true` if the address is a verified NGO. Called by CrisisPool contracts. |

### Functions — Pool Deployment

```solidity
function deployPool(
    uint256 maxPerClaim,
    uint256 maxPerNGOPerDay,
    uint256 maxPerNGOPool
) external onlyAdmin returns (address poolAddress);
```

| Function | Access | Description |
|---|---|---|
| `deployPool(...)` | `onlyAdmin` | Deploys a new CrisisPool with given cap parameters. Automatically passes `usdc`, `admin`, `verifier`, and `address(this)` (factory) to the pool. Marks pool in `isPool` mapping. Increments `poolCount`. Emits `PoolDeployed`. Returns pool address. |

### Validation Rules

- `maxPerClaim` must be > 0
- `maxPerNGOPerDay` must be >= `maxPerClaim` (otherwise no single claim could ever succeed)
- `maxPerNGOPool` must be >= `maxPerNGOPerDay`
- Cannot add `address(0)` as NGO
- Cannot add an already-verified NGO address
- Cannot revoke an NGO that isn't currently verified

### Events

```solidity
// NGO registry events
event NGOApproved(address indexed ngo);
event NGORevoked(address indexed ngo);

// Pool deployment event — metadata emitted here, NOT stored in contract
event PoolDeployed(
    address indexed poolAddress,
    uint256 maxPerClaim,
    uint256 maxPerNGOPerDay,
    uint256 maxPerNGOPool
);
```

### Security Invariants

1. Only admin can modify the NGO whitelist or deploy pools
2. `isVerified()` is a pure read — no gas cost for callers
3. Revoking an NGO immediately blocks all future `releaseFunds()` calls in any pool (CrisisPool checks factory at release-time)
4. Factory passes its own address, `admin`, `verifier`, and `usdc` to every pool — pools cannot be deployed with arbitrary role addresses
5. Admin cannot renounce or transfer admin role (single owner, no transfer for MVP)

---

## 6. Contract #2 — CrisisPool.sol

### Purpose
The core escrow contract. Each crisis has one CrisisPool instance. Holds donated USDC, enforces spending caps, and releases funds immediately to verified NGOs.

**Pool ID = the contract's own address.** No separate ID needed — the backend stores this address in its database to link all off-chain metadata (name, region, description).

---

### 6.1 State

#### Immutable (set in constructor, never changeable)

Every one of these is used in a `require` check, a `transfer`, or an access control modifier.

```solidity
uint256 public immutable maxPerClaim;
uint256 public immutable maxPerNGOPerDay;
uint256 public immutable maxPerNGOPool;
IERC20 public immutable usdc;
address public immutable factory;             // for isVerified() checks
address public immutable admin;
address public immutable verifier;
```

#### Mutable

Every one of these is read or written in at least one function's logic.

```solidity
bool public donationsPaused;
uint256 public totalDonated;
uint256 public totalReleased;

// NGO assignment
mapping(address => bool) public assignedNGOs;

// Spending tracking
mapping(address => uint256) public totalClaimedByNGO;
mapping(address => uint256) public dailyClaimedByNGO;
mapping(address => uint256) public lastClaimDayByNGO;

// Release tracking (prevents duplicate proofId usage)
mapping(bytes32 => bool) public usedProofIds;
```

---

### 6.2 Constructor

```solidity
constructor(
    uint256 _maxPerClaim,
    uint256 _maxPerNGOPerDay,
    uint256 _maxPerNGOPool,
    address _usdc,
    address _factory,
    address _admin,
    address _verifier
)
```

Called only by `PoolFactory`. All parameters become immutable.

---

### 6.3 Functions

#### `donate(uint256 amount)`

| Property | Value |
|---|---|
| **Access** | Anyone |
| **Guard** | `whenDonationsNotPaused` |
| **Preconditions** | `amount > 0`, donations not paused, donor has approved USDC |
| **Action** | Calls `usdc.transferFrom(msg.sender, address(this), amount)`. Increments `totalDonated`. |
| **Event** | `DonationReceived(msg.sender, amount)` |

**Flow:**
```
Donor calls USDC.approve(poolAddress, amount)  ← separate tx on USDC contract
Donor calls pool.donate(amount)
  → pool calls USDC.transferFrom(donor, pool, amount)
  → pool.totalDonated += amount
  → emit DonationReceived
```

---

#### `assignNGO(address ngo)`

| Property | Value |
|---|---|
| **Access** | `onlyAdmin` |
| **Preconditions** | `IPoolFactory(factory).isVerified(ngo) == true`, not already assigned |
| **Action** | Sets `assignedNGOs[ngo] = true` |
| **Event** | `NGOAssigned(ngo)` |

---

#### `releaseFunds(address ngo, uint256 amount, bytes32 proofId)`

This is the most critical function. Called by the backend verifier wallet after proof passes Layer 1 verification. **Funds are transferred immediately in the same transaction — no timelock or challenge period.**

| Property | Value |
|---|---|
| **Access** | `onlyVerifier` |

**Precondition checks (all must pass, otherwise revert):**

| # | Check | Revert Message |
|---|---|---|
| 1 | `IPoolFactory(factory).isVerified(ngo)` | "NGO not verified" |
| 2 | `assignedNGOs[ngo] == true` | "NGO not assigned to this pool" |
| 3 | `amount > 0` | "Amount must be greater than zero" |
| 4 | `amount <= maxPerClaim` | "Exceeds max per claim" |
| 5 | `getDailyClaimedAmount(ngo) + amount <= maxPerNGOPerDay` | "Exceeds daily limit for NGO" |
| 6 | `totalClaimedByNGO[ngo] + amount <= maxPerNGOPool` | "Exceeds total pool limit for NGO" |
| 7 | `usdc.balanceOf(address(this)) >= amount` | "Insufficient pool balance" |
| 8 | `usedProofIds[proofId] == false` | "Proof already used" |

**Daily claim tracking logic:**
```solidity
function _getCurrentDay() internal view returns (uint256) {
    return block.timestamp / 86400;  // UTC day number
}

function getDailyClaimedAmount(address ngo) public view returns (uint256) {
    if (lastClaimDayByNGO[ngo] != _getCurrentDay()) {
        return 0;  // new day, counter reset
    }
    return dailyClaimedByNGO[ngo];
}
```

**Action (checks-effects-interactions pattern):**
- Mark `usedProofIds[proofId] = true`
- Update daily tracking: if new day, reset `dailyClaimedByNGO[ngo]` to 0 first
- `dailyClaimedByNGO[ngo] += amount`
- `lastClaimDayByNGO[ngo] = _getCurrentDay()`
- `totalClaimedByNGO[ngo] += amount`
- `totalReleased += amount`
- `usdc.transfer(ngo, amount)` ← **immediate transfer**

**Event:** `FundsReleased(ngo, amount, proofId)`

---

#### `pauseDonations()` / `resumeDonations()`

| Property | Value |
|---|---|
| **Access** | `onlyAdmin` |
| **Action** | Toggles `donationsPaused`. Does NOT affect existing funds or future releases. |
| **Events** | `DonationsPaused()` / `DonationsResumed()` |

---

#### View Functions

| Function | Returns | Description |
|---|---|---|
| `getPoolBalance()` | `uint256` | `usdc.balanceOf(address(this))` — actual USDC held |
| `getDailyClaimedAmount(address ngo)` | `uint256` | Current day's claimed amount (resets at UTC midnight) |

> All other state variables (`totalDonated`, `totalReleased`, `maxPerClaim`, `totalClaimedByNGO[ngo]`, `assignedNGOs[ngo]`, `usedProofIds[id]`, etc.) are `public` and have auto-generated getter functions. No additional view functions needed.

---

### 6.4 Events

```solidity
event DonationReceived(address indexed donor, uint256 amount);
event NGOAssigned(address indexed ngo);
event FundsReleased(
    address indexed ngo,
    uint256 amount,
    bytes32 proofId
);
event DonationsPaused();
event DonationsResumed();
```

---

### 6.5 Access Control Summary

| Function | Admin | Verifier | Anyone |
|---|---|---|---|
| `donate()` | | | ✅ (when not paused) |
| `assignNGO()` | ✅ | | |
| `releaseFunds()` | | ✅ | |
| `pauseDonations()` | ✅ | | |
| `resumeDonations()` | ✅ | | |
| All view/public state | | | ✅ |

---

## 7. Security Invariants

These are guarantees that must **always** hold true, regardless of any combination of inputs or state. Any violation is a critical bug.

| # | Invariant |
|---|---|
| 1 | **Funds only exit via `releaseFunds()`** — there is no other function that transfers USDC out of a CrisisPool. No withdrawal, no closePool, no emergency drain. |
| 2 | **`releaseFunds()` only sends to verified, assigned NGO addresses** — the recipient is validated at release-time. |
| 3 | **A proofId can only be used once** — `usedProofIds` mapping prevents duplicate releases for the same proof. |
| 4 | **Caps are immutable** — `maxPerClaim`, `maxPerNGOPerDay`, `maxPerNGOPool` cannot change after constructor. |
| 5 | **Daily limits reset correctly** — `dailyClaimedByNGO` resets when `_getCurrentDay()` changes. |
| 6 | **Only registered+assigned NGOs receive funds** — both `factory.isVerified()` AND `assignedNGOs[ngo]` must be true at release-time. |
| 7 | **`totalDonated - totalReleased` approximates `usdc.balanceOf(pool)`** — accounting stays consistent (minor variance possible from direct USDC transfers to pool address). |

---

## 8. Attack Vectors & Mitigations

| Attack | Mitigation |
|---|---|
| **Fake NGO drains pool** | Must pass admin review → whitelist in factory → be assigned to specific pool by admin. Three gates before any release is possible. |
| **Compromised verifier (backend) initiates fraudulent releases** | Caps limit damage: `maxPerClaim` per transaction, `maxPerNGOPerDay` per day, `maxPerNGOPool` total. Funds can only go to admin-whitelisted NGOs. Verifier cannot modify NGO whitelist or assignments. |
| **Compromised admin** | Admin cannot release funds — only the verifier can. Admin can only pause donations and manage NGO assignments. Worst case is blocking legitimate operations, not theft. |
| **Admin + Verifier both compromised** | Caps still hold (immutable). Funds can only go to whitelisted NGOs. Attacker would need to also control an NGO wallet. Damage is capped per claim/day/pool. |
| **Reentrancy on releaseFunds** | All state updates (usedProofIds, dailyClaimedByNGO, totalClaimedByNGO, totalReleased) happen BEFORE calling `usdc.transfer()` (checks-effects-interactions pattern). USDC itself is not a reentrant token, but defense-in-depth. |
| **Daily limit bypass via timestamp manipulation** | Polygon validators have limited timestamp control (~1-2 seconds). Day boundary is 86400 seconds — manipulation is irrelevant at this granularity. |
| **Sybil NGO accounts** | Each NGO wallet must pass admin document review. Creating fake legal entities is expensive and slow. Per-NGO caps limit damage per identity. |
| **Direct USDC transfer to pool (bypassing donate())** | Doesn't break anything — `totalDonated` won't track it but `getPoolBalance()` uses `usdc.balanceOf()` which reflects actual balance. Releases still work correctly. |
| **Flash loan attack** | Not applicable — no price oracles, no swaps, no leveraged positions. Pool is pure escrow. |
| **Duplicate proof submission** | `usedProofIds[proofId]` mapping prevents any proofId from being used twice. |

---

## 9. Gas Optimization Notes

| Optimization | Detail |
|---|---|
| **Immutable variables** | All caps and addresses stored as `immutable` — read from bytecode, not storage. Saves ~2100 gas per read vs storage. |
| **No strings stored** | All metadata (name, region, description) lives off-chain. Zero string storage = significant gas savings on deployment. |
| **No arrays stored** | No `_allPools[]`, `_assignedNGOList[]`. Lists are reconstructed from events by the backend. Saves gas on every write. |
| **proofId not stored in struct** | Only a boolean `usedProofIds` mapping is needed — no struct overhead. |
| **No pending release struct** | Immediate transfer eliminates the need for a `PendingRelease` struct and `pendingReleases` mapping. Saves ~4 storage slots per release. |
| **Single-transaction release** | `releaseFunds()` validates + transfers in one tx. No second `executeRelease()` transaction needed — saves gas for the caller. |
| **Minimal storage writes in donate()** | Only increments `totalDonated` (one SSTORE = ~20k gas). |
| **Lazy daily reset** | `dailyClaimedByNGO` resets on next access when `lastClaimDayByNGO` differs from current day. No cron jobs, no batch resets. |
| **Merged registry** | NGO whitelist lives in the factory contract. One fewer contract deployment. Pools call `factory.isVerified()` — single cross-contract call. |

---

## 10. Deployment Plan

### 10.1 Testnet (Polygon Amoy)

1. Deploy a MockUSDC ERC20 contract with `mint()` function for testing
2. Deploy `PoolFactory` with testnet admin wallet + verifier wallet + MockUSDC address
3. Add test NGO wallets via `factory.addVerifiedNGO()`
4. Create a test pool via `factory.deployPool(...)`
5. Mint test USDC to test donor wallet
6. Run full flow: donate → assignNGO → releaseFunds (immediate transfer)
7. Test all revert cases (cap exceeded, unverified NGO, duplicate proofId, insufficient balance, etc.)

### 10.2 Mainnet (Polygon PoS)

1. Deploy `PoolFactory` with hardware wallet as admin + backend verifier address + USDC mainnet address
2. Verify contract on Polygonscan
3. Add verified NGO wallets via `factory.addVerifiedNGO()`
4. Create first crisis pool via `factory.deployPool(...)`
5. Backend configured with verifier wallet private key
6. Monitor events via backend listener

---

## 11. Testing Checklist

### PoolFactory — NGO Registry
- [ ] Admin can add an NGO
- [ ] Admin can revoke an NGO
- [ ] Non-admin cannot add or revoke
- [ ] Cannot add zero address
- [ ] Cannot add already-verified address
- [ ] Cannot revoke non-verified address
- [ ] `isVerified()` returns correct state after add/revoke

### PoolFactory — Pool Deployment
- [ ] Admin can deploy a pool
- [ ] Non-admin cannot deploy
- [ ] Deployed pool has correct immutable parameters
- [ ] Pool is tracked in `isPool` mapping
- [ ] `poolCount` increments correctly
- [ ] Rejects invalid parameters (zero caps, etc.)
- [ ] `PoolDeployed` event emitted with correct data

### CrisisPool — Donations
- [ ] Donor can donate USDC after approval
- [ ] Donation fails without USDC approval
- [ ] Donation fails when paused
- [ ] Donation succeeds when resumed
- [ ] `totalDonated` increments correctly
- [ ] `DonationReceived` event emitted with correct data

### CrisisPool — NGO Assignment
- [ ] Admin can assign a verified NGO
- [ ] Cannot assign unverified NGO
- [ ] Cannot assign already-assigned NGO
- [ ] Non-admin cannot assign

### CrisisPool — Release Flow
- [ ] Verifier can release funds for assigned, verified NGO
- [ ] Cannot release for unverified NGO
- [ ] Cannot release for unassigned NGO
- [ ] Cannot release above `maxPerClaim`
- [ ] Cannot release above `maxPerNGOPerDay`
- [ ] Cannot release above `maxPerNGOPool`
- [ ] Cannot release with insufficient pool balance
- [ ] Cannot reuse a proofId (duplicate proof rejection)
- [ ] USDC transferred to correct NGO address immediately
- [ ] `dailyClaimedByNGO` and `totalClaimedByNGO` updated correctly
- [ ] `totalReleased` incremented
- [ ] `FundsReleased` event emitted with correct data

### CrisisPool — Daily Reset
- [ ] Daily claimed resets when a new UTC day begins
- [ ] Multiple claims within same day accumulate correctly
- [ ] Claims on a new day start from zero

### CrisisPool — Edge Cases
- [ ] Pool with zero balance rejects `releaseFunds()`
- [ ] NGO revoked from factory after pool assignment → `releaseFunds()` reverts
- [ ] Multiple releases for same NGO — all caps checked cumulatively
- [ ] Direct USDC transfer to pool doesn't break accounting

---

## 12. File Structure

```
contracts/
├── PoolFactory.sol
├── CrisisPool.sol
├── interfaces/
│   └── IPoolFactory.sol
├── mocks/
│   └── MockUSDC.sol
test/
├── PoolFactory.test.sol
├── CrisisPool.test.sol
├── CrisisPool.release.test.sol
├── CrisisPool.caps.test.sol
└── integration.test.sol
script/
├── DeployTestnet.s.sol
├── DeployMainnet.s.sol
foundry.toml
```

---

*Document Version: 3.0*
*Last Updated: May 6, 2026*
*Parent Document: [PRD.md](./PRD.md)*
*Changelog v3.0: Removed timelock/challenge period entirely. Merged `initiateRelease()` + `executeRelease()` into single `releaseFunds()` that transfers USDC immediately. Removed `cancelRelease()` function. Removed `PendingRelease` struct and `pendingReleases` mapping. Removed `timelockDuration` parameter from pool deployment. Added `usedProofIds` mapping to prevent duplicate proof submissions. Updated file structure to Foundry conventions (.sol tests, .s.sol scripts).*
