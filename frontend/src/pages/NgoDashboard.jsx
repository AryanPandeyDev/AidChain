import { useQuery } from "@tanstack/react-query";
import { fetchNgoDashboard } from "../api/ngo";
import { useAuth } from "../auth/AuthProvider";

const NGO_NAV = [
  { icon: "dashboard", label: "Dashboard", id: "dashboard" },
  { icon: "browse_activity", label: "Browse Pools", id: "pools" },
  { icon: "receipt_long", label: "My Submissions", id: "submissions" },
  { icon: "assignment", label: "Assignment Requests", id: "assignments" },
  { icon: "verified", label: "Trust Score", id: "trust" },
];

function StatusDot({ status }) {
  const colors = { VERIFIED: "bg-green-500", PENDING: "bg-secondary", REJECTED: "bg-error", FAILED: "bg-error" };
  const textColors = { VERIFIED: "text-green-700", PENDING: "text-secondary", REJECTED: "text-error", FAILED: "text-error" };
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${textColors[status] || "text-on-surface-variant"}`}>
      <span className={`w-2 h-2 rounded-full ${colors[status] || "bg-outline"}`}></span>
      {label}
    </span>
  );
}

// Fallback data when backend is unreachable
const FALLBACK = {
  trust_score: 78,
  assigned_pools: [
    { id: "pool-1", name: "Sudan Emergency Relief", region: "East Africa", max_per_claim: 10000, status: "ACTIVE" },
    { id: "pool-2", name: "Clean Water Initiative", region: "Sub-Saharan Africa", max_per_claim: 10000, status: "ACTIVE" },
  ],
  recent_proofs: [
    { id: "p1", pool_id: "pool-1", claimed_amount: 2000, verification_status: "VERIFIED", created_at: "2023-10-24T00:00:00Z" },
    { id: "p2", pool_id: "pool-2", claimed_amount: 1500, verification_status: "PENDING", created_at: "2023-10-23T00:00:00Z" },
    { id: "p3", pool_id: "pool-1", claimed_amount: 5000, verification_status: "REJECTED", created_at: "2023-10-20T00:00:00Z" },
  ],
};

export default function NgoDashboard() {
  const { isSignedIn } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["ngoDashboard"],
    queryFn: fetchNgoDashboard,
    retry: 1,
    placeholderData: FALLBACK,
  });

  const trustScore = data?.trust_score || 0;
  const pools = data?.assigned_pools || [];
  const proofs = data?.recent_proofs || [];
  const arcPct = (trustScore / 100) * 283;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[200px] bg-primary-container flex flex-col z-50">
        <div className="px-5 pt-6 pb-6">
          <div className="text-2xl font-extrabold text-on-primary">AidChain</div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NGO_NAV.map((item) => {
            const isActive = item.id === "dashboard";
            return (
              <a key={item.id} href={item.id === "pools" ? "#/pools" : `#/ngo/${item.id}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "bg-primary text-on-primary" : "text-on-primary-container hover:bg-primary/20"
                }`}>
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="px-3 mb-4">
          <a href="#" className="flex items-center justify-center gap-2 py-3 bg-secondary text-on-secondary rounded-full font-bold text-sm active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-lg">add</span>
            New Proposal
          </a>
        </div>
        <div className="px-4 pb-5 border-t border-on-primary-container/20 pt-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">account_balance</span>
            </div>
            <div>
              <div className="text-sm font-bold text-on-primary leading-tight">
                {isSignedIn ? "My NGO" : "Global Relief Corp"}
              </div>
              <div className="text-xs text-on-primary-container">NGO · Verified ✓</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-[200px] flex-1 p-8 pb-16">
        <div className="max-w-[1000px] mx-auto">

          {isLoading && (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-on-surface-variant">Loading dashboard...</p>
            </div>
          )}

          {error && !data && (
            <div className="bg-error-container border border-error rounded-2xl p-5 mb-6">
              <p className="text-sm text-on-error-container">Failed to load dashboard. {error.message}</p>
            </div>
          )}

          {/* ── Trust Score Banner ── */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 mb-8 flex items-center gap-8">
            <div className="flex-1">
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-extrabold text-primary">{Math.round(trustScore)}</span>
                <span className="text-xl text-on-surface-variant">/100</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-bold text-primary">Trust Score</span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Maintain above 20 to stay in good standing. Above 90 for Gold Seal.
              </p>
            </div>
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e9e1dc" strokeWidth="8" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#1b3d2f" strokeWidth="8"
                  strokeDasharray="283" strokeDashoffset={283 - arcPct} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
              </div>
            </div>
          </div>

          {/* ── Assigned Pools ── */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-extrabold text-primary">Assigned Pools</h2>
            <a href="#/pools" className="text-sm font-bold text-on-surface-variant hover:text-primary flex items-center gap-1">
              View All <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </a>
          </div>

          {pools.length === 0 && !isLoading && (
            <div className="bg-surface-container-low rounded-2xl p-8 text-center mb-10">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">inventory_2</span>
              <p className="text-on-surface-variant text-sm">No pools assigned yet. Request assignment from Browse Pools.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
            {pools.map((pool) => (
              <div key={pool.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-bold text-primary">{pool.name}</h3>
                  <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
                    <span className="material-symbols-outlined text-xs" style={{ fontSize: "12px" }}>location_on</span>
                    {pool.region}
                  </span>
                </div>
                <div className="mb-5">
                  <div className="text-xs text-on-surface-variant mb-0.5">Max Per Claim</div>
                  <div className="text-2xl font-extrabold text-primary">${(pool.max_per_claim || 0).toLocaleString()}</div>
                </div>
                <a href="#/ngo/submit-proof"
                  className="block text-center py-3 bg-secondary text-on-secondary rounded-full font-bold text-sm active:scale-[0.98] transition-transform w-full">
                  Submit Proof
                </a>
              </div>
            ))}
          </div>

          {/* ── Recent Submissions ── */}
          <h2 className="text-2xl font-extrabold text-primary mb-4">Recent Submissions</h2>
          {proofs.length === 0 && !isLoading ? (
            <div className="bg-surface-container-low rounded-2xl p-8 text-center mb-10">
              <p className="text-on-surface-variant text-sm">No submissions yet.</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden mb-10">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Date</th>
                    <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Pool</th>
                    <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Amount</th>
                    <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {proofs.map((s) => (
                    <tr key={s.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-5 py-4 text-sm text-on-surface">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-4 text-sm font-medium text-primary">{s.pool_id}</td>
                      <td className="px-5 py-4 text-sm font-mono font-bold text-on-surface">${s.claimed_amount?.toLocaleString()}</td>
                      <td className="px-5 py-4"><StatusDot status={s.verification_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Quick Actions ── */}
          <div className="flex items-center gap-4">
            <a href="#/ngo/submit-proof"
              className="flex items-center gap-2 px-8 py-3 bg-primary text-on-primary rounded-full font-bold text-sm active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-lg">upload_file</span>
              Submit New Proof
            </a>
            <a href="#/pools"
              className="flex items-center gap-2 px-8 py-3 border border-outline-variant text-primary rounded-full font-bold text-sm hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined text-lg">search</span>
              Browse Pools
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
