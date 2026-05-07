import { apiFetch } from "./client";

// ── NGO Applications ──────────────────────────────────────

export async function fetchApplications(status = "PENDING_REVIEW") {
  const data = await apiFetch(`/api/admin/ngo/applications?status=${status}`);
  return data.applications || [];
}

export async function fetchApplication(id) {
  return apiFetch(`/api/admin/ngo/applications/${id}`);
}

export async function approveApplication(id) {
  return apiFetch(`/api/admin/ngo/applications/${id}/approve`, { method: "POST" });
}

export async function rejectApplication(id, reason) {
  return apiFetch(`/api/admin/ngo/applications/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ── Pool Management ───────────────────────────────────────

export async function createPool(body) {
  return apiFetch("/api/admin/pools", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function pausePool(id) {
  return apiFetch(`/api/admin/pools/${id}/pause`, { method: "POST" });
}

export async function resumePool(id) {
  return apiFetch(`/api/admin/pools/${id}/resume`, { method: "POST" });
}

// ── Assignment Requests ───────────────────────────────────

export async function fetchPoolAssignmentRequests(poolId, status) {
  const qs = status ? `?status=${status}` : "";
  const data = await apiFetch(`/api/admin/pools/${poolId}/assignment-requests${qs}`);
  return data.requests || [];
}

export async function approveAssignment(poolId, reqId) {
  return apiFetch(`/api/admin/pools/${poolId}/assignment-requests/${reqId}/approve`, { method: "POST" });
}

export async function rejectAssignment(poolId, reqId, reason) {
  return apiFetch(`/api/admin/pools/${poolId}/assignment-requests/${reqId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
