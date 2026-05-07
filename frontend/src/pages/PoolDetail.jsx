import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPool } from "../api/pools";
import { fetchPoolDonations } from "../api/donations";
import { fetchPoolAssignmentRequests, pausePool, resumePool, approveAssignment, rejectAssignment } from "../api/admin";

const ADMIN_NAV = [
  { icon: "dashboard", label: "Dashboard", id: "admin-dash" },
  { icon: "verified_user", label: "NGO Applications", id: "ngo-apps" },
  { icon: "diversity_3", label: "Crisis Pools", id: "pools" },
  { icon: "menu_book", label: "Impact Ledger", id: "ledger" },
  { icon: "settings", label: "Settings", id: "settings" },
];

function getPoolIdFromHash() {
  const m = window.location.hash.match(/#\/admin\/pool-detail\/(.+)/);
  return m ? m[1] : null;
}

export default function PoolDetail() {
  const poolId = getPoolIdFromHash();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: pool, isLoading } = useQuery({
    queryKey: ["pool", poolId],
    queryFn: () => fetchPool(poolId),
    enabled: !!poolId,
  });

  const { data: pendingReqs = [] } = useQuery({
    queryKey: ["poolAssignReqs", poolId, "PENDING"],
    queryFn: () => fetchPoolAssignmentRequests(poolId, "PENDING"),
    enabled: !!poolId,
  });

  const { data: donations = [] } = useQuery({
    queryKey: ["poolDonations", poolId],
    queryFn: () => fetchPoolDonations(poolId),
    enabled: !!poolId && activeTab === 2,
  });

  const pauseMut = useMutation({
    mutationFn: () => pausePool(poolId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pool", poolId] }),
  });

  const resumeMut = useMutation({
    mutationFn: () => resumePool(poolId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pool", poolId] }),
  });

  const approveAssignMut = useMutation({
    mutationFn: (reqId) => approveAssignment(poolId, reqId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["poolAssignReqs", poolId] });
      qc.invalidateQueries({ queryKey: ["pool", poolId] });
    },
  });

  const rejectAssignMut = useMutation({
    mutationFn: () => rejectAssignment(poolId, rejectTarget, rejectReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["poolAssignReqs", poolId] });
      setRejectTarget(null);
      setRejectReason("");
    },
  });

  if (!poolId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-on-surface-variant mb-4">No pool selected.</p>
          <a href="#/admin" className="text-primary font-bold hover:underline">← Back to Dashboard</a>
        </div>
      </div>
    );
  }

  const TABS = ["Assigned NGOs", `Pending Requests (${pendingReqs.length})`, "Donations", "Pool Settings"];

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="fixed left-0 top-0 h-screen w-[200px] bg-surface-container-low flex flex-col z-50 border-r border-outline-variant">
        <div className="px-5 pt-6 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-xl">account_balance</span>
          </div>
          <div>
            <div className="text-lg font-extrabold text-primary leading-tight">AidChain</div>
            <div className="text-lg font-extrabold text-primary leading-tight">Admin</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {ADMIN_NAV.map((item) => (
            <a key={item.id} href={`#/admin/${item.id}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                item.id === "pools" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"
              }`}>
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <main className="ml-[200px] flex-1 p-8 pb-16">
        <div className="max-w-[1000px] mx-auto">
          {isLoading ? (
            <div className="text-center py-16"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div></div>
          ) : !pool ? (
            <p className="text-on-surface-variant">Pool not found.</p>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <a href="#/admin" className="flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-primary mb-2">
                    <span className="material-symbols-outlined text-lg">arrow_back</span> All Pools
                  </a>
                  <h1 className="text-3xl font-extrabold text-primary tracking-tight">{pool.name}</h1>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${pool.donationsPaused ? "bg-secondary-fixed text-on-secondary-fixed" : "bg-primary-fixed text-primary"}`}>
                      <span className="material-symbols-outlined text-xs">{pool.donationsPaused ? "pause_circle" : "radio_button_checked"}</span>
                      {pool.donationsPaused ? "Paused" : "Active"}
                    </span>
                    <span className="text-xs text-on-surface-variant font-mono">{pool.contractAddress}</span>
                  </div>
                </div>
                <button onClick={() => pool.donationsPaused ? resumeMut.mutate() : pauseMut.mutate()}
                  disabled={pauseMut.isPending || resumeMut.isPending}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-transform active:scale-95 disabled:opacity-60 ${
                    pool.donationsPaused ? "bg-primary text-on-primary" : "bg-surface-container-high text-primary border border-outline-variant"
                  }`}>
                  <span className="material-symbols-outlined text-lg">{pool.donationsPaused ? "play_arrow" : "pause"}</span>
                  {pool.donationsPaused ? "Resume Donations" : "Pause Donations"}
                </button>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Target Amount", value: `$${pool.targetAmount?.toLocaleString()}`, icon: "savings" },
                  { label: "Balance Remaining", value: `$${(pool.poolBalance || 0).toLocaleString()}`, icon: "account_balance_wallet", highlight: true },
                  { label: "Assigned NGOs", value: pool.ngos?.length || 0, icon: "diversity_3" },
                  { label: "Pending Requests", value: pendingReqs.length, icon: "pending_actions" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-2xl p-5 ${s.highlight ? "bg-secondary text-on-secondary" : "bg-surface-container-lowest border border-outline-variant"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-xl">{s.icon}</span>
                      <span className={`text-xs font-bold ${s.highlight ? "text-on-secondary/80" : "text-on-surface-variant"}`}>{s.label}</span>
                    </div>
                    <div className={`text-2xl font-extrabold ${s.highlight ? "" : "text-primary"}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-outline-variant mb-6">
                {TABS.map((t, i) => (
                  <button key={t} onClick={() => setActiveTab(i)}
                    className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${activeTab === i ? "text-secondary border-secondary" : "text-on-surface-variant border-transparent hover:text-primary"}`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Tab: Assigned NGOs */}
              {activeTab === 0 && (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
                  {pool.ngos?.length === 0 ? (
                    <div className="text-center py-12"><p className="text-on-surface-variant text-sm">No NGOs assigned yet.</p></div>
                  ) : (
                    <table className="w-full text-left">
                      <thead><tr className="border-b border-outline-variant">
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">NGO ID</th>
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Wallet</th>
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Trust Score</th>
                      </tr></thead>
                      <tbody>
                        {pool.ngos.map((n) => (
                          <tr key={n.ngoUserId} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-5 py-3.5 text-sm font-mono text-primary">{n.ngoUserId?.substring(0, 8)}...</td>
                            <td className="px-5 py-3.5 text-sm font-mono text-on-surface-variant">{n.walletAddress || "—"}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${n.trustScore}%` }}></div>
                                </div>
                                <span className="text-sm font-bold text-primary">{n.trustScore}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Tab: Pending Requests */}
              {activeTab === 1 && (
                <div className="space-y-4">
                  {pendingReqs.length === 0 && <div className="text-center py-12"><p className="text-on-surface-variant text-sm">No pending assignment requests.</p></div>}
                  {pendingReqs.map((req) => (
                    <div key={req.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-primary">{req.ngo_name}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-on-surface-variant">★ Trust: {req.trust_score}</span>
                            <span className="text-xs text-on-surface-variant">Applied: {new Date(req.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-surface-container-low rounded-xl px-4 py-3 mb-4 border-l-4 border-primary">
                        <p className="text-sm text-on-surface italic">{req.justification}</p>
                      </div>
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => setRejectTarget(req.id)} className="px-4 py-2 border border-error text-error rounded-full text-sm font-bold hover:bg-error-container">
                          Reject
                        </button>
                        <button onClick={() => approveAssignMut.mutate(req.id)} disabled={approveAssignMut.isPending}
                          className="px-5 py-2 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform disabled:opacity-60">
                          {approveAssignMut.isPending ? "Approving..." : "Approve"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: Donations */}
              {activeTab === 2 && (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
                  {donations.length === 0 ? (
                    <div className="text-center py-12"><p className="text-on-surface-variant text-sm">No donations yet.</p></div>
                  ) : (
                    <table className="w-full text-left">
                      <thead><tr className="border-b border-outline-variant">
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Donor</th>
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Amount</th>
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Tx Hash</th>
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Date</th>
                      </tr></thead>
                      <tbody>
                        {donations.map((d) => (
                          <tr key={d.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-5 py-3 text-sm font-mono text-on-surface-variant">{d.donor_id?.substring(0, 8)}...</td>
                            <td className="px-5 py-3 text-sm font-bold text-primary">${d.amount?.toLocaleString()}</td>
                            <td className="px-5 py-3 text-sm font-mono text-on-surface-variant">{d.tx_hash?.substring(0, 12)}...</td>
                            <td className="px-5 py-3 text-sm text-on-surface-variant">{new Date(d.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Tab: Pool Settings */}
              {activeTab === 3 && (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
                  <h2 className="text-xl font-bold text-primary mb-5">Pool Configuration</h2>
                  <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                    {[
                      ["Region", pool.region],
                      ["Contract", pool.contractAddress],
                      ["Max Per Claim", pool.maxPerClaim ? `$${pool.maxPerClaim.toLocaleString()}` : "—"],
                      ["Max Per NGO/Day", pool.maxPerNGOPerDay ? `$${pool.maxPerNGOPerDay.toLocaleString()}` : "—"],
                      ["Max Per NGO Total", pool.maxPerNGOPool ? `$${pool.maxPerNGOPool.toLocaleString()}` : "—"],
                      ["Donations Paused", pool.donationsPaused ? "Yes" : "No"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">{k}</div>
                        <div className="text-base font-bold text-primary font-mono">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-primary/30 flex items-center justify-center z-[100] p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-primary mb-2">Reject Assignment Request</h3>
            <textarea placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm mb-4 resize-none focus:outline-none focus:border-primary"></textarea>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setRejectTarget(null); setRejectReason(""); }} className="px-4 py-2 text-sm font-bold text-on-surface-variant">Cancel</button>
              <button onClick={() => rejectAssignMut.mutate()} disabled={!rejectReason || rejectAssignMut.isPending}
                className="px-6 py-2 bg-error text-on-error rounded-full text-sm font-bold disabled:opacity-60">
                {rejectAssignMut.isPending ? "Rejecting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
