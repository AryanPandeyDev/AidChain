import { useEffect, useState } from "react";
import { fetchMe } from "../api/user";
import { useAuth } from "../auth/AuthProvider";
import {
  APP_WALLET_DISCONNECTED_KEY,
  connectAndVerifyWallet,
  getConnectedWalletAddress,
  getMetaMaskProvider,
  verifyWalletAddress,
} from "../utils/wallet";
import { WalletContext } from "./WalletContext";

export default function WalletProvider({ children }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [walletAddress, setWalletAddress] = useState("");
  const [savedWalletAddress, setSavedWalletAddress] = useState("");
  const [walletError, setWalletError] = useState("");
  const [isWalletBusy, setIsWalletBusy] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      return undefined;
    }

    let cancelled = false;
    const disconnected = window.localStorage.getItem(APP_WALLET_DISCONNECTED_KEY) === "1";

    async function syncWallet() {
      try {
        const nextAddress = disconnected ? "" : await getConnectedWalletAddress();
        if (!cancelled) {
          setWalletAddress(nextAddress);
        }
      } catch (err) {
        if (!cancelled) {
          setWalletError(err.message || "Wallet sync failed.");
        }
      }
    }

    syncWallet();

    let provider;
    try {
      provider = getMetaMaskProvider();
    } catch {
      return undefined;
    }

    function handleAccountsChanged(accounts) {
      const nextAddress = Array.isArray(accounts) && accounts[0] ? accounts[0] : "";
      if (!nextAddress) {
        window.localStorage.setItem(APP_WALLET_DISCONNECTED_KEY, "1");
      }
      if (window.localStorage.getItem(APP_WALLET_DISCONNECTED_KEY) === "1" && nextAddress) {
        return;
      }
      setWalletAddress(nextAddress);
      setWalletError("");
    }

    provider.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      cancelled = true;
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [isLoaded]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedWallet() {
      if (!isSignedIn) {
        setSavedWalletAddress("");
        return;
      }

      try {
        const me = await fetchMe();
        if (!cancelled) {
          setSavedWalletAddress(me.wallet_address || "");
        }
      } catch {
        if (!cancelled) {
          setSavedWalletAddress("");
        }
      }
    }

    loadSavedWallet();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  async function connectWallet() {
    setIsWalletBusy(true);
    setWalletError("");
    try {
      const nextAddress = isSignedIn
        ? await connectAndVerifyWallet()
        : await getConnectedWalletAfterRequest();
      window.localStorage.removeItem(APP_WALLET_DISCONNECTED_KEY);
      setWalletAddress(nextAddress);
      if (isSignedIn) {
        setSavedWalletAddress(nextAddress);
      }
      return nextAddress;
    } catch (err) {
      const message = err.code === 4001
        ? "Connection rejected. Please approve to continue."
        : err.message || "Wallet connection failed.";
      setWalletError(message);
      throw new Error(message);
    } finally {
      setIsWalletBusy(false);
    }
  }

  async function verifyWallet() {
    if (!walletAddress) {
      return connectWallet();
    }

    if (!isSignedIn) {
      throw new Error("Please sign in before verifying your wallet.");
    }

    setIsWalletBusy(true);
    setWalletError("");
    try {
      const verified = await verifyWalletAddress(walletAddress);
      setSavedWalletAddress(verified);
      return verified;
    } catch (err) {
      const message = err.code === 4001
        ? "Signature rejected. Please approve to continue."
        : err.message || "Wallet verification failed.";
      setWalletError(message);
      throw new Error(message);
    } finally {
      setIsWalletBusy(false);
    }
  }

  function disconnectWallet() {
    window.localStorage.setItem(APP_WALLET_DISCONNECTED_KEY, "1");
    setWalletAddress("");
    setWalletError("");
  }

  function clearWalletError() {
    setWalletError("");
  }

  const value = {
    walletAddress,
    savedWalletAddress,
    isWalletConnected: !!walletAddress,
    isWalletVerified: !!walletAddress && !!savedWalletAddress && walletAddress.toLowerCase() === savedWalletAddress.toLowerCase(),
    walletError,
    isWalletBusy,
    connectWallet,
    verifyWallet,
    disconnectWallet,
    clearWalletError,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

async function getConnectedWalletAfterRequest() {
  const provider = getMetaMaskProvider();
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const walletAddress = accounts?.[0] || "";
  if (!walletAddress) {
    throw new Error("No wallet account was returned by MetaMask.");
  }
  return walletAddress;
}
