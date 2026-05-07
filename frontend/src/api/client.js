const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

/**
 * Central API fetch helper.
 * Automatically attaches Clerk JWT and handles JSON parsing.
 * @param {string} path - API path (e.g., "/api/pools")
 * @param {object} options - fetch options
 * @returns {Promise<any>}
 */
export async function apiFetch(path, options = {}) {
  const headers = { ...options.headers };

  // Attach Clerk session token if available
  const token = await getSessionToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Default to JSON content type for POST/PUT/PATCH
  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Retrieve the Clerk session token — always fresh.
 * Clerk's getToken() returns a cached token if still valid (>10s remaining)
 * and silently refreshes it otherwise. Never use a stale cached value.
 */
async function getSessionToken() {
  // Prefer Clerk's live session — it auto-refreshes before expiry.
  if (window.Clerk?.session) {
    try {
      return await window.Clerk.session.getToken();
    } catch {
      // fall through
    }
  }

  // Last resort: cached token set by AuthProvider (may be up to 50s old).
  return window.__clerk_session_token || null;
}

export { API_BASE };
