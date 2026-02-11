#!/usr/bin/env node
/**
 * intuition-query.mjs - Query claims about an entity from Intuition
 *
 * Usage:
 *   node intuition-query.mjs <name_or_atom_id>
 *   node intuition-query.mjs --name "EntityName"
 *   node intuition-query.mjs --id 0x<atom-id>
 */

import { createPublicClient, http, toHex, fromHex } from 'viem';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  MultiVaultAbi,
} from '@0xintuition/protocol';

function usage(exitCode = 1) {
  console.log(`
intuition-query.mjs - Query claims about an entity

Usage:
  node intuition-query.mjs <name_or_atom_id>
  node intuition-query.mjs --name "EntityName"
  node intuition-query.mjs --id 0x<atom-id>

Examples:
  node intuition-query.mjs "Alice"
  node intuition-query.mjs 0x<atom-id>

Checks if the entity exists on-chain and shows known identity claims.
For full relationship discovery, use intuition-triples.mjs (GraphQL-powered).
`);
  process.exit(exitCode);
}

async function getVaultInfo(publicClient, multiVaultAddress, tripleId) {
  const [totalShares, totalAssets] = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'getVault',
    args: [tripleId, 1n],
  });
  return { totalShares, totalAssets };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage(0);
  }
  if (args.length < 1) {
    usage(1);
  }

  // Parse --name and --id flags
  let input;
  let inputType = 'auto';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      input = args[i + 1];
      inputType = 'name';
      break;
    } else if (args[i] === '--id' && args[i + 1]) {
      input = args[i + 1];
      inputType = 'id';
      break;
    } else if (!args[i].startsWith('--')) {
      input = args[i];
      break;
    }
  }

  if (!input) {
    usage();
  }

  const publicClient = createPublicClient({
    chain: intuitionMainnet,
    transport: http('https://rpc.intuition.systems/http'),
  });
  const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);

  let atomId;

  // Determine if input is atom ID or label
  if (inputType === 'id' || (inputType === 'auto' && input.startsWith('0x') && input.length === 66)) {
    atomId = input;
  } else {
    // Calculate atom ID from label
    atomId = await publicClient.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'calculateAtomId',
      args: [toHex(input)],
    });
  }

  console.log('Intuition Query');
  console.log('===============');
  console.log('Input:', input);
  console.log('Atom ID:', atomId);

  // Check if atom exists on-chain
  const isAtom = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'isTermCreated',
    args: [atomId],
  });

  if (!isAtom) {
    console.log('\n\u2717 Atom does not exist on-chain');
    console.log('Create it with: node intuition-quickstart-v3.mjs "' + input + '"');
    process.exit(1);
  }

  // Get atom data
  const atomData = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'atom',
    args: [atomId],
  });

  let label = input;
  if (input.startsWith('0x') && input.length === 66) {
    try {
      label = fromHex(atomData, 'string');
    } catch {
      label = atomData;
    }
  }

  console.log('\u2713 Atom exists');
  console.log('Label:', label);

  // Check common identity triples
  console.log('\n--- Identity Claims ---');

  // Known protocol atoms
  const isPredicateId = '0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1';
  const aiAgentId = '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e';
  const collaboratesWithId = '0xb3cf9e60665fe7674e3798d2452604431d4d4dc96aa8d6965016205d00e45c8e';

  let foundTriples = false;

  // Check [Entity] [is] [AI Agent]
  const isAgentTripleId = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'calculateTripleId',
    args: [atomId, isPredicateId, aiAgentId],
  });

  const isAgentExists = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'isTermCreated',
    args: [isAgentTripleId],
  });

  if (isAgentExists) {
    foundTriples = true;
    const vault = await getVaultInfo(publicClient, multiVaultAddress, isAgentTripleId);
    console.log(`\n[${label}] [is] [AI Agent]`);
    console.log(`  Triple: ${isAgentTripleId}`);
    console.log(`  Staked: ${(Number(vault.totalAssets) / 1e18).toFixed(4)} $TRUST`);
  }

  if (!foundTriples) {
    console.log('No known identity triples found.');
    console.log('\nTip: Use intuition-triples.mjs for full relationship discovery via GraphQL.');
  }

  console.log('\n--- Intuition Explorer ---');
  console.log(`https://portal.intuition.systems/identity/${atomId}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
