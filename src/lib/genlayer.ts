import { createClient } from "genlayer-js";
import { localnet, testnetBradbury, studioDevnet } from "genlayer-js/chains";

type GenLayerClient = ReturnType<typeof createClient>;

// Studio Next requires genlayer-js v2's explicit fees API (see
// estimateAndAttachFees below) - it has no automatic fee estimation the way
// Bradbury (v1) did. This app targets Studio Next by default, matching the
// live Covenant Sentinel v2 deployment - see the repo's MILESTONE.md.
const CHAIN_NAME = process.env.NEXT_PUBLIC_GENLAYER_CHAIN ?? "studionext";

export const chain =
  CHAIN_NAME === "localnet" ? localnet : CHAIN_NAME === "bradbury" ? testnetBradbury : studioDevnet;

const EXPLORER_URL =
  CHAIN_NAME === "bradbury" ? "https://explorer-bradbury.genlayer.com" : "https://explorer-studio-dev.genlayer.com";

// Studio Next's writeContract/deployContract calls fail with
// "FeesDistributionMissing" unless fees are computed and attached
// explicitly - confirmed directly against the live network, not from docs.
export async function estimateAndAttachFees(client: GenLayerClient) {
  const fees = await (client as any).estimateTransactionFees({});
  return { distribution: fees.distribution, feeValue: fees.feeValue };
}

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";

export function getReadClient(): GenLayerClient {
  return createClient({ chain });
}

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function getBrowserProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export function getWriteClient(account: `0x${string}`): GenLayerClient {
  const provider = getBrowserProvider();
  return createClient({ chain, account, provider: provider ?? undefined });
}

// The wallet has no reason to already be on chain 61997 - it's a devnet
// almost nobody has pre-configured, unlike a well-known mainnet. Without
// this, writeContract silently targets whatever chain the wallet happens
// to be on, which fails confusingly rather than telling the user what's
// wrong. wallet_switchEthereumChain fails with code 4902 when the chain
// was never added; wallet_addEthereumChain both adds and switches to it.
const CHAIN_ID_HEX = `0x${chain.id.toString(16)}`;

async function ensureCorrectChain(provider: EthereumProvider): Promise<void> {
  const currentChainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (currentChainId?.toLowerCase() === CHAIN_ID_HEX.toLowerCase()) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_ID_HEX,
          chainName: chain.name,
          rpcUrls: chain.rpcUrls.default.http,
          nativeCurrency: chain.nativeCurrency,
          blockExplorerUrls: [EXPLORER_URL],
        },
      ],
    });
  }
}

export async function requestWalletAccount(): Promise<`0x${string}` | null> {
  const provider = getBrowserProvider();
  if (!provider) return null;
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const account = (accounts[0] as `0x${string}`) ?? null;
  if (account) await ensureCorrectChain(provider);
  return account;
}
