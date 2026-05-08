import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPool } from "../api/pools";
import { fetchPoolDonations } from "../api/donations";
import { useAuth } from "../auth/AuthProvider";
import { donateUSDCToPool } from "../utils/wallet";
import { useWallet } from "../wallet/useWallet";
import Navbar from "../components/Navbar";

function getPoolIdFromHash() {
  const m = window.location.hash.match(/#\/pool\/(.+)/);
  return m ? m[1] : null;
}

function formatAmount(n) {
  return "$" + (n || 0).toLocaleString();
}

export default function PoolDetailPublic() {
  const poolId = getPoolIdFromHash();
  const { isSignedIn } = useAuth();
  const { walletAddress, isWalletBusy, connectWallet, verifyWallet } = useWallet();
  const qc = useQueryClient();
  const [donationAmount, setDonationAmount] = useState("");
  const [donationStatus, setDonationStatus] = useState(null);

  const { data: pool, isLoading, error } = useQuery({
    queryKey: ["pool", poolId],
    queryFn: () => fetchPool(poolId),
    enabled: !!poolId,
  });

  const { data: donations = [] } = useQuery({
    queryKey: ["poolDonations", poolId],
    queryFn: () => fetchPoolDonations(poolId),
    enabled: !!poolId && isSignedIn,
    retry: 1,
  });

  const donateMutation = useMutation({
    mutationFn: async () => {
      if (!isSignedIn) {
        throw new Error("Please sign in before donating so AidChain can link the wallet transaction to your account.");
      }
      setDonationStatus(null);
      const currentWallet = walletAddress || await connectWallet();
      await verifyWallet();
      const result = await donateUSDCToPool({
        poolAddress: pool.contractAddress,
        amount: donationAmount,
        from: currentWallet,
      });
      return result;
    },
    onSuccess: ({ donateHash }) => {
      setDonationStatus(`Donation submitted: ${donateHash}`);
      setDonationAmount("");
      qc.invalidateQueries({ queryKey: ["pool", poolId] });
      qc.invalidateQueries({ queryKey: ["poolDonations", poolId] });
    },
  });

  if (!poolId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-3 block">error</span>
          <p className="text-on-surface-variant mb-4">No pool selected.</p>
          <a href="#/pools" className="text-primary font-bold hover:underline">← Browse Pools</a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-3 block">error</span>
          <h2 className="text-xl font-bold text-primary mb-2">Pool Not Found</h2>
          <p className="text-sm text-on-surface-variant mb-6">{error?.message || "This pool does not exist or is no longer available."}</p>
          <a href="#/pools" className="px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform inline-block">
            Browse Pools
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* Header */}
      <div className="bg-primary-container px-8 py-8 pt-24">
        <div className="max-w-[900px] mx-auto">
          <a href="#/pools" className="flex items-center gap-1 text-sm text-on-primary-container mb-3 hover:underline">
            <span className="material-symbols-outlined text-lg">arrow_back</span> All Pools
          </a>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-extrabold text-on-primary tracking-tight">{pool.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                  pool.donationsPaused ? "bg-secondary-fixed text-on-secondary-fixed" : "bg-surface-container-lowest text-primary"
                }`}>
                  <span className="material-symbols-outlined text-xs">{pool.donationsPaused ? "pause_circle" : "radio_button_checked"}</span>
                  {pool.donationsPaused ? "Paused" : "Active"}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-on-primary-container">
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  {pool.region}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Target Amount", value: formatAmount(pool.targetAmount), icon: "savings" },
            { label: "Amount Raised", value: formatAmount(pool.fundedAmount), icon: "trending_up" },
            { label: "Progress", value: `${pool.percentFunded}%`, icon: "pie_chart" },
            { label: "Pool Balance", value: pool.poolBalance != null ? formatAmount(pool.poolBalance) : "Syncing...", icon: "account_balance_wallet" },
          ].map((s) => (
            <div key={s.label} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-xl text-on-surface-variant">{s.icon}</span>
                <span className="text-xs font-bold text-on-surface-variant">{s.label}</span>
              </div>
              <div className="text-2xl font-extrabold text-primary">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-bold text-primary">{formatAmount(pool.fundedAmount)} raised</span>
            <span className="text-on-surface-variant">of {formatAmount(pool.targetAmount)} target</span>
          </div>
          <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-secondary rounded-full transition-all duration-500" style={{ width: `${pool.percentFunded}%` }}></div>
          </div>
        </div>

        {/* Donate */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-primary mb-1.5">Donate USDC</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={donationAmount}
                onChange={(e) => setDonationAmount(e.target.value)}
                placeholder="25.00"
                className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
            <button
              onClick={() => donateMutation.mutate()}
              disabled={donateMutation.isPending || isWalletBusy || !isSignedIn || pool.donationsPaused || !pool.contractAddress || !donationAmount}
              className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
              {donateMutation.isPending || isWalletBusy ? "Confirm in MetaMask..." : isSignedIn ? "Donate with MetaMask" : "Sign in to Donate"}
            </button>
          </div>
          {(donateMutation.isError || donationStatus) && (
            <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              donateMutation.isError
                ? "bg-error-container text-on-error-container border border-error"
                : "bg-primary-fixed/30 text-primary border border-primary/20"
            }`}>
              {donateMutation.isError ? donateMutation.error?.message || "Donation failed" : donationStatus}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-primary mb-3">About This Pool</h2>
          <p className="text-on-surface leading-relaxed">{pool.description || "No description available."}</p>
        </div>

        {/* Assigned NGOs */}
        {pool.ngos && pool.ngos.length > 0 && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-primary mb-4">Assigned NGOs</h2>
            <div className="space-y-3">
              {pool.ngos.map((n) => (
                <div key={n.ngoUserId} className="flex items-center justify-between py-2 border-b border-outline-variant/50 last:border-0">
                  <div>
                    <div className="text-sm font-bold text-primary">{n.organizationName || n.ngoUserId?.substring(0, 8) + "..."}</div>
                    <div className="text-xs text-on-surface-variant font-mono">{n.walletAddress || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${n.trustScore}%` }}></div>
                    </div>
                    <span className="text-sm font-bold text-primary">{n.trustScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Donations (only visible to signed-in users) */}
        {isSignedIn && donations.length > 0 && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h2 className="text-xl font-bold text-primary">Recent Donations</h2>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="px-6 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Donor</th>
                  <th className="px-6 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Tx Hash</th>
                  <th className="px-6 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Date</th>
                </tr>
              </thead>
              <tbody>
                {donations.slice(0, 10).map((d) => (
                  <tr key={d.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-3 text-sm font-mono text-on-surface-variant">{d.donor_id?.substring(0, 8)}...</td>
                    <td className="px-6 py-3 text-sm font-bold text-primary">${d.amount?.toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm font-mono text-on-surface-variant">{d.tx_hash?.substring(0, 12)}...</td>
                    <td className="px-6 py-3 text-sm text-on-surface-variant">{new Date(d.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Contract Info */}
        {pool.contractAddress && (
          <div className="bg-surface-container-low rounded-2xl p-4 text-center">
            <span className="text-xs text-on-surface-variant">Contract: </span>
            <span className="text-xs font-mono text-primary">{pool.contractAddress}</span>
          </div>
        )}
      </div>
    </div>
  );
}
