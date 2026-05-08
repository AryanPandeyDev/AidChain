import { useEffect } from "react";
import { useAuth } from "../auth/AuthProvider";

/**
 * Returns the correct dashboard hash based on user role.
 */
export function getDashboardHref(role) {
  if (role === "ADMIN") return "#/admin";
  if (role === "NGO") return "#/ngo/dashboard";
  return "#/dashboard";
}

/**
 * Route guard that checks authentication and optionally role.
 *
 * Usage:
 *   <RouteGuard>              — requires sign-in (any role)
 *   <RouteGuard role="ADMIN"> — requires sign-in + ADMIN role
 *   <RouteGuard role="NGO">   — requires sign-in + NGO role
 */
export default function RouteGuard({ children, role }) {
  const { isSignedIn, isLoaded, role: userRole } = useAuth();

  // Still loading auth state — show spinner
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-on-surface-variant text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not signed in — redirect to sign-in
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 bg-primary-fixed/40 rounded-2xl flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-primary text-3xl">lock</span>
          </div>
          <h2 className="text-2xl font-extrabold text-primary mb-2">Sign In Required</h2>
          <p className="text-on-surface-variant text-sm mb-6">
            You need to sign in to access this page.
          </p>
          <a
            href="#/signin"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-lg">login</span>
            Sign In
          </a>
        </div>
      </div>
    );
  }

  // Signed in but role not yet loaded from provision — wait for it
  if (role && !userRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-on-surface-variant text-sm">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // Signed in but wrong role — show access denied
  if (role && userRole && userRole !== role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 bg-error-container rounded-2xl flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-error text-3xl">shield</span>
          </div>
          <h2 className="text-2xl font-extrabold text-primary mb-2">Access Denied</h2>
          <p className="text-on-surface-variant text-sm mb-6">
            You don't have permission to access this page.
            {role === "ADMIN" && " This area is restricted to platform administrators."}
            {role === "NGO" && " This area is restricted to verified NGOs."}
          </p>
          <a
            href={getDashboardHref(userRole)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-lg">home</span>
            Go to My Dashboard
          </a>
        </div>
      </div>
    );
  }

  return children;
}

/**
 * Inverse guard: redirects signed-in users away from auth pages (sign-in, register).
 * Shows the children (auth form) only if NOT signed in.
 */
export function RedirectIfSignedIn({ children }) {
  const { isSignedIn, isLoaded, role } = useAuth();

  useEffect(() => {
    // Only redirect once role is known (provision completed).
    // Without this guard, role=null → getDashboardHref returns #/dashboard (donor)
    // which races with Register's own redirect to #/ngo/apply.
    if (isLoaded && isSignedIn && role) {
      window.location.hash = getDashboardHref(role);
    }
  }, [isLoaded, isSignedIn, role]);

  // Loading — show spinner while checking
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Signed in but role not yet loaded — wait
  if (isSignedIn && !role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Signed in with role — the useEffect will redirect, show nothing
  if (isSignedIn) {
    return null;
  }

  // Not signed in — show the auth form
  return children;
}
