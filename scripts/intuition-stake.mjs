#!/usr/bin/env node
/**
 * intuition-stake.mjs - Stake $TRUST on any atom or triple
 *
 * Usage:
 *   node intuition-stake.mjs <term_id> <amount> [options]
 *
 * Works with both atoms (signal relevance) and triples (signal agreement/disagreement).
 * For triples, use --against to stake on the counter-triple (disagreement).
 */

import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  multiVaultDeposit,
  MultiVaultAbi,
} from '@0xintuition/protocol';

function usage() {
  console.log(`
intuition-stake.mjs - Stake $TRUST on any atom or triple

Usage:
  node intuition-stake.mjs <term_id> <amount> [options]

Options:
  --against         Stake AGAINST (triples only — uses counter-triple vault)
  --wallet <path>   Path to wallet JSON file

Examples:
  node intuition-stake.mjs 0x<atom-id> 0.5                # Stake on an atom (signal relevance)
  node intuition-stake.mjs 0x<triple-id> 1.0               # Stake FOR a claim
  node intuition-stake.mjs 0x<triple-id> 0.5 --against     # Stake AGAINST a claim

Environment:
  INTUITION_PRIVATE_KEY    Wallet private key (required if no --wallet)
  INTUITION_WALLET_PATH    Default wallet JSON path
`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
    usage();
  }

  const termId = args[0];
  const amount = args[1];
  const against = args.includes('--against');

  let walletPath = process.env.INTUITION_WALLET_PATH || null;
  const walletIdx = args.indexOf('--wallet');
  if (walletIdx !== -1 && args[walletIdx + 1]) {
    walletPath = args[walletIdx + 1];
  }

  if (!termId.startsWith('0x') || termId.length !== 66) {
    console.error('Error: Invalid term ID (must be 0x + 64 hex chars)');
    process.exit(1);
  }

  const stakeAmount = parseEther(amount);
  if (stakeAmount <= 0n) {
    console.error('Error: Amount must be positive');
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

  console.log('Intuition Stake');
  console.log('===============');
  console.log('Wallet:', account.address);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('Balance:', formatEther(balance), '$TRUST');
  console.log('Term ID:', termId);
  console.log('Type:', isTriple ? 'Triple (claim)' : 'Atom (identity/concept)');
  console.log('Amount:', amount, '$TRUST');

  if (against && !isTriple) {
    console.error('Error: --against only works for triples. Atoms don\'t have counter-vaults.');
    process.exit(1);
  }

  if (against) {
    console.log('Position: AGAINST');
  } else {
    console.log('Position:', isTriple ? 'FOR' : 'DEPOSIT');
  }

  let vaultId = termId;
  if (against) {
    vaultId = await publicClient.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'getCounterIdFromTripleId',
      args: [termId],
    });
    console.log('Counter-Triple:', vaultId);
  }

  if (balance < stakeAmount) {
    console.error(`Insufficient balance. Need ${amount} $TRUST but have ${formatEther(balance)}`);
    console.error('Bridge from Base: https://app.intuition.systems/bridge');
    process.exit(1);
  }

  console.log('\n--- Staking ---');

  const hash = await multiVaultDeposit(
    { address: multiVaultAddress, walletClient, publicClient },
    { args: [account.address, vaultId], value: stakeAmount }
  );

  console.log('TX:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Block:', receipt.blockNumber);
  console.log('Status:', receipt.status === 'success' ? '\u2713 Success' : '\u2717 Failed');

  const newBalance = await publicClient.getBalance({ address: account.address });
  console.log('New balance:', formatEther(newBalance), '$TRUST');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
