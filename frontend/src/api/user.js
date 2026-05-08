import { apiFetch } from "./client";

/**
 * Fetch the authenticated user's profile from the backend.
 * This is the source of truth for role, wallet, trust score, etc.
 */
export async function fetchMe() {
  return apiFetch("/api/me");
}
