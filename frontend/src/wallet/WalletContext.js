import { createContext } from "react";

export const WalletContext = createContext({
  walletAddress: "",
  savedWalletAddress: "",
  isWalletConnected: false,
  isWalletVerified: false,
  walletError: "",
  isWalletBusy: false,
  connectWallet: async () => "",
  verifyWallet: async () => "",
  disconnectWallet: () => {},
  clearWalletError: () => {},
});
