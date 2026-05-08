# AidChain Smart Contracts

Foundry project for AidChain's on-chain pool and fund-release layer.

## Contracts

| Contract | Purpose |
|---|---|
| `src/PoolFactory.sol` | Global admin/verifier/USDC configuration, NGO whitelist, and CrisisPool deployment |
| `src/CrisisPool.sol` | Per-crisis USDC escrow, NGO assignment, donation pause/resume, immutable caps, immediate `releaseFunds` |
| `src/mocks/MockUSDC.sol` | Local/test token for Anvil and testnet-style development |
| `src/interfaces/IPoolFactory.sol` | Interface used by CrisisPool to check NGO verification |

## Tooling

- Solidity with Foundry/Forge
- Tests in `test/*.t.sol`
- Deployment and operation scripts in `script/*.s.sol`

## Common Commands

```bash
forge build
forge test
forge fmt
anvil
```

## Local Flow

1. Deploy `MockUSDC`.
2. Deploy `PoolFactory` with admin, verifier, and USDC addresses.
3. Add a verified NGO through `PoolFactory.addVerifiedNGO`.
4. Deploy a `CrisisPool` through the factory.
5. Mint/approve USDC and donate to the pool.
6. Assign NGO to the pool.
7. Call `releaseFunds` from the verifier wallet after backend proof verification.

## Backend Integration

The Go backend uses go-ethereum wrappers in `backend/blockchain` to call:

- `PoolFactory.addVerifiedNGO`
- `PoolFactory.deployPool`
- `CrisisPool.assignNGO`
- `CrisisPool.releaseFunds`
- `CrisisPool.pauseDonations`
- `CrisisPool.resumeDonations`
- `CrisisPool.getPoolBalance`
- `CrisisPool.donationsPaused`

The backend event listener syncs donation, release, assignment, and pause/resume events into PostgreSQL.
