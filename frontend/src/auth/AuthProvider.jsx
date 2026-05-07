import { createContext, useContext, useEffect, useState } from "react";
import { ClerkProvider, useAuth as useClerkAuth, useUser, SignIn, SignUp } from "@clerk/clerk-react";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const AuthContext = createContext({
  user: null,
  role: null,
  dbUserId: null,
  isSignedIn: false,
  isLoaded: false,
  getToken: async () => null,
});

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Syncs the Clerk session token to window.__clerk_session_token
 * so our API client can use it without prop drilling.
 */
function TokenSync({ children }) {
  const { getToken, isSignedIn, isLoaded } = useClerkAuth();
  const { user } = useUser();
  const [role, setRole] = useState(null);
  const [dbUserId, setDbUserId] = useState(null);

  useEffect(() => {
    if (!isSignedIn) {
      window.__clerk_session_token = null;
      return;
    }

    // Keep token fresh
    const sync = async () => {
      try {
        const token = await getToken();
        window.__clerk_session_token = token;
      } catch {
        window.__clerk_session_token = null;
      }
    };
    sync();
    const interval = setInterval(sync, 50_000); // refresh before 60s expiry
    return () => clearInterval(interval);
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!user) return;
    const meta = user.publicMetadata || {};
    const existingDbId = meta.db_user_id;
    const existingRole = meta.role;

    if (existingDbId && existingRole) {
      // Already provisioned — just set local state.
      setRole(existingRole);
      setDbUserId(existingDbId);
      return;
    }

    // Not provisioned yet — call the dev endpoint to sync this user.
    const provision = async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"}/api/dev/provision`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clerk_user_id: user.id, role: user.unsafeMetadata?.role || "DONOR" }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          setRole(data.role);
          setDbUserId(data.db_user_id);
          // Reload the Clerk user so publicMetadata updates propagate.
          await user.reload();
        }
      } catch (err) {
        console.error("[AidChain] auto-provision failed:", err);
      }
    };
    provision();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      role,
      dbUserId,
      isSignedIn: !!isSignedIn,
      isLoaded: !!isLoaded,
      getToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Root auth wrapper. If Clerk key is not set, provides a mock auth
 * context so the app still works in dev without Clerk.
 */
export function AuthProvider({ children }) {
  if (!CLERK_KEY) {
    console.warn("[AidChain] VITE_CLERK_PUBLISHABLE_KEY not set — running in unauthenticated dev mode");
    return (
      <AuthContext.Provider value={{
        user: null,
        role: "DONOR",
        dbUserId: null,
        isSignedIn: false,
        isLoaded: true,
        getToken: async () => null,
      }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">
      <TokenSync>{children}</TokenSync>
    </ClerkProvider>
  );
}

export { SignIn as ClerkSignIn, SignUp as ClerkSignUp };
