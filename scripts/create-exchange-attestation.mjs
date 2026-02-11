#!/usr/bin/env node
/**
 * create-exchange-attestation.mjs
 * Creates on-chain trust attestation for an agent exchange
 *
 * Creates:
 *   1. Exchange atom (e.g., "Agent1Agent2Exchange") with hash in data
 *   2. participatesIn predicate atom (or reuses existing)
 *   3. [Agent1][participatesIn][Exchange] triple
 *   4. [Agent2][participatesIn][Exchange] triple
 *
 * Usage:
 *   node create-exchange-attestation.mjs --name1 "AgentA" --name2 "AgentB" [--hash 0x...] [--dry-run]
 *   node create-exchange-attestation.mjs --atom1 0x<id> --atom2 0x<id> [--hash 0x...] [--dry-run]
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  stringToHex,
  toHex,
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

// Parse CLI args
const args = process.argv.slice(2);
let name1 = null, name2 = null;
let atom1Id = null, atom2Id = null;
let exchangeHash = null;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name1' && args[i + 1]) name1 = args[++i];
  else if (args[i] === '--name2' && args[i + 1]) name2 = args[++i];
  else if (args[i] === '--atom1' && args[i + 1]) atom1Id = args[++i];
  else if (args[i] === '--atom2' && args[i + 1]) atom2Id = args[++i];
  else if (args[i] === '--hash' && args[i + 1]) exchangeHash = args[++i];
  else if (args[i] === '--dry-run') dryRun = true;
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
create-exchange-attestation.mjs - Create on-chain exchange attestation

Usage:
  node create-exchange-attestation.mjs --name1 "AgentA" --name2 "AgentB" [options]
  node create-exchange-attestation.mjs --atom1 0x<id> --atom2 0x<id> [options]

Options:
  --name1 <name>   First agent name (resolved via calculateAtomId)
  --name2 <name>   Second agent name (resolved via calculateAtomId)
  --atom1 <0x...>  First agent atom ID (use instead of --name1)
  --atom2 <0x...>  Second agent atom ID (use instead of --name2)
  --hash <0x...>   Exchange hash (from exchange-hash.mjs)
  --dry-run        Show what would be created without submitting transactions

Requires INTUITION_PRIVATE_KEY environment variable.
`);
    process.exit(0);
  }
}

if ((!name1 && !atom1Id) || (!name2 && !atom2Id)) {
  console.error('Error: Need --name1/--atom1 and --name2/--atom2. Run with --help for usage.');
  process.exit(1);
}

const privateKey = process.env.INTUITION_PRIVATE_KEY;
if (!privateKey && !dryRun) {
  console.error('Error: INTUITION_PRIVATE_KEY environment variable required.');
  process.exit(1);
}

async function resolveAtomId(publicClient, multiVaultAddress, name, providedId) {
  if (providedId) return providedId;

  // Calculate atom ID from name
  const atomId = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'calculateAtomId',
    args: [toHex(name)],
  });

  const exists = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'isTermCreated',
    args: [atomId],
  });

  if (!exists) {
    console.error(`Error: Atom for "${name}" not found on-chain. Create it first with intuition-quickstart-v3.mjs`);
    process.exit(1);
  }

  return atomId;
}

async function main() {
  const label1 = name1 || `atom:${atom1Id.slice(0, 12)}...`;
  const label2 = name2 || `atom:${atom2Id.slice(0, 12)}...`;

  console.log('Creating Exchange Attestation');
  console.log(`Exchange: ${label1} <-> ${label2}`);
  if (exchangeHash) console.log(`Hash: ${exchangeHash}`);

  const publicClient = createPublicClient({
    chain: intuitionMainnet,
    transport: http('https://rpc.intuition.systems/http'),
  });

  const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);

  // Resolve atom IDs
  const agent1AtomId = await resolveAtomId(publicClient, multiVaultAddress, name1, atom1Id);
  const agent2AtomId = await resolveAtomId(publicClient, multiVaultAddress, name2, atom2Id);

  console.log(`Agent 1 atom: ${agent1AtomId}`);
  console.log(`Agent 2 atom: ${agent2AtomId}`);

  const exchangeName = `${label1}${label2}Exchange${exchangeHash ? ':' + exchangeHash.slice(0, 18) : ''}`;

  if (dryRun) {
    console.log(`\nDRY RUN - Would create:`);
    console.log(`  Exchange atom: "${exchangeName}"`);
    console.log(`  [${label1}][participatesIn][Exchange]`);
    console.log(`  [${label2}][participatesIn][Exchange]`);
    return;
  }

  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain: intuitionMainnet,
    transport: http('https://rpc.intuition.systems/http'),
  });

  console.log(`Wallet: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${formatEther(balance)} $TRUST`);

  const atomCost = await multiVaultGetAtomCost({ address: multiVaultAddress, publicClient });
  const tripleCost = await multiVaultGetTripleCost({ address: multiVaultAddress, publicClient });

  // We may need 1-2 atoms (exchange + possibly participatesIn) + 2 triples
  const totalNeeded = atomCost * 2n + tripleCost * 2n;

  if (balance < totalNeeded) {
    console.log(`Insufficient balance. Need ~${formatEther(totalNeeded)} $TRUST`);
    console.log(`Bridge from Base: https://app.intuition.systems/bridge`);
    process.exit(1);
  }

  // Step 1: Create Exchange Atom
  console.log(`\nCreating atom: "${exchangeName}"`);

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

  console.log(`  Exchange Atom ID: ${exchangeAtomId}`);

  // Step 2: Get or create "participatesIn" predicate
  const participatesInData = toHex('participatesIn');
  const participatesInId = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'calculateAtomId',
    args: [participatesInData],
  });

  const participatesInExists = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'isTermCreated',
    args: [participatesInId],
  });

  let predicateAtomId = participatesInId;

  if (!participatesInExists) {
    console.log('Creating "participatesIn" predicate atom...');
    const predicateTx = await multiVaultCreateAtoms(
      { address: multiVaultAddress, walletClient, publicClient },
      { args: [[stringToHex('participatesIn')], [atomCost]], value: atomCost }
    );
    const predicateReceipt = await publicClient.waitForTransactionReceipt({ hash: predicateTx });
    for (const log of predicateReceipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: MultiVaultAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === 'AtomCreated') predicateAtomId = decoded.args.termId;
      } catch (e) {}
    }
  } else {
    console.log(`  "participatesIn" already exists: ${predicateAtomId}`);
  }

  // Step 3: Create Triples
  console.log('Creating exchange triples...');

  const tripleTx = await multiVaultCreateTriples(
    { address: multiVaultAddress, walletClient, publicClient },
    {
      args: [
        [agent1AtomId, agent2AtomId],
        [predicateAtomId, predicateAtomId],
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

  console.log('\nEXCHANGE ATTESTATION COMPLETE');
  console.log(`  Exchange Atom: ${exchangeAtomId}`);
  console.log(`  participatesIn: ${predicateAtomId}`);
  console.log(`  [${label1}][participatesIn][Exchange]: ${tripleIds[0]}`);
  console.log(`  [${label2}][participatesIn][Exchange]: ${tripleIds[1]}`);

  const result = {
    exchange: { name: exchangeName, atomId: exchangeAtomId, hash: exchangeHash },
    predicate: { name: 'participatesIn', atomId: predicateAtomId },
    triples: { agent1Participates: tripleIds[0], agent2Participates: tripleIds[1] },
    transactions: { exchangeAtom: atomTx, triples: tripleTx },
    agents: { agent1: label1, agent2: label2, atom1: agent1AtomId, atom2: agent2AtomId },
    created: new Date().toISOString(),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
