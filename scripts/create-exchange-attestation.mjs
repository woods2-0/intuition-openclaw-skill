#!/usr/bin/env node
/**
 * create-exchange-attestation.mjs
 * Creates on-chain trust attestation for an agent exchange
 *
 * Creates:
 *   1. Exchange atom (e.g., "Agent1Agent2Exchange") with hash in data
 *   2. participatesIn predicate atom (if needed)
 *   3. [Agent1][participatesIn][Exchange] triple
 *   4. [Agent2][participatesIn][Exchange] triple
 *
 * Usage:
 *   node create-exchange-attestation.mjs --agent1 <name> --agent2 <name> [--hash 0x...] [--dry-run]
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  stringToHex,
  decodeEventLog
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  multiVaultGetAtomCost,
  multiVaultGetTripleCost,
  multiVaultCreateAtoms,
  multiVaultCreateTriples,
  MultiVaultAbi,
} from '@0xintuition/protocol';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRegistry() {
  const registryPath = join(__dirname, '..', 'agent-registry.json');
  try {
    return JSON.parse(readFileSync(registryPath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error('No agent-registry.json found. Copy agent-registry.example.json and fill in your agent data.');
      console.error('  cp agent-registry.example.json agent-registry.json');
      process.exit(1);
    }
    throw e;
  }
}

// Parse CLI args
const args = process.argv.slice(2);
let agent1Name = null;
let agent2Name = null;
let exchangeHash = null;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--agent1' && args[i + 1]) agent1Name = args[++i];
  else if (args[i] === '--agent2' && args[i + 1]) agent2Name = args[++i];
  else if (args[i] === '--hash' && args[i + 1]) exchangeHash = args[++i];
  else if (args[i] === '--dry-run') dryRun = true;
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
create-exchange-attestation.mjs - Create on-chain exchange attestation

Usage:
  node create-exchange-attestation.mjs --agent1 <name> --agent2 <name> [--hash 0x...] [--dry-run]

Options:
  --agent1 <name>   First agent name (must be in agent-registry.json)
  --agent2 <name>   Second agent name (must be in agent-registry.json)
  --hash <0x...>    Exchange hash (from exchange-hash.mjs)
  --dry-run         Show what would be created without submitting transactions

Requires INTUITION_PRIVATE_KEY environment variable.
`);
    process.exit(0);
  }
}

if (!agent1Name || !agent2Name) {
  console.error('Error: Need --agent1 and --agent2. Run with --help for usage.');
  process.exit(1);
}

const registry = loadRegistry();

// Look up agent atom IDs from registry
const agent1Data = registry.agents?.[agent1Name];
const agent2Data = registry.agents?.[agent2Name];

if (!agent1Data?.atomId) {
  console.error(`Error: Agent "${agent1Name}" not found in agent-registry.json or missing atomId.`);
  process.exit(1);
}
if (!agent2Data?.atomId) {
  console.error(`Error: Agent "${agent2Name}" not found in agent-registry.json or missing atomId.`);
  process.exit(1);
}

const privateKey = process.env.INTUITION_PRIVATE_KEY;
if (!privateKey && !dryRun) {
  console.error('Error: INTUITION_PRIVATE_KEY environment variable required.');
  process.exit(1);
}

async function main() {
  console.log('Creating Exchange Attestation');
  console.log(`Exchange: ${agent1Name} <-> ${agent2Name}`);
  if (exchangeHash) console.log(`Hash: ${exchangeHash}`);

  if (dryRun) {
    const exchangeName = `${agent1Name}${agent2Name}Exchange${exchangeHash ? ':' + exchangeHash.slice(0, 18) : ''}`;
    console.log(`\nDRY RUN - Would create:`);
    console.log(`  Exchange atom: "${exchangeName}"`);
    console.log(`  [${agent1Name}][participatesIn][Exchange]`);
    console.log(`  [${agent2Name}][participatesIn][Exchange]`);
    console.log(`  Agent1 atom: ${agent1Data.atomId}`);
    console.log(`  Agent2 atom: ${agent2Data.atomId}`);
    return;
  }

  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: intuitionMainnet, transport: http('https://rpc.intuition.systems/http'),
  });

  const walletClient = createWalletClient({
    account, chain: intuitionMainnet, transport: http('https://rpc.intuition.systems/http'),
  });

  const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);

  console.log(`Wallet: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${formatEther(balance)} $TRUST`);

  const atomCost = await multiVaultGetAtomCost({ address: multiVaultAddress, publicClient });
  const tripleCost = await multiVaultGetTripleCost({ address: multiVaultAddress, publicClient });
  const totalNeeded = atomCost * 2n + tripleCost * 2n;

  if (balance < totalNeeded) {
    console.log(`Insufficient balance. Need ${formatEther(totalNeeded - balance)} more $TRUST`);
    process.exit(1);
  }

  // Step 1: Create Exchange Atom
  const exchangeName = `${agent1Name}${agent2Name}Exchange${exchangeHash ? ':' + exchangeHash.slice(0, 18) : ''}`;
  console.log(`Creating atom: "${exchangeName}"`);

  const atomTx = await multiVaultCreateAtoms(
    { address: multiVaultAddress, walletClient, publicClient },
    { args: [[stringToHex(exchangeName)], [atomCost]], value: atomCost }
  );

  const atomReceipt = await publicClient.waitForTransactionReceipt({ hash: atomTx });
  let exchangeAtomId = null;
  for (const log of atomReceipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: MultiVaultAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === 'AtomCreated') exchangeAtomId = decoded.args.termId;
    } catch (e) {}
  }

  // Step 2: Create "participatesIn" Predicate Atom
  const predicateTx = await multiVaultCreateAtoms(
    { address: multiVaultAddress, walletClient, publicClient },
    { args: [[stringToHex('participatesIn')], [atomCost]], value: atomCost }
  );

  const predicateReceipt = await publicClient.waitForTransactionReceipt({ hash: predicateTx });
  let participatesInAtomId = null;
  for (const log of predicateReceipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: MultiVaultAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === 'AtomCreated') participatesInAtomId = decoded.args.termId;
    } catch (e) {}
  }

  // Step 3: Create Triples
  const tripleTx = await multiVaultCreateTriples(
    { address: multiVaultAddress, walletClient, publicClient },
    {
      args: [
        [agent1Data.atomId, agent2Data.atomId],
        [participatesInAtomId, participatesInAtomId],
        [exchangeAtomId, exchangeAtomId],
        [tripleCost, tripleCost]
      ],
      value: tripleCost * 2n
    }
  );

  const tripleReceipt = await publicClient.waitForTransactionReceipt({ hash: tripleTx });
  const tripleIds = [];
  for (const log of tripleReceipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: MultiVaultAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === 'TripleCreated') tripleIds.push(decoded.args.termId);
    } catch (e) {}
  }

  console.log('EXCHANGE ATTESTATION COMPLETE');
  console.log(`  Exchange Atom: ${exchangeAtomId}`);
  console.log(`  participatesIn: ${participatesInAtomId}`);
  console.log(`  [${agent1Name}][participatesIn][Exchange]: ${tripleIds[0]}`);
  console.log(`  [${agent2Name}][participatesIn][Exchange]: ${tripleIds[1]}`);

  const result = {
    exchange: { name: exchangeName, atomId: exchangeAtomId, hash: exchangeHash },
    predicate: { name: 'participatesIn', atomId: participatesInAtomId },
    triples: { agent1Participates: tripleIds[0], agent2Participates: tripleIds[1] },
    transactions: { exchangeAtom: atomTx, predicateAtom: predicateTx, triples: tripleTx },
    agents: { agent1: agent1Name, agent2: agent2Name },
    created: new Date().toISOString(),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
