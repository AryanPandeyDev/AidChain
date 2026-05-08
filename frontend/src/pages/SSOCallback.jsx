import { useEffect } from "react";
import { useAuth } from "../auth/AuthProvider";

/**
 * Handles the Clerk OAuth SSO callback redirect.
 * Clerk processes the OAuth tokens automatically.
 * We just wait for auth to resolve, then redirect based on role.
 */
export default function SSOCallback() {
  const { isSignedIn, isLoaded, role } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      // Route based on role
      if (role === "ADMIN") {
        window.location.hash = "#/admin";
      } else if (role === "NGO") {
        window.location.hash = "#/ngo/dashboard";
      } else {
        window.location.hash = "#/dashboard";
      }
    } else {
      // If auth didn't complete, redirect to sign-in
      window.location.hash = "#/signin";
    }
  }, [isSignedIn, isLoaded, role]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-on-surface-variant text-sm">Completing sign in...</p>
      </div>
    </div>
  );
}
