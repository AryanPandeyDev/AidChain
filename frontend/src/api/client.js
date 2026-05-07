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
 * Retrieve the Clerk session token.
 * Uses the global Clerk instance injected by ClerkProvider.
 */
async function getSessionToken() {
  // window.__clerk_session_token is set by our AuthProvider for convenience
  if (window.__clerk_session_token) return window.__clerk_session_token;

  // Fallback: try Clerk's global
  if (window.Clerk?.session) {
    try {
      return await window.Clerk.session.getToken();
    } catch {
      return null;
    }
  }

  return null;
}

export { API_BASE };
