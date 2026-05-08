import { useClerk } from "@clerk/clerk-react";
import WalletButton from "./WalletButton";

const NAV_ITEMS = [
  { icon: "dashboard", label: "Dashboard", href: "#/dashboard", id: "dashboard" },
  { icon: "browse_activity", label: "Browse Pools", href: "#/pools", id: "pools" },
];

export default function Sidebar({ active = "dashboard", userName = "Donor" }) {
  const { signOut } = useClerk();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-primary-container flex flex-col z-50">
      {/* Logo */}
      <a href="#/" className="px-5 pt-6 pb-2 block hover:opacity-80 transition-opacity">
        <div className="text-xl font-extrabold text-on-primary">AidChain</div>
        <div className="text-xs text-on-primary-container mt-0.5">Donor Portal</div>
      </a>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
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

      {/* Donate CTA */}
      <div className="px-3 mb-4">
        <a
          href="#/pools"
          className="flex items-center justify-center gap-2 py-3 bg-secondary text-on-secondary rounded-full font-bold text-sm active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-lg">volunteer_activism</span>
          Donate Now
        </a>
      </div>

      {/* Bottom actions — wallet & sign out sit together like nav items */}
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
      <div className="px-3 pb-5 border-t border-on-primary-container/20 pt-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-fixed-dim flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
            {userName.split(" ").map((n) => n[0]).join("")}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-bold text-on-primary truncate">{userName}</div>
            <div className="text-xs text-on-primary-container">Donor</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
