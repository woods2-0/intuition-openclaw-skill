#!/usr/bin/env node
/**
 * intuition-stake.mjs - Stake FOR or AGAINST any triple
 *
 * Usage:
 *   node intuition-stake.mjs <triple_id> <amount> [--against] [--wallet <path>]
 *
 * Examples:
 *   node intuition-stake.mjs 0x<triple-id>... 0.5
 *   node intuition-stake.mjs 0x<triple-id>... 1.0 --against
 */

import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  multiVaultDeposit,
  multiVaultIsTriple,
  MultiVaultAbi,
} from '@0xintuition/protocol';
import fs from 'fs';

const DEFAULT_WALLET = process.env.INTUITION_WALLET_PATH || null;

function usage() {
  console.log(`
intuition-stake.mjs - Stake FOR or AGAINST any triple

Usage:
  node intuition-stake.mjs <triple_id> <amount> [options]

Options:
  --against         Stake AGAINST (uses counter-triple)
  --wallet <path>   Path to wallet JSON

Examples:
  node intuition-stake.mjs 0x<triple-id>... 0.5          # Stake 0.5 $TRUST FOR (example triple ID)
  node intuition-stake.mjs 0x<triple-id>... 1.0 --against # Stake 1.0 $TRUST AGAINST
`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
    usage();
  }

  const tripleId = args[0];
  const amount = args[1];
  const against = args.includes('--against');

  let walletPath = DEFAULT_WALLET;
  const walletIdx = args.indexOf('--wallet');
  if (walletIdx !== -1 && args[walletIdx + 1]) {
    walletPath = args[walletIdx + 1];
  }

  if (!tripleId.startsWith('0x') || tripleId.length !== 66) {
    console.error('Error: Invalid triple ID (must be 0x + 64 hex chars)');
    process.exit(1);
  }

  const stakeAmount = parseEther(amount);
  if (stakeAmount <= 0n) {
    console.error('Error: Amount must be positive');
    process.exit(1);
  }

  let account;
  if (walletPath && fs.existsSync(walletPath)) {
    const wallet = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    account = privateKeyToAccount(wallet.privateKey);
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

  console.log('Intuition Stake');
  console.log('===============');
  console.log('Wallet:', account.address);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('Balance:', formatEther(balance), '$TRUST');
  console.log('Triple:', tripleId);
  console.log('Amount:', amount, '$TRUST');
  console.log('Position:', against ? 'AGAINST' : 'FOR');

  const isTriple = await multiVaultIsTriple(
    { address: multiVaultAddress, publicClient },
    { args: [tripleId] }
  );
  if (!isTriple) {
    console.error('Error: Not a valid triple ID');
    process.exit(1);
  }

  let vaultId = tripleId;
  if (against) {
    vaultId = await publicClient.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'getCounterIdFromTripleId',
      args: [tripleId],
    });
    console.log('Counter-Triple:', vaultId);
  }

  console.log('--- Staking ---');

  const hash = await multiVaultDeposit(
    { address: multiVaultAddress, walletClient, publicClient },
    { args: [account.address, vaultId, 1n, 0n], value: stakeAmount }
  );

  console.log('TX:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Block:', receipt.blockNumber);
  console.log('Status:', receipt.status === 'success' ? 'Success' : 'Failed');

  const newBalance = await publicClient.getBalance({ address: account.address });
  console.log('New balance:', formatEther(newBalance), '$TRUST');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
