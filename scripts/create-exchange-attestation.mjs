#!/usr/bin/env node
/**
 * create-exchange-attestation.mjs
 * Creates on-chain trust attestation for an agent exchange
 *
 * Creates:
 *   1. Exchange atom (e.g., "AxiomVeritasExchange") with hash in data
 *   2. participatesIn predicate atom (if needed)
 *   3. [Agent1][participatesIn][Exchange] triple
 *   4. [Agent2][participatesIn][Exchange] triple
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
import { join } from 'path';

const KNOWN_ATOMS = {
  axiom: '0x66ca1004a396fa23fab729da1ae6eb894bf52e05740fc62fef41629cbb52b1ee',
  forge: '0x409e0f779a53a244a4168f1accb34f7121afbb4b13b2c351574e0b4018fda509',
  veritas: '0x8a24834402055a51404e80523d4918ac69bb72d24cf7d7b29c98fe3d785ca88c',
  is: '0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1',
  'AI Agent': '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e',
  collaboratesWith: '0xb3cf9e60665fe7674e3798d2452604431d4d4dc96aa8d6965016205d00e45c8e',
};

const EXCHANGE_DATA = {
  agent1: 'axiom',
  agent2: 'veritas',
  hash: '0x2d4224ca7cc2def76e42faaeaec750f0b095b1f7ea092db703a049e7d5dc264b',
  messageCount: 355,
  avgLatency: 3.1,
  gapSurvival: 1.0,
  began: '2026-01-31T22:12:00.000Z',
  lastActivity: '2026-02-01T23:40:00.000Z'
};

const walletPath = join(process.env.HOME, '.clawdbot/workspace-forge/.wallet.json');
const wallet = JSON.parse(readFileSync(walletPath, 'utf8'));
const privateKey = wallet.privateKey;

async function main() {
  console.log('Creating Exchange Attestation');
  console.log(`Exchange: ${EXCHANGE_DATA.agent1} <-> ${EXCHANGE_DATA.agent2}`);
  console.log(`Hash: ${EXCHANGE_DATA.hash}`);
  console.log(`Messages: ${EXCHANGE_DATA.messageCount}`);
  console.log(`Gap Survival: ${EXCHANGE_DATA.gapSurvival * 100}%`);

  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: intuitionMainnet, transport: http(),
  });

  const walletClient = createWalletClient({
    account, chain: intuitionMainnet, transport: http(),
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
  const exchangeName = `AxiomVeritasExchange:${EXCHANGE_DATA.hash.slice(0, 18)}`;
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
        [KNOWN_ATOMS.axiom, KNOWN_ATOMS.veritas],
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
  console.log(`  [Axiom][participatesIn][Exchange]: ${tripleIds[0]}`);
  console.log(`  [Veritas][participatesIn][Exchange]: ${tripleIds[1]}`);

  const result = {
    exchange: { name: exchangeName, atomId: exchangeAtomId, hash: EXCHANGE_DATA.hash },
    predicate: { name: 'participatesIn', atomId: participatesInAtomId },
    triples: { axiomParticipates: tripleIds[0], veritasParticipates: tripleIds[1] },
    transactions: { exchangeAtom: atomTx, predicateAtom: predicateTx, triples: tripleTx },
    metadata: {
      messageCount: EXCHANGE_DATA.messageCount,
      avgLatency: EXCHANGE_DATA.avgLatency,
      gapSurvival: EXCHANGE_DATA.gapSurvival,
      began: EXCHANGE_DATA.began,
      lastActivity: EXCHANGE_DATA.lastActivity,
    },
    created: new Date().toISOString(),
  };

  const outputPath = join(process.env.HOME, '.clawdbot/workspace-forge/exchange-attestation-result.json');
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Result saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
