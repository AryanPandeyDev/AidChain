import { connectWallet as saveWalletConnection, fetchWalletNonce } from "../api/ngo";

const DEFAULT_CHAIN_ID = 137;
const DEFAULT_USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
export const APP_WALLET_DISCONNECTED_KEY = "aidchain_wallet_disconnected";

const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || DEFAULT_CHAIN_ID);
const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || DEFAULT_USDC_ADDRESS;

const APPROVE_SELECTOR = "095ea7b3";
const DONATE_SELECTOR = "f14faf6f";

export function getMetaMaskProvider() {
  const provider = window.ethereum;
  if (!provider) {
    throw new Error("MetaMask not detected. Please install MetaMask to continue.");
  }
  if (!provider.isMetaMask) {
    throw new Error("MetaMask is required for this action. Please enable the MetaMask extension.");
  }
  return provider;
}

export async function getConnectedWalletAddress() {
  const provider = getMetaMaskProvider();
  const accounts = await provider.request({ method: "eth_accounts" });
  return normalizeWalletAddress(accounts?.[0] || "");
}

export async function requestWalletAccount() {
  const provider = getMetaMaskProvider();
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  return normalizeWalletAddress(accounts?.[0] || "");
}

export async function verifyWalletAddress(walletAddress) {
  if (!walletAddress) {
    throw new Error("No wallet account was returned by MetaMask.");
  }

  const provider = getMetaMaskProvider();
  const normalized = normalizeWalletAddress(walletAddress);
  const { nonce, message } = await fetchWalletNonce();
  const signature = await provider.request({
    method: "personal_sign",
    params: [message, normalized],
  });

  await saveWalletConnection({
    wallet_address: normalized,
    signature,
    nonce,
  });

  return normalized;
}

export async function connectAndVerifyWallet() {
  const walletAddress = await requestWalletAccount();
  if (!walletAddress) {
    throw new Error("No wallet account was returned by MetaMask.");
  }

  return verifyWalletAddress(walletAddress);
}

export async function donateUSDCToPool({ poolAddress, amount, from }) {
  if (!poolAddress) {
    throw new Error("This pool does not have a deployed contract address yet.");
  }

  const provider = getMetaMaskProvider();
  const sender = normalizeWalletAddress(from || "");
  if (!sender) {
    throw new Error("No wallet account was returned by MetaMask.");
  }

  await ensureChain(provider);

  const amountOnChain = parseUSDC(amount);
  const approveHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: sender,
      to: USDC_ADDRESS,
      data: encodeApprove(poolAddress, amountOnChain),
    }],
  });
  await waitForTransaction(provider, approveHash);

  const donateHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: sender,
      to: poolAddress,
      data: encodeDonate(amountOnChain),
    }],
  });
  await waitForTransaction(provider, donateHash);

  return { approveHash, donateHash };
}

export function shortenWalletAddress(address) {
  const normalized = normalizeWalletAddress(address);
  if (!normalized) {
    return "";
  }
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

async function ensureChain(provider) {
  const currentChainId = await provider.request({ method: "eth_chainId" });
  const wanted = `0x${CHAIN_ID.toString(16)}`;
  if (currentChainId?.toLowerCase() === wanted.toLowerCase()) {
    return;
  }

  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: wanted }],
  });
}

async function waitForTransaction(provider, hash) {
  for (let i = 0; i < 60; i += 1) {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    });
    if (receipt) {
      if (receipt.status !== "0x1") {
        throw new Error(`Transaction failed: ${hash}`);
      }
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for transaction: ${hash}`);
}

function parseUSDC(value) {
  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(raw)) {
    throw new Error("Enter a valid USDC amount with up to 6 decimals.");
  }

  const [whole, fraction = ""] = raw.split(".");
  const units = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  if (units <= 0n) {
    throw new Error("Donation amount must be greater than zero.");
  }
  return units;
}

function normalizeWalletAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address) ? address : "";
}

function encodeApprove(spender, amount) {
  return `0x${APPROVE_SELECTOR}${encodeAddress(spender)}${encodeUint256(amount)}`;
}

function encodeDonate(amount) {
  return `0x${DONATE_SELECTOR}${encodeUint256(amount)}`;
}

function encodeAddress(address) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Invalid contract address.");
  }
  return address.slice(2).toLowerCase().padStart(64, "0");
}

function encodeUint256(value) {
  return value.toString(16).padStart(64, "0");
}
