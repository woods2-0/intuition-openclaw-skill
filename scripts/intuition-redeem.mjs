#!/usr/bin/env node
/**
 * intuition-redeem.mjs - Redeem (unstake) shares from an Intuition vault
 *
 * Usage:
 *   node intuition-redeem.mjs <term_id> <share_amount|"all"> [options]
 *
 * Redeems shares from atom or triple vaults, returning $TRUST to your wallet.
 * Automatically detects whether the term is an atom or triple and calls
 * the appropriate contract method.
 *
 * Examples:
 *   node intuition-redeem.mjs 0x<atom-id> all              # Redeem all shares from an atom
 *   node intuition-redeem.mjs 0x<triple-id> 500000000      # Redeem specific shares from a triple
 *   node intuition-redeem.mjs 0x<atom-id> all --wallet k.json
 *
 * Environment:
 *   INTUITION_PRIVATE_KEY    Wallet private key (required if no --wallet)
 *   INTUITION_WALLET_PATH    Default wallet JSON path
 */

import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  MultiVaultAbi,
} from '@0xintuition/protocol';

function usage(exitCode = 1) {
  console.log(`
intuition-redeem.mjs - Redeem (unstake) shares from an Intuition vault

Usage:
  node intuition-redeem.mjs <term_id> <share_amount|"all"> [options]

Options:
  --wallet <path>   Path to wallet JSON file

Examples:
  node intuition-redeem.mjs 0x<atom-id> all              # Redeem all shares from an atom
  node intuition-redeem.mjs 0x<triple-id> 500000000      # Redeem specific share amount from a triple
  node intuition-redeem.mjs 0x<atom-id> all --wallet k.json

Environment:
  INTUITION_PRIVATE_KEY    Wallet private key (required if no --wallet)
  INTUITION_WALLET_PATH    Default wallet JSON path
`);
  process.exit(exitCode);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage(0);
  }
  if (args.length < 2) {
    usage(1);
  }

  const termId = args[0];
  const shareArg = args[1];

  let walletPath = process.env.INTUITION_WALLET_PATH || null;
  const walletIdx = args.indexOf('--wallet');
  if (walletIdx !== -1 && args[walletIdx + 1]) {
    walletPath = args[walletIdx + 1];
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(termId)) {
    console.error('Error: Invalid term ID (must be 0x + 64 hex chars)');
    process.exit(1);
  }

  let account;
  if (walletPath) {
    const { readFileSync, existsSync } = await import('fs');
    if (existsSync(walletPath)) {
      const wallet = JSON.parse(readFileSync(walletPath, 'utf8'));
      account = privateKeyToAccount(wallet.privateKey);
    } else {
      console.error(`Error: Wallet file not found: ${walletPath}`);
      process.exit(1);
    }
  } else if (process.env.INTUITION_PRIVATE_KEY) {
    account = privateKeyToAccount(process.env.INTUITION_PRIVATE_KEY);
  } else {
    console.error('Error: No wallet found. Set INTUITION_PRIVATE_KEY env var or use --wallet <path>');
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain: intuitionMainnet,
    transport: http('https://rpc.intuition.systems/http'),
  });

  const walletClient = createWalletClient({
    chain: intuitionMainnet,
    transport: http('https://rpc.intuition.systems/http'),
    account,
  });

  const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);

  // Check if term exists
  const exists = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'isTermCreated',
    args: [termId],
  });

  if (!exists) {
    console.error('Error: Term ID not found on-chain. Check the ID and try again.');
    process.exit(1);
  }

  // Determine if it's an atom or triple
  const isTriple = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'isTriple',
    args: [termId],
  });

  // Get current position
  const maxShares = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'maxRedeem',
    args: [account.address, termId],
  });

  if (maxShares === 0n) {
    console.error('Error: You have no shares in this vault. Nothing to redeem.');
    process.exit(1);
  }

  // Determine shares to redeem
  let sharesToRedeem;
  if (shareArg.toLowerCase() === 'all') {
    sharesToRedeem = maxShares;
  } else {
    sharesToRedeem = BigInt(shareArg);
    if (sharesToRedeem <= 0n) {
      console.error('Error: Share amount must be positive');
      process.exit(1);
    }
    if (sharesToRedeem > maxShares) {
      console.error(`Error: Cannot redeem ${sharesToRedeem} shares. Max redeemable: ${maxShares}`);
      process.exit(1);
    }
  }

  // Get current value of shares
  const currentValue = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'convertToAssets',
    args: [maxShares, termId],
  });

  const sharePrice = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'currentSharePrice',
    args: [termId],
  });

  // Pre-compute expected $TRUST for the shares being redeemed
  const expectedValue = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'convertToAssets',
    args: [sharesToRedeem, termId],
  });

  console.log('Intuition Redeem');
  console.log('================');
  console.log('Term ID:', termId);
  console.log('Type:', isTriple ? 'Triple' : 'Atom');
  console.log('Shares held:', maxShares.toString());
  console.log('Current value:', formatEther(currentValue), '$TRUST');
  console.log('Share price:', formatEther(sharePrice), '$TRUST');

  // curveId: 0 = atom vault, 1 = triple FOR vault
  const curveId = isTriple ? 1n : 0n;

  console.log(`\nRedeeming ${sharesToRedeem.toString()} shares...`);

  const hash = await walletClient.writeContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'redeem',
    args: [account.address, termId, curveId, sharesToRedeem, 0n],
  });

  console.log('  TX:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('  Block:', receipt.blockNumber);

  if (receipt.status !== 'success') {
    console.error('  Status: \u2717 Failed');
    process.exit(1);
  }

  console.log('  Received:', formatEther(expectedValue), '$TRUST');

  console.log(`\nDone! Redeemed ${formatEther(expectedValue)} $TRUST from term ${termId}`);
}

main().catch(err => {
  const msg = (err.message || '').replace(/0x[a-fA-F0-9]{64}/g, '0x[REDACTED]');
  console.error('Error:', msg);
  process.exit(1);
});
