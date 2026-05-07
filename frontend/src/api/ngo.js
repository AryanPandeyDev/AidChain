import { apiFetch } from "./client";

// ── NGO Application ───────────────────────────────────────

export async function submitApplication(body) {
  return apiFetch("/api/ngo/apply", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchApplicationStatus() {
  return apiFetch("/api/ngo/application/status");
}

// ── NGO Dashboard ─────────────────────────────────────────

export async function fetchNgoDashboard() {
  return apiFetch("/api/ngo/dashboard");
}

// ── Proofs ────────────────────────────────────────────────

export async function submitProof(body) {
  return apiFetch("/api/proofs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchMyProofs() {
  return apiFetch("/api/proofs/my");
}

export async function fetchProof(id) {
  return apiFetch(`/api/proofs/${id}`);
}

// ── Trust ─────────────────────────────────────────────────

export async function fetchMyTrust() {
  return apiFetch("/api/trust/my");
}

// ── Assignment Requests ───────────────────────────────────

export async function requestPoolAssignment(poolId, body) {
  return apiFetch(`/api/ngo/pools/${poolId}/request-assignment`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchMyAssignmentRequests() {
  return apiFetch("/api/ngo/assignment-requests");
}

// ── Wallet ────────────────────────────────────────────────

export async function connectWallet(body) {
  return apiFetch("/api/auth/connect-wallet", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
