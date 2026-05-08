import { useClerk } from "@clerk/clerk-react";
import { useAuth } from "../auth/AuthProvider";
import { ADMIN_NAV } from "../constants/nav";
import { clearAdminPassword } from "../utils/adminAuth";

/**
 * Shared layout for all admin pages.
 * Renders the admin sidebar + main content area.
 *
 * @param {string} activeId - The nav item ID to highlight (e.g. "admin-dash", "ngo-apps", "pools")
 * @param {React.ReactNode} children - Page content
 */
export default function AdminLayout({ activeId, children }) {
  const { signOut } = useClerk();
  const { user } = useAuth();
  const name = user?.firstName || "Admin";

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="fixed left-0 top-0 h-screen w-[220px] bg-primary-container flex flex-col z-50">
        {/* Brand */}
        <a href="#/" className="px-5 pt-6 pb-2 block hover:opacity-80 transition-opacity">
          <div className="text-xl font-extrabold text-on-primary">AidChain</div>
          <div className="text-xs text-on-primary-container mt-0.5">Admin Panel</div>
        </a>

        {/* Create Pool CTA */}
        <div className="px-3 mt-4 mb-2">
          <a
            href="#/admin/create-pool"
            className="flex items-center justify-center gap-2 py-2.5 bg-secondary text-on-secondary rounded-full font-bold text-sm active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New Crisis Pool
          </a>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 mt-2 space-y-1">
          {ADMIN_NAV.map((item) => {
            const isActive = item.id === activeId;
            return (
              <a
                key={item.id}
                href={item.href || `#/admin/${item.id}`}
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

        {/* Sign Out */}
        <div className="px-3 mb-2">
          <button
            onClick={async () => {
              clearAdminPassword();
              await signOut();
              window.location.hash = "#/";
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-on-primary-container hover:bg-primary/20 transition-all w-full text-left"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            Exit Admin
          </button>
        </div>

        {/* User */}
        <div className="px-3 pb-5 border-t border-on-primary-container/20 pt-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">
              {name[0]}
            </div>
            <div>
              <div className="text-sm font-bold text-on-primary">{name}</div>
              <div className="text-xs text-on-primary-container">Administrator</div>
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
