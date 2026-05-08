import { useWallet } from "../wallet/useWallet";
import { shortenWalletAddress } from "../utils/wallet";

/**
 * Wallet connect/disconnect button.
 *
 * Variants:
 *   "pill"    – tiny inline pill for navbar / header bars (default)
 *   "sidebar" – full-width sidebar-style row matching sidebar nav items
 */
export default function WalletButton({ variant = "pill" }) {
  const { walletAddress, isWalletBusy, connectWallet, disconnectWallet } = useWallet();

  /* ── Sidebar variant ── */
  if (variant === "sidebar") {
    if (walletAddress) {
      return (
        <button
          onClick={disconnectWallet}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-on-primary-container hover:bg-primary/20 transition-all w-full text-left group"
          title="Click to disconnect wallet"
        >
          <span className="material-symbols-outlined text-xl text-green-400" style={{ fontVariationSettings: "'FILL' 1" }}>
            link
          </span>
          <span className="flex-1 min-w-0 truncate font-mono text-xs">{shortenWalletAddress(walletAddress)}</span>
          <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity text-on-primary-container">
            link_off
          </span>
        </button>
      );
    }
    return (
      <button
        onClick={() => connectWallet()}
        disabled={isWalletBusy}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-on-primary-container hover:bg-primary/20 transition-all w-full text-left disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
        {isWalletBusy ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  /* ── Pill variant (navbar) ── */
  if (walletAddress) {
    return (
      <button
        onClick={disconnectWallet}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant bg-surface-container-lowest text-xs font-bold text-primary hover:border-error hover:text-error transition-colors group"
        title="Click to disconnect"
      >
        <span className="material-symbols-outlined text-sm text-green-500 group-hover:hidden" style={{ fontVariationSettings: "'FILL' 1" }}>
          link
        </span>
        <span className="material-symbols-outlined text-sm text-error hidden group-hover:inline">
          link_off
        </span>
        {shortenWalletAddress(walletAddress)}
      </button>
    );
  }

  return (
    <button
      onClick={() => connectWallet()}
      disabled={isWalletBusy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant text-xs font-bold text-primary hover:bg-surface-container-low transition-colors disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
      {isWalletBusy ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
