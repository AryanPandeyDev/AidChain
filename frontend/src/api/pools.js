import { apiFetch } from "./client";

/**
 * Fetch all active crisis pools from the backend.
 * Errors propagate to the caller — no silent fallback to fake data.
 */
export async function fetchPools() {
  const data = await apiFetch("/api/pools");
  const pools = Array.isArray(data) ? data : data.pools || [];
  return pools.map(mapPool);
}

/**
 * Fetch a single pool by ID with full detail (NGOs, on-chain balance).
 */
export async function fetchPool(id) {
  const data = await apiFetch(`/api/pools/${id}`);
  return mapPoolDetail(data);
}

function mapPool(p) {
  const target = parseFloat(p.target_amount || 0);
  const balance = p.pool_balance != null ? parseFloat(p.pool_balance) : null;
  // Use on-chain totalDonated as the authoritative donated amount.
  // Falls back to 0 if the backend doesn't return it (e.g. blockchain offline).
  const donated = parseFloat(p.donated_amount || 0);
  const pct = target > 0 ? Math.min(100, Math.round((donated / target) * 100)) : 0;

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
    tag: p.tag || null,
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
      organizationName: n.organization_name,
    })),
  };
}
