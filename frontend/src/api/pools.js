import { apiFetch } from "./client";

/**
 * Fetch all active crisis pools from the backend.
 * Falls back to mock data when the backend is unreachable.
 */
export async function fetchPools() {
  try {
    const data = await apiFetch("/api/pools");
    const pools = Array.isArray(data) ? data : data.pools || [];
    return pools.map(mapPool);
  } catch {
    console.warn("[AidChain] Backend unreachable, using fallback pool data.");
    return FALLBACK_POOLS;
  }
}

/**
 * Fetch a single pool by ID with full detail (NGOs, on-chain balance).
 */
export async function fetchPool(id) {
  try {
    const data = await apiFetch(`/api/pools/${id}`);
    return mapPoolDetail(data);
  } catch {
    return FALLBACK_POOLS.find((p) => p.id === id) || FALLBACK_POOLS[0];
  }
}

function mapPool(p) {
  const target = parseFloat(p.target_amount || 0);
  const balance = parseFloat(p.pool_balance || 0);
  const donated = target - balance || parseFloat(p.funded_amount || 0);
  const pct = target > 0 ? Math.round((donated / target) * 100) : 0;

  return {
    id: p.id,
    name: p.name || "Untitled Pool",
    description: p.description || "",
    region: p.region || "",
    targetAmount: target,
    fundedAmount: donated,
    poolBalance: balance,
    percentFunded: pct,
    contractAddress: p.contract_address || "",
    status: p.status || "ACTIVE",
    donationsPaused: p.donations_paused || false,
    createdAt: p.created_at,
  };
}

function mapPoolDetail(p) {
  return {
    ...mapPool(p),
    regionLat: p.region_lat,
    regionLng: p.region_lng,
    regionRadiusKm: p.region_radius_km,
    maxPerClaim: p.max_per_claim,
    maxPerNGOPerDay: p.max_per_ngo_per_day,
    maxPerNGOPool: p.max_per_ngo_pool,
    ngos: (p.ngos || []).map((n) => ({
      ngoUserId: n.ngo_user_id,
      walletAddress: n.wallet_address,
      trustScore: n.trust_score,
    })),
  };
}

const FALLBACK_POOLS = [
  {
    id: "pool-1", name: "Sudan Emergency Relief",
    description: "Providing immediate food security and medical supplies to displaced families in the Darfur region.",
    region: "Sudan, Darfur", targetAmount: 200000, fundedAmount: 150000, poolBalance: 50000,
    percentFunded: 75, contractAddress: "0x7a...F92", status: "ACTIVE", donationsPaused: false,
    tag: "EMERGENCY",
  },
  {
    id: "pool-2", name: "Horn of Africa Drought",
    description: "Implementing long-term solar-powered irrigation systems to combat recurring famine cycles.",
    region: "Horn of Africa", targetAmount: 100000, fundedAmount: 40000, poolBalance: 60000,
    percentFunded: 40, contractAddress: "0x3b...A14", status: "ACTIVE", donationsPaused: false,
    tag: "SUSTAINABILITY",
  },
  {
    id: "pool-3", name: "Refugee Education Fund",
    description: "Supporting digital literacy and primary schooling for displaced youth in border camps.",
    region: "East Africa", targetAmount: 20000, fundedAmount: 18000, poolBalance: 2000,
    percentFunded: 90, contractAddress: "0x1c...D87", status: "ACTIVE", donationsPaused: false,
    tag: "EDUCATION",
  },
];
