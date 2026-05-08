import { useEffect, useState } from "react";
import { ensureAdminPassword } from "../utils/adminAuth";

export default function AdminPasswordGuard({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      ensureAdminPassword();
      setReady(true);
    } catch (err) {
      setError(err.message || "Admin password is required.");
    }
  }, []);

  if (ready) {
    return children;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-primary-fixed/40 rounded-2xl flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-primary text-3xl">key</span>
        </div>
        <h2 className="text-2xl font-extrabold text-primary mb-2">Admin Password Required</h2>
        <p className="text-on-surface-variant text-sm mb-6">
          {error || "Enter the shared admin password to access this area."}
        </p>
        <button
          onClick={() => {
            try {
              ensureAdminPassword();
              setReady(true);
              setError("");
            } catch (err) {
              setError(err.message || "Admin password is required.");
            }
          }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-lg">vpn_key</span>
          Enter Password
        </button>
      </div>
    </div>
  );
}
