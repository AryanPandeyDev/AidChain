# ==============================================================================
# AidChain Smart Contracts — Makefile
# ==============================================================================
#
# All forge scripts for interacting with PoolFactory and CrisisPool contracts.
#
# SETUP:
#   1. Copy .env.example to .env and fill in your values
#   2. Run `make anvil` in one terminal to start a local node
#   3. Run `make full-flow` to test the entire happy path
#
# NOTE: Set FORGE to your forge binary path if not in PATH.
# ==============================================================================

# --- Tooling ---
FORGE ?= forge
RPC_URL ?= http://127.0.0.1:8545

# --- Anvil default keys (for local testing only!) ---
ANVIL_ADMIN_PK    ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_VERIFIER_PK ?= 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
ANVIL_DONOR_PK    ?= 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
ANVIL_ADMIN       ?= 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
ANVIL_VERIFIER    ?= 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
ANVIL_DONOR       ?= 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
ANVIL_NGO         ?= 0x90F79bf6EB2c4f870365E785982E1f101E93b906

# --- Configurable addresses (override via env or CLI) ---
ADMIN_PK    ?= $(ANVIL_ADMIN_PK)
VERIFIER_PK ?= $(ANVIL_VERIFIER_PK)
DONOR_PK    ?= $(ANVIL_DONOR_PK)

# Contracts (set these after deployment)
FACTORY ?=
POOL    ?=
USDC    ?=
NGO     ?=

# Pool caps (6-decimal USDC amounts)
MAX_PER_CLAIM    ?= 100000000
MAX_PER_NGO_DAY  ?= 500000000
MAX_PER_NGO_POOL ?= 5000000000

# Amounts
AMOUNT   ?= 1000000000
PROOF_ID ?= 0x0000000000000000000000000000000000000000000000000000000000000001

# Anvil state file (for persisting seeded data)
ANVIL_STATE_FILE ?= anvil-state.json

# ==============================================================================
# Help
# ==============================================================================

.PHONY: help
help: ## Show this help message
	@echo ""
	@echo "AidChain Smart Contracts — Available Commands"
	@echo "=============================================="
	@echo ""
	@echo "  SETUP & BUILD"
	@echo "  --------------------"
	@echo "  make build          Build contracts"
	@echo "  make test           Run all tests"
	@echo "  make anvil          Start fresh Anvil node"
	@echo "  make anvil-load     Start Anvil with saved state"
	@echo ""
	@echo "  SEED DATA"
	@echo "  --------------------"
	@echo "  make seed           Deploy + populate all test data + dump state"
	@echo "  make dump-state     Dump current Anvil state to file"
	@echo ""
	@echo "  DEPLOYMENT"
	@echo "  --------------------"
	@echo "  make deploy-usdc    Deploy MockUSDC token"
	@echo "  make deploy-factory Deploy PoolFactory"
	@echo "  make deploy-pool    Deploy a CrisisPool"
	@echo "  make full-flow      Run complete happy-path demo"
	@echo ""
	@echo "  NGO MANAGEMENT (admin)"
	@echo "  --------------------"
	@echo "  make add-ngo        Whitelist an NGO"
	@echo "  make revoke-ngo     Remove NGO from whitelist"
	@echo "  make assign-ngo     Assign NGO to a pool"
	@echo "  make check-ngo      Check if NGO is verified"
	@echo ""
	@echo "  DONATIONS"
	@echo "  --------------------"
	@echo "  make mint-usdc      Mint MockUSDC (testnet)"
	@echo "  make approve-usdc   Approve pool to spend USDC"
	@echo "  make donate         Donate USDC to a pool"
	@echo "  make pause          Pause donations on a pool"
	@echo "  make resume         Resume donations on a pool"
	@echo ""
	@echo "  FUND RELEASE (verifier)"
	@echo "  --------------------"
	@echo "  make release        Release funds to an NGO"
	@echo ""
	@echo "  QUERIES (read-only)"
	@echo "  --------------------"
	@echo "  make query-factory  Query PoolFactory state"
	@echo "  make query-pool     Query CrisisPool state"
	@echo "  make check-proof    Check if a proofId was used"
	@echo ""

# ==============================================================================
# Build & Test
# ==============================================================================

.PHONY: build
build: ## Build all contracts
	$(FORGE) build

.PHONY: test
test: ## Run all Forge tests
	$(FORGE) test -vvv

.PHONY: anvil
anvil: ## Start fresh Anvil node
	anvil

.PHONY: anvil-load
anvil-load: ## Start Anvil with previously saved state (from make seed / make dump-state)
	anvil --load-state $(ANVIL_STATE_FILE)

# ==============================================================================
# Seed Data & State Persistence
# ==============================================================================

.PHONY: seed
seed: ## Deploy all contracts, populate test data, save addresses + dump Anvil state
	@echo "=== Running SeedData script ==="
	$(FORGE) script script/SeedData.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(ANVIL_ADMIN_PK)
	@echo ""
	@echo "=== Dumping Anvil state to $(ANVIL_STATE_FILE) ==="
	powershell -ExecutionPolicy Bypass -File script/dump-anvil-state.ps1 $(ANVIL_STATE_FILE) $(RPC_URL)
	@echo "Addresses saved to seed-data.json"
	@echo ""
	@echo "To restart Anvil with this state: make anvil-load"

