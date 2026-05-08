import { apiFetch } from "./client";
import { clearAdminPassword, getAdminHeaders } from "../utils/adminAuth";

async function adminFetch(path, options = {}) {
  try {
    return await apiFetch(path, {
      ...options,
      headers: {
        ...options.headers,
        ...getAdminHeaders(),
      },
    });
  } catch (err) {
    if (err.status === 401) {
      clearAdminPassword();
    }
    throw err;
  }
}

export async function fetchApplications(status = "PENDING_REVIEW") {
  const data = await adminFetch(`/api/admin/ngo/applications?status=${status}`);
  return data.applications || [];
}

export async function fetchApplication(id) {
  return adminFetch(`/api/admin/ngo/applications/${id}`);
}

export async function approveApplication(id) {
  return adminFetch(`/api/admin/ngo/applications/${id}/approve`, { method: "POST" });
}

export async function rejectApplication(id, reason) {
  return adminFetch(`/api/admin/ngo/applications/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function createPool(body) {
  return adminFetch("/api/admin/pools", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function pausePool(id) {
  return adminFetch(`/api/admin/pools/${id}/pause`, { method: "POST" });
}

export async function resumePool(id) {
  return adminFetch(`/api/admin/pools/${id}/resume`, { method: "POST" });
}

export async function fetchPoolAssignmentRequests(poolId, status) {
  const qs = status ? `?status=${status}` : "";
  const data = await adminFetch(`/api/admin/pools/${poolId}/assignment-requests${qs}`);
  return data.requests || [];
}

export async function approveAssignment(poolId, reqId) {
  return adminFetch(`/api/admin/pools/${poolId}/assignment-requests/${reqId}/approve`, { method: "POST" });
}

export async function rejectAssignment(poolId, reqId, reason) {
  return adminFetch(`/api/admin/pools/${poolId}/assignment-requests/${reqId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
