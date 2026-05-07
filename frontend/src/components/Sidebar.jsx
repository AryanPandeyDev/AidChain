import { useState } from "react";

const NAV_ITEMS = [
  { icon: "dashboard", label: "Dashboard", href: "#/dashboard", id: "dashboard" },
  { icon: "favorite", label: "My Donations", href: "#/donations", id: "donations" },
  { icon: "browse_activity", label: "Browse Pools", href: "#/pools", id: "pools" },
  { icon: "account_balance_wallet", label: "Wallet", href: "#/wallet", id: "wallet" },
  { icon: "settings", label: "Settings", href: "#/settings", id: "settings" },
];

export default function Sidebar({ active = "dashboard", role = "Donor", userName = "Alex Rivera" }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-primary-container flex flex-col z-50 transition-all duration-300 ${collapsed ? "w-[68px]" : "w-[200px]"}`}>
      {/* Logo */}
      <div className="px-5 pt-6 pb-2">
        <div className="text-xl font-extrabold text-on-primary">
          {collapsed ? "AC" : "AidChain"}
        </div>
        {!collapsed && (
          <div className="text-xs text-on-primary-container mt-0.5">Verified Impact Ledger</div>
        )}
      </div>

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
              title={collapsed ? item.label : undefined}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {!collapsed && item.label}
            </a>
          );
        })}
      </nav>

      {/* Donate Button */}
      <div className="px-3 mb-2">
        <a
          href="#/pools"
          className={`flex items-center justify-center gap-2 py-3 bg-secondary text-on-secondary rounded-full font-bold text-sm active:scale-95 transition-transform ${
            collapsed ? "px-2" : "px-4"
          }`}
        >
          <span className="material-symbols-outlined text-lg">volunteer_activism</span>
          {!collapsed && "Donate Now"}
        </a>
      </div>

      {/* Bottom links */}
      <div className="px-3 space-y-1 mb-3">
        <a href="#" className="flex items-center gap-3 px-3 py-2 text-on-primary-container text-sm hover:text-on-primary transition-colors">
          <span className="material-symbols-outlined text-xl">support</span>
          {!collapsed && "Support"}
        </a>
        <a href="#/" className="flex items-center gap-3 px-3 py-2 text-on-primary-container text-sm hover:text-on-primary transition-colors">
          <span className="material-symbols-outlined text-xl">logout</span>
          {!collapsed && "Sign Out"}
        </a>
      </div>

      {/* User */}
      <div className="px-3 pb-5 border-t border-on-primary-container/20 pt-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-fixed-dim flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
            {userName.split(" ").map((n) => n[0]).join("")}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-on-primary truncate">{userName}</div>
              <div className="text-xs text-on-primary-container">{role}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