.PHONY: dump-state
dump-state: ## Dump current Anvil state to file (without re-seeding)
	powershell -ExecutionPolicy Bypass -File script/dump-anvil-state.ps1 $(ANVIL_STATE_FILE) $(RPC_URL)

# ==============================================================================
# Deployment Scripts
# ==============================================================================

.PHONY: deploy-usdc
deploy-usdc: ## Deploy MockUSDC token
	$(FORGE) script script/DeployMockUSDC.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(ADMIN_PK)

.PHONY: deploy-factory
deploy-factory: ## Deploy PoolFactory (needs ADMIN, VERIFIER, USDC env vars)
	ADMIN=$(ANVIL_ADMIN) VERIFIER=$(ANVIL_VERIFIER) USDC=$(USDC) \
	$(FORGE) script script/DeployPoolFactory.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(ADMIN_PK)

.PHONY: deploy-pool
deploy-pool: ## Deploy a CrisisPool via factory (needs FACTORY, caps)
	FACTORY=$(FACTORY) \
	MAX_PER_CLAIM=$(MAX_PER_CLAIM) \
	MAX_PER_NGO_DAY=$(MAX_PER_NGO_DAY) \
	MAX_PER_NGO_POOL=$(MAX_PER_NGO_POOL) \
	$(FORGE) script script/DeployPool.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(ADMIN_PK)

.PHONY: full-flow
full-flow: ## Run full end-to-end demo on Anvil (single command!)
	$(FORGE) script script/FullFlowDemo.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(ANVIL_ADMIN_PK)

# ==============================================================================
# NGO Management (Admin)
# ==============================================================================

.PHONY: add-ngo
add-ngo: ## Whitelist an NGO (needs FACTORY, NGO)
	FACTORY=$(FACTORY) NGO=$(NGO) \
	$(FORGE) script script/AddVerifiedNGO.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(ADMIN_PK)

.PHONY: revoke-ngo
revoke-ngo: ## Revoke an NGO (needs FACTORY, NGO)
	FACTORY=$(FACTORY) NGO=$(NGO) \
	$(FORGE) script script/RevokeNGO.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(ADMIN_PK)

.PHONY: assign-ngo
assign-ngo: ## Assign NGO to a pool (needs POOL, NGO)
	POOL=$(POOL) NGO=$(NGO) \
	$(FORGE) script script/AssignNGO.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(ADMIN_PK)

.PHONY: check-ngo
check-ngo: ## Check if NGO is verified (needs FACTORY, NGO)
	FACTORY=$(FACTORY) NGO=$(NGO) \
	$(FORGE) script script/CheckNGOVerified.s.sol \
		--rpc-url $(RPC_URL)

# ==============================================================================
# Donations
# ==============================================================================

.PHONY: mint-usdc
mint-usdc: ## Mint MockUSDC tokens (needs USDC, RECIPIENT, AMOUNT)
	USDC=$(USDC) RECIPIENT=$(ANVIL_DONOR) AMOUNT=$(AMOUNT) \
	$(FORGE) script script/MintMockUSDC.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(ADMIN_PK)

.PHONY: approve-usdc
approve-usdc: ## Approve pool to spend USDC (needs USDC, SPENDER=POOL, AMOUNT)
	USDC=$(USDC) SPENDER=$(POOL) AMOUNT=$(AMOUNT) \
	$(FORGE) script script/ApproveUSDC.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(DONOR_PK)

.PHONY: donate
donate: ## Donate USDC to pool (needs POOL, AMOUNT)
	POOL=$(POOL) AMOUNT=$(AMOUNT) \
	$(FORGE) script script/Donate.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(DONOR_PK)

.PHONY: pause
pause: ## Pause donations on a pool (needs POOL)
	POOL=$(POOL) \
	$(FORGE) script script/PauseDonations.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(ADMIN_PK)

.PHONY: resume
resume: ## Resume donations on a pool (needs POOL)
	POOL=$(POOL) \
	$(FORGE) script script/ResumeDonations.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(ADMIN_PK)

# ==============================================================================
# Fund Release (Verifier)
# ==============================================================================

.PHONY: release
release: ## Release funds to NGO (needs POOL, NGO, AMOUNT, PROOF_ID)
	POOL=$(POOL) NGO=$(NGO) AMOUNT=$(AMOUNT) PROOF_ID=$(PROOF_ID) \
	$(FORGE) script script/ReleaseFunds.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--private-key $(VERIFIER_PK)

# ==============================================================================
# Queries (Read-Only)
# ==============================================================================

.PHONY: query-factory
query-factory: ## Query PoolFactory state (needs FACTORY)
	FACTORY=$(FACTORY) \
	$(FORGE) script script/QueryFactory.s.sol \
		--rpc-url $(RPC_URL)

.PHONY: query-pool
query-pool: ## Query CrisisPool state (needs POOL, optional NGO)
	POOL=$(POOL) NGO=$(NGO) \
	$(FORGE) script script/QueryPool.s.sol \
		--rpc-url $(RPC_URL)

.PHONY: check-proof
check-proof: ## Check if proofId is used (needs POOL, PROOF_ID)
	POOL=$(POOL) PROOF_ID=$(PROOF_ID) \
	$(FORGE) script script/CheckProofUsed.s.sol \
		--rpc-url $(RPC_URL)
