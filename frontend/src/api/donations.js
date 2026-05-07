import { apiFetch } from "./client";

// ── Donations ─────────────────────────────────────────────

export async function fetchMyDonations() {
  const data = await apiFetch("/api/donations/my");
  return data.donations || [];
}

export async function fetchPoolDonations(poolId) {
  const data = await apiFetch(`/api/donations/pool/${poolId}`);
  return data.donations || [];
}
