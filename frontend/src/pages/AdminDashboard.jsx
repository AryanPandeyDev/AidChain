import { useQuery } from "@tanstack/react-query";
import { fetchApplications } from "../api/admin";
import { fetchPools } from "../api/pools";

const ADMIN_NAV = [
  { icon: "dashboard", label: "Dashboard", id: "admin-dash" },
  { icon: "verified_user", label: "NGO Applications", id: "ngo-apps" },
  { icon: "diversity_3", label: "Crisis Pools", id: "pools" },
  { icon: "menu_book", label: "Impact Ledger", id: "ledger" },
  { icon: "settings", label: "Settings", id: "settings" },
];

export default function AdminDashboard() {
  const { data: pendingApps = [], isLoading: appsLoading } = useQuery({
    queryKey: ["adminApps", "PENDING_REVIEW"],
    queryFn: () => fetchApplications("PENDING_REVIEW"),
    retry: 1,
  });

  const { data: verifiedApps = [] } = useQuery({
    queryKey: ["adminApps", "VERIFIED"],
    queryFn: () => fetchApplications("VERIFIED"),
    retry: 1,
  });

  const { data: pools = [], isLoading: poolsLoading } = useQuery({
    queryKey: ["pools"],
    queryFn: fetchPools,
    retry: 1,
  });

  const activePools = pools.filter((p) => p.status === "ACTIVE");

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="fixed left-0 top-0 h-screen w-[200px] bg-primary-container flex flex-col z-50">
        <div className="px-5 pt-6 pb-2">
          <div className="text-xl font-extrabold text-on-primary">AidChain</div>
          <div className="text-xs text-on-primary-container mt-0.5">Admin Panel</div>
        </div>
        <nav className="flex-1 px-3 mt-6 space-y-1">
          {ADMIN_NAV.map((item) => (
            <a key={item.id} href={`#/admin/${item.id}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                item.id === "admin-dash" ? "bg-primary text-on-primary shadow-sm" : "text-on-primary-container hover:bg-primary/20"
              }`}>
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="px-3 pb-5 border-t border-on-primary-container/20 pt-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">AD</div>
            <div>
              <div className="text-sm font-bold text-on-primary">Admin</div>
              <div className="text-xs text-on-primary-container">Platform</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-[200px] flex-1 p-8 pb-16">
        <div className="max-w-[1100px] mx-auto">
          <h1 className="text-4xl font-extrabold text-primary tracking-tight mb-8">Admin Dashboard</h1>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Pending Applications", value: appsLoading ? "..." : pendingApps.length, icon: "pending_actions", accent: "bg-secondary-fixed" },
              { label: "Active Pools", value: poolsLoading ? "..." : activePools.length, icon: "pool", accent: "bg-primary-fixed" },
              { label: "Total Pool Value", value: poolsLoading ? "..." : `$${pools.reduce((s, p) => s + (p.targetAmount || 0), 0).toLocaleString()}`, icon: "payments", accent: "bg-primary-fixed" },
              { label: "Verified NGOs", value: verifiedApps.length || "0", icon: "verified_user", accent: "bg-primary-fixed" },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 ${stat.accent} rounded-xl flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                  </div>
                </div>
                <div className="text-xs text-on-surface-variant font-bold uppercase tracking-widest mb-1">{stat.label}</div>
                <div className="text-2xl font-extrabold text-primary">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pending Applications */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">assignment_ind</span>
                  Pending Applications
                </h2>
                <a href="#/admin/ngo-apps" className="text-sm font-bold text-secondary hover:underline">View All →</a>
              </div>

              {appsLoading ? (
                <div className="text-center py-8"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div></div>
              ) : pendingApps.length === 0 ? (
                <div className="bg-surface-container-low rounded-2xl p-8 text-center">
                  <p className="text-on-surface-variant text-sm">No pending applications.</p>
                </div>
              ) : (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-outline-variant">
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Organization</th>
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Country</th>
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingApps.slice(0, 5).map((app) => (
                        <tr key={app.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-low/50 transition-colors cursor-pointer"
                          onClick={() => window.location.hash = "#/admin/ngo-apps"}>
                          <td className="px-5 py-3.5 text-sm font-medium text-primary">{app.organization_name}</td>
                          <td className="px-5 py-3.5 text-sm text-on-surface">{app.country}</td>
                          <td className="px-5 py-3.5 text-sm text-on-surface-variant">{new Date(app.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-xl font-bold text-primary flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">bolt</span>
                Quick Actions
              </h2>
              <div className="space-y-3">
                <a href="#/admin/ngo-apps" className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 hover:bg-surface-container-low transition-colors">
                  <span className="material-symbols-outlined text-secondary">person_search</span>
                  <div>
                    <div className="text-sm font-bold text-primary">Review Applications</div>
                    <div className="text-xs text-on-surface-variant">{pendingApps.length} pending</div>
                  </div>
                </a>
                <a href="#/admin/create-pool" className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 hover:bg-surface-container-low transition-colors">
                  <span className="material-symbols-outlined text-secondary">add_circle</span>
                  <div>
                    <div className="text-sm font-bold text-primary">Create Crisis Pool</div>
                    <div className="text-xs text-on-surface-variant">Deploy new on-chain pool</div>
                  </div>
                </a>
                <a href="#/pools" className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 hover:bg-surface-container-low transition-colors">
                  <span className="material-symbols-outlined text-secondary">manage_search</span>
                  <div>
                    <div className="text-sm font-bold text-primary">Manage Pools</div>
                    <div className="text-xs text-on-surface-variant">{activePools.length} active</div>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Active Pools */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">pool</span>
                Active Pools
              </h2>
              <a href="#/admin/create-pool" className="flex items-center gap-2 px-5 py-2 bg-secondary text-on-secondary rounded-full text-sm font-bold active:scale-95 transition-transform">
                <span className="material-symbols-outlined text-lg">add</span>
                Create New Pool
              </a>
            </div>

            {poolsLoading ? (
              <div className="text-center py-8"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div></div>
            ) : activePools.length === 0 ? (
              <div className="bg-surface-container-low rounded-2xl p-8 text-center">
                <p className="text-on-surface-variant text-sm">No active pools. Create one to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {activePools.map((pool) => (
                  <a key={pool.id} href={`#/admin/pool-detail/${pool.id}`}
                    className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 hover:shadow-md transition-shadow block">
                    <h3 className="text-base font-bold text-primary mb-3">{pool.name}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Target</span>
                        <span className="font-bold text-primary">${pool.targetAmount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Funded</span>
                        <span className="font-bold text-secondary">{pool.percentFunded}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Region</span>
                        <span className="font-bold text-primary">{pool.region}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
