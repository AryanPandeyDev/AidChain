import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isSignedIn, user, role } = useAuth();

  const dashboardHref = role === "ADMIN" ? "#/admin" : role === "NGO" ? "#/ngo/dashboard" : "#/dashboard";

  return (
    <nav className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-md shadow-sm shadow-primary/5">
      <div className="max-w-container-max mx-auto px-gutter py-sm flex justify-between items-center">
        {/* Logo */}
        <a href="#/" className="text-2xl font-extrabold text-primary tracking-tight">
          AidChain
        </a>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex gap-lg items-center">
          <a
            className="text-primary font-bold border-b-2 border-secondary text-base tracking-tight"
            href="#/pools"
          >
            Projects
          </a>
          <a
            className="text-on-surface-variant hover:text-secondary transition-all duration-300 text-base tracking-tight"
            href="#transparency"
          >
            Transparency
          </a>
          <a
            className="text-on-surface-variant hover:text-secondary transition-all duration-300 text-base tracking-tight"
            href="#impact"
          >
            Impact
          </a>
          <a
            className="text-on-surface-variant hover:text-secondary transition-all duration-300 text-base tracking-tight"
            href="#methodology"
          >
            Methodology
          </a>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-md">
          <a
            href="#/pools"
            className="px-md py-sm bg-secondary text-on-secondary rounded-full text-sm font-bold uppercase tracking-widest active:scale-95 transition-transform"
          >
            Donate Now
          </a>

          {isSignedIn ? (
            <a href={dashboardHref} className="hidden md:flex items-center gap-2 text-primary font-bold hover:text-secondary transition-all duration-300">
              <span className="material-symbols-outlined text-xl">account_circle</span>
              Dashboard
            </a>
          ) : (
            <a href="#/signin" className="hidden md:block text-primary font-bold hover:text-secondary transition-all duration-300">
              Sign In
            </a>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-primary"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <span className="material-symbols-outlined">
              {mobileOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-surface border-t border-outline-variant px-gutter py-md space-y-md">
          <a href="#/pools" className="block text-primary font-bold" onClick={() => setMobileOpen(false)}>Projects</a>
          <a href="#transparency" className="block text-on-surface-variant" onClick={() => setMobileOpen(false)}>Transparency</a>
          <a href="#impact" className="block text-on-surface-variant" onClick={() => setMobileOpen(false)}>Impact</a>
          {isSignedIn ? (
            <a href={dashboardHref} className="block text-primary font-bold" onClick={() => setMobileOpen(false)}>Dashboard</a>
          ) : (
            <a href="#/signin" className="block text-primary font-bold" onClick={() => setMobileOpen(false)}>Sign In</a>
          )}
        </div>
      )}
    </nav>
  );
}
