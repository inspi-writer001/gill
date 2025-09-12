import type {
  Rpc,
  RpcSubscriptions,
  KeyPairSigner,
  Signature,
  SendTransactionApi,
  GetLatestBlockhashApi,
  GetSignatureStatusesApi,
  GetEpochInfoApi,
  SignatureNotificationsApi,
  SlotNotificationsApi,
  Commitment,
  CompilableTransactionMessage,
  FullySignedTransaction,
  TransactionWithBlockhashLifetime,
  BaseTransactionMessage,
  TransactionMessageWithFeePayer,
} from "@solana/kit";

import { createSolanaClient, type SolanaClusterMoniker, type SolanaClient } from "gill";

import { loadKeypairSignerFromFile } from "gill/node";

/**
 * Transaction types that can be sent
 */
type SendableTransaction =
  | CompilableTransactionMessage
  | (FullySignedTransaction & TransactionWithBlockhashLifetime)
  | (BaseTransactionMessage & TransactionMessageWithFeePayer);

/**
 * Configuration options for the provider
 */
export interface GillProviderOptions {
  commitment?: Commitment;
  skipPreflight?: boolean;
  maxRetries?: number;
}

/**
 * Default provider options
 */
export const DEFAULT_PROVIDER_OPTIONS: GillProviderOptions = {
  commitment: "confirmed",
  skipPreflight: false,
  maxRetries: 3,
};

/**
 * Gill Provider - organizes Gill's client patterns for Anchor-style usage
 */
export interface GillProvider {
  // Core Gill client components
  rpc: Rpc<GetEpochInfoApi & GetSignatureStatusesApi & SendTransactionApi & GetLatestBlockhashApi>;
  rpcSubscriptions: RpcSubscriptions<SignatureNotificationsApi & SlotNotificationsApi>;

  // Signer (optional - for read-only providers)
  wallet?: KeyPairSigner;

  // Provider options
  opts: GillProviderOptions;

  // Main methods
  sendAndConfirmTransaction: (transaction: SendableTransaction) => Promise<Signature>;
  simulateTransaction: (transaction: SendableTransaction) => Promise<any>;
}

/**
 * Create a Gill provider with a keypair signer from filesystem
 */
export async function createProviderWithKeypair(
  urlOrMoniker: SolanaClusterMoniker | string,
  keypairPath?: string,
  options: GillProviderOptions = DEFAULT_PROVIDER_OPTIONS,
): Promise<GillProvider> {
  const wallet = await loadKeypairSignerFromFile(keypairPath);
  const client = createSolanaClient({ urlOrMoniker });

  return {
    rpc: client.rpc,
    rpcSubscriptions: client.rpcSubscriptions,
    wallet,
    opts: { ...DEFAULT_PROVIDER_OPTIONS, ...options },
    sendAndConfirmTransaction: client.sendAndConfirmTransaction,
    simulateTransaction: client.simulateTransaction,
  };
}

/**
 * Create a read-only Gill provider (no wallet/signer)
 */
export function createReadOnlyProvider(
  urlOrMoniker: SolanaClusterMoniker | string,
  options: GillProviderOptions = DEFAULT_PROVIDER_OPTIONS,
): GillProvider {
  const client = createSolanaClient({ urlOrMoniker });

  return {
    rpc: client.rpc,
    rpcSubscriptions: client.rpcSubscriptions,
    wallet: undefined,
    opts: { ...DEFAULT_PROVIDER_OPTIONS, ...options },
    sendAndConfirmTransaction: client.sendAndConfirmTransaction,
    simulateTransaction: client.simulateTransaction,
  };
}

/**
 * Create a Gill provider with an existing KeyPairSigner
 */
export function createProviderWithSigner(
  urlOrMoniker: SolanaClusterMoniker | string,
  wallet: KeyPairSigner,
  options: GillProviderOptions = DEFAULT_PROVIDER_OPTIONS,
): GillProvider {
  const client = createSolanaClient({ urlOrMoniker });

  return {
    rpc: client.rpc,
    rpcSubscriptions: client.rpcSubscriptions,
    wallet,
    opts: { ...DEFAULT_PROVIDER_OPTIONS, ...options },
    sendAndConfirmTransaction: client.sendAndConfirmTransaction,
    simulateTransaction: client.simulateTransaction,
  };
}

/**
 * Global provider management (similar to Anchor's setProvider/getProvider)
 */
let _globalProvider: GillProvider | undefined;

export function setProvider(provider: GillProvider): void {
  _globalProvider = provider;
}

export function getProvider(): GillProvider {
  if (!_globalProvider) {
    throw new Error("No global provider set. Use setProvider() first or create a provider explicitly.");
  }
  return _globalProvider;
}

export function hasProvider(): boolean {
  return _globalProvider !== undefined;
}
