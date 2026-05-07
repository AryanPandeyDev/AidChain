import { useQuery } from "@tanstack/react-query";
import { fetchPools } from "../api/pools";
import { fetchMyDonations } from "../api/donations";
import { useAuth } from "../auth/AuthProvider";
import Sidebar from "../components/Sidebar";

function formatAmount(n) {
  return "$" + (n || 0).toLocaleString();
}

export default function DonorDashboard() {
  const { user } = useAuth();
  const firstName = user?.firstName || "Donor";

  const { data: pools = [] } = useQuery({ queryKey: ["pools"], queryFn: fetchPools });

  const { data: donations = [], isLoading: donLoading } = useQuery({
    queryKey: ["myDonations"],
    queryFn: fetchMyDonations,
    retry: 1,
  });

  const totalDonated = donations.reduce((sum, d) => sum + (d.amount || 0), 0);
  const uniquePools = new Set(donations.map((d) => d.pool_id)).size;

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar active="dashboard" role="Donor" userName={firstName} />

      <main className="ml-[200px] flex-1 p-8 pb-16">
        <div className="max-w-[1100px] mx-auto flex gap-8">
          <div className="flex-1 min-w-0">
            {/* Welcome */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
              <div>
                <h1 className="text-4xl font-extrabold text-primary tracking-tight">Welcome back, {firstName}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                  <span className="text-xs font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">Connected</span>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl px-5 py-3 text-center min-w-[130px]">
                  <div className="text-xs text-on-surface-variant font-bold uppercase tracking-widest mb-1">Total Donated</div>
                  <div className="text-2xl font-extrabold text-primary">{formatAmount(totalDonated)}</div>
                  <div className="text-xs text-on-surface-variant">USDC</div>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl px-5 py-3 text-center min-w-[100px]">
                  <div className="text-xs text-on-surface-variant font-bold uppercase tracking-widest mb-1">Pools Funded</div>
                  <div className="text-2xl font-extrabold text-primary">{uniquePools}</div>
                </div>
              </div>
            </div>

            {/* Active Pools */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-secondary">diamond</span>
                <h2 className="text-xl font-bold text-primary">Active Pools</h2>
              </div>
              {pools.length === 0 ? (
                <div className="bg-surface-container-low rounded-2xl p-8 text-center">
                  <p className="text-on-surface-variant text-sm">No active pools found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pools.slice(0, 4).map((pool) => (
                    <div key={pool.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
                      <div className="relative h-36 bg-surface-container-high flex items-center justify-center">
                        <span className="material-symbols-outlined text-5xl text-on-surface-variant/20">water_drop</span>
                        <span className="absolute top-3 left-3 bg-primary text-on-primary text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                          {pool.region}
                        </span>
                      </div>
                      <div className="p-5">
                        <h3 className="text-base font-bold text-primary mb-3">{pool.name}</h3>
                        <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-2">
                          <div className="h-full bg-secondary rounded-full" style={{ width: `${pool.percentFunded}%` }}></div>
                        </div>
                        <div className="flex justify-between text-sm mb-4">
                          <span className="font-bold text-primary">{formatAmount(pool.fundedAmount)} / {formatAmount(pool.targetAmount)}</span>
                          <span className="text-on-surface-variant">{pool.percentFunded}% Funded</span>
                        </div>
                        <a href={`#/pool/${pool.id}`} className="block text-center py-2.5 border border-outline-variant rounded-full text-sm font-bold text-primary hover:bg-primary hover:text-on-primary transition-colors">
                          View Details
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Donations Table */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">receipt_long</span>
                <h2 className="text-xl font-bold text-primary">Recent Donations</h2>
              </div>

              {donLoading ? (
                <div className="text-center py-8"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div></div>
              ) : donations.length === 0 ? (
                <div className="bg-surface-container-low rounded-2xl p-8 text-center">
                  <p className="text-on-surface-variant text-sm">No donations yet. Browse pools to get started!</p>
                  <a href="#/pools" className="mt-3 inline-block px-5 py-2 bg-primary text-on-primary rounded-full text-sm font-bold">Browse Pools</a>
                </div>
              ) : (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-outline-variant">
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Date</th>
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Pool</th>
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Amount (USDC)</th>
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Tx Hash</th>
                        <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donations.map((d) => (
                        <tr key={d.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-5 py-3.5 text-sm text-on-surface">{new Date(d.created_at).toLocaleDateString()}</td>
                          <td className="px-5 py-3.5 text-sm text-primary font-medium">{d.pool_name}</td>
                          <td className="px-5 py-3.5 text-sm font-mono font-bold text-on-surface">{(d.amount || 0).toLocaleString()}</td>
                          <td className="px-5 py-3.5">
                            <a href={`https://polygonscan.com/tx/${d.tx_hash}`} target="_blank" rel="noopener noreferrer"
                              className="text-sm font-mono text-on-surface-variant hover:text-secondary transition-colors">
                              {d.tx_hash?.substring(0, 10)}...
                            </a>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                              <span className="material-symbols-outlined text-sm text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                              Confirmed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
