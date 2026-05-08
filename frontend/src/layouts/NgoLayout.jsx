import { useClerk } from "@clerk/clerk-react";
import { useAuth } from "../auth/AuthProvider";
import { NGO_NAV } from "../constants/nav";
import WalletButton from "../components/WalletButton";

/**
 * Shared layout for all NGO pages.
 *
 * @param {string} activeId - The nav item ID to highlight (e.g. "dashboard", "pools")
 * @param {React.ReactNode} children - Page content
 */
export default function NgoLayout({ activeId, children }) {
  const { signOut } = useClerk();
  const { user } = useAuth();
  const name = user?.firstName || "My NGO";

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="fixed left-0 top-0 h-screen w-[220px] bg-primary-container flex flex-col z-50">
        {/* Brand */}
        <a href="#/" className="px-5 pt-6 pb-6 block hover:opacity-80 transition-opacity">
          <div className="text-2xl font-extrabold text-on-primary">AidChain</div>
          <div className="text-xs text-on-primary-container mt-0.5">NGO Portal</div>
        </a>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {NGO_NAV.map((item) => {
            const isActive = item.id === activeId;
            return (
              <a
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-primary-container hover:bg-primary/20"
                }`}
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Submit Proof CTA */}
        <div className="px-3 mb-4">
          <a
            href="#/ngo/submit-proof"
            className="flex items-center justify-center gap-2 py-3 bg-secondary text-on-secondary rounded-full font-bold text-sm active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Submit Proof
          </a>
        </div>

        {/* Bottom actions */}
        <div className="px-3 space-y-0.5 mb-2">
          <WalletButton variant="sidebar" />
          <button
            onClick={async () => { await signOut(); window.location.hash = "#/"; }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-on-primary-container hover:bg-primary/20 transition-all w-full text-left"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            Sign Out
          </button>
        </div>

        {/* User */}
        <div className="px-4 pb-5 border-t border-on-primary-container/20 pt-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">account_balance</span>
            </div>
            <div>
              <div className="text-sm font-bold text-on-primary leading-tight">{name}</div>
              <div className="text-xs text-on-primary-container">NGO</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-[220px] flex-1 p-8 pb-16">
        {children}
      </main>
    </div>
  );
}
