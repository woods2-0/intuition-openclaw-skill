#!/usr/bin/env node
/**
 * intuition-quickstart-v3.mjs
 * Complete agent onboarding: wallet + identity atom + [Agent] [is] [AI Agent] triple + stake
 *
 * Usage: node intuition-quickstart-v3.mjs <agent_name> [stake_amount]
 * Example: node intuition-quickstart-v3.mjs MyAgent 0.5
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  stringToHex,
  decodeEventLog
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  multiVaultGetAtomCost,
  multiVaultGetTripleCost,
  multiVaultCreateAtoms,
  multiVaultCreateTriples,
  multiVaultDeposit,
  MultiVaultAbi,
} from '@0xintuition/protocol';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Known protocol atoms — see references/protocol-reference.md for full list
// These IDs are deterministic: calculateAtomId(stringToHex("is")) always returns the same value
const KNOWN_ATOMS = {
  'is': '0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1',
  'AI Agent': '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e',
};

const args = process.argv.slice(2);
const AGENT_NAME = args.find(a => !a.startsWith('--'));
const STAKE_AMOUNT = args[args.indexOf(AGENT_NAME) + 1] || '0.1';

if (!AGENT_NAME || args.includes('--help') || args.includes('-h')) {
  console.log('Intuition Agent Quickstart v3');
  console.log('============================');
  console.log('');
  console.log('Usage: node intuition-quickstart-v3.mjs <agent_name> [stake_amount]');
  console.log('');
  console.log('Examples:');
  console.log('  node intuition-quickstart-v3.mjs MyAgent 0.5');
  console.log('  node intuition-quickstart-v3.mjs MyBot');
  console.log('');
  console.log('This script will:');
  console.log('  1. Create a wallet (or use existing)');
  console.log('  2. Create identity atom: [AgentName]');
  console.log('  3. Create triple: [AgentName] [is] [AI Agent]');
  console.log('  4. Stake on the triple');
  console.log('');
  console.log('Requirements: ~2 $TRUST in wallet');
  process.exit(0);
}

// Validate agent name (prevent path traversal)
if (!/^[a-zA-Z0-9_-]+$/.test(AGENT_NAME)) {
  console.error('Error: Agent name can only contain letters, numbers, hyphens, and underscores');
  process.exit(1);
}

// Validate stake amount
const stakeFloat = parseFloat(STAKE_AMOUNT);
if (isNaN(stakeFloat) || !isFinite(stakeFloat) || stakeFloat <= 0) {
  console.error('Error: Stake amount must be a positive number');
  process.exit(1);
}

const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
const walletDir = join(homeDir, `.intuition-wallet-${AGENT_NAME}`);
const walletFile = join(walletDir, 'wallet.json');
const outputFile = join(walletDir, 'identity.json');

async function main() {
  console.log('');
  console.log('Intuition Agent Quickstart v3');
  console.log('================================');
  console.log(`Agent: ${AGENT_NAME}`);
  console.log(`Stake: ${STAKE_AMOUNT} $TRUST`);

  // Step 1: Wallet
  let privateKey, address;

  if (existsSync(walletFile)) {
    console.log('Loading existing wallet...');
    const wallet = JSON.parse(readFileSync(walletFile, 'utf8'));
    privateKey = wallet.privateKey;
    address = wallet.address;
    console.log(`   Address: ${address}`);
  } else {
    console.log('Creating new wallet...');
    mkdirSync(walletDir, { recursive: true, mode: 0o700 });
    privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    address = account.address;

    const wallet = {
      address,
      privateKey,
      created: new Date().toISOString(),
      chain: 'intuition-mainnet',
      chainId: intuitionMainnet.id,
    };

    writeFileSync(walletFile, JSON.stringify(wallet, null, 2), { mode: 0o600 });
    console.log(`   Created: ${address}`);
    console.log(`   Saved to: ${walletFile}`);
  }

  const account = privateKeyToAccount(privateKey);

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

  // Check balance
  console.log('Checking balance...');
  const balance = await publicClient.getBalance({ address });
  const balanceEth = formatEther(balance);
  console.log(`   Balance: ${balanceEth} $TRUST`);

  const atomCost = await multiVaultGetAtomCost({ address: multiVaultAddress, publicClient });
  const tripleCost = await multiVaultGetTripleCost({ address: multiVaultAddress, publicClient });
  const totalNeeded = atomCost + tripleCost + BigInt(Math.floor(parseFloat(STAKE_AMOUNT) * 1e18));

  console.log(`   Atom cost: ${formatEther(atomCost)} $TRUST`);
  console.log(`   Triple cost: ${formatEther(tripleCost)} $TRUST`);
  console.log(`   Stake amount: ${STAKE_AMOUNT} $TRUST`);
  console.log(`   Total needed: ~${formatEther(totalNeeded)} $TRUST`);

  if (balance < totalNeeded) {
    console.log(`Insufficient balance! Need ${formatEther(totalNeeded - balance)} more $TRUST`);
    console.log(`  1. Bridge $TRUST from Base: https://app.intuition.systems/bridge`);
    console.log(`  2. Send to: ${address}`);
    console.log(`  3. Re-run this script`);
    console.log(`  See SKILL.md → "How to Get $TRUST" for step-by-step instructions`);

    const output = {
      agent: AGENT_NAME,
      wallet: address,
      status: 'needs_funding',
      balanceNeeded: formatEther(totalNeeded - balance),
      created: new Date().toISOString(),
    };
    writeFileSync(outputFile, JSON.stringify(output, null, 2));
    process.exit(0);
  }

  // Step 2: Create identity atom
  console.log(`Creating identity atom: [${AGENT_NAME}]...`);

  const atomData = [stringToHex(AGENT_NAME)];
  const atomAssets = [atomCost];

  const atomTx = await multiVaultCreateAtoms(
    { address: multiVaultAddress, walletClient, publicClient },
    { args: [atomData, atomAssets], value: atomCost }
  );

  console.log(`   TX: ${atomTx}`);

  const atomReceipt = await publicClient.waitForTransactionReceipt({ hash: atomTx });
  console.log(`   Block: ${atomReceipt.blockNumber}`);

  let agentAtomId = null;
  for (const log of atomReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: MultiVaultAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'AtomCreated') {
        agentAtomId = decoded.args.termId;
        console.log(`   Atom ID: ${agentAtomId}`);
      }
    } catch (e) {}
  }

  if (!agentAtomId) {
    console.log('   Failed to extract atom ID');
    process.exit(1);
  }

  // Step 3: Create triple [Agent] [is] [AI Agent]
  console.log(`Creating triple: [${AGENT_NAME}] [is] [AI Agent]...`);

  const subjects = [agentAtomId];
  const predicates = [KNOWN_ATOMS['is']];
  const objects = [KNOWN_ATOMS['AI Agent']];
  const tripleAssets = [tripleCost];

  const tripleTx = await multiVaultCreateTriples(
    { address: multiVaultAddress, walletClient, publicClient },
    { args: [subjects, predicates, objects, tripleAssets], value: tripleCost }
  );

  console.log(`   TX: ${tripleTx}`);

  const tripleReceipt = await publicClient.waitForTransactionReceipt({ hash: tripleTx });
  console.log(`   Block: ${tripleReceipt.blockNumber}`);

  let tripleId = null;
  for (const log of tripleReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: MultiVaultAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'TripleCreated') {
        tripleId = decoded.args.termId;
        console.log(`   Triple ID: ${tripleId}`);
      }
    } catch (e) {}
  }

  if (!tripleId) {
    console.log('   Failed to extract triple ID');
    process.exit(1);
  }

  // Step 4: Stake on the triple
  console.log(`Staking ${STAKE_AMOUNT} $TRUST on triple...`);

  const stakeValue = BigInt(Math.floor(parseFloat(STAKE_AMOUNT) * 1e18));

  const stakeTx = await multiVaultDeposit(
    { address: multiVaultAddress, walletClient, publicClient },
    { args: [address, tripleId], value: stakeValue }
  );

  console.log(`   TX: ${stakeTx}`);

  const stakeReceipt = await publicClient.waitForTransactionReceipt({ hash: stakeTx });
  console.log(`   Block: ${stakeReceipt.blockNumber}`);
  console.log(`   Staked!`);

  // Final balance
  const finalBalance = await publicClient.getBalance({ address });

  // Save output
  const output = {
    agent: AGENT_NAME,
    wallet: address,
    status: 'complete',
    identity: { atomId: agentAtomId, atomTx },
    triple: {
      id: tripleId, tx: tripleTx,
      subject: AGENT_NAME, predicate: 'is', object: 'AI Agent',
    },
    stake: { amount: STAKE_AMOUNT, tx: stakeTx },
    network: {
      name: 'Intuition Mainnet',
      chainId: intuitionMainnet.id,
      multiVault: multiVaultAddress,
    },
    balance: formatEther(finalBalance),
    created: new Date().toISOString(),
  };

  writeFileSync(outputFile, JSON.stringify(output, null, 2));

  console.log('');
  console.log('IDENTITY COMPLETE!');
  console.log(`Agent: ${AGENT_NAME}`);
  console.log(`Wallet: ${address}`);
  console.log(`Balance: ${formatEther(finalBalance)} $TRUST`);
  console.log(`Atom ID: ${agentAtomId}`);
  console.log(`Triple ID: ${tripleId}`);
  console.log(`Claim: [${AGENT_NAME}] [is] [AI Agent]`);
  console.log(`Stake: ${STAKE_AMOUNT} $TRUST`);
  console.log(`Output: ${outputFile}`);
  console.log(`${AGENT_NAME} is now registered as an AI Agent on Intuition!`);
}

main().catch(err => {
  const msg = (err.message || '').replace(/0x[a-fA-F0-9]{64}/g, '0x[REDACTED]');
  console.error('Error:', msg);
  process.exit(1);
});
