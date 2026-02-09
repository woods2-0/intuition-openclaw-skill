#!/usr/bin/env node
/**
 * intuition-query.mjs - Query claims about an entity from Intuition
 *
 * Usage:
 *   node intuition-query.mjs <atom_id_or_label>
 *
 * Examples:
 *   node intuition-query.mjs YourAgent
 *   node intuition-query.mjs 0x<atom-id>...
 */

import { createPublicClient, http, toHex, fromHex } from 'viem';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  MultiVaultAbi,
} from '@0xintuition/protocol';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRegistry() {
  const registryPath = join(__dirname, '..', 'agent-registry.json');
  try {
    return JSON.parse(readFileSync(registryPath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') {
      return null;
    }
    throw e;
  }
}

function usage() {
  console.log(`
intuition-query.mjs - Query claims about an entity

Usage:
  node intuition-query.mjs <atom_id_or_label>

Examples:
  node intuition-query.mjs <agent-name>
  node intuition-query.mjs 0x<atom-id>
`);
  process.exit(1);
}

async function getVaultInfo(publicClient, multiVaultAddress, tripleId) {
  // curveId 1 = FOR position
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
  if (args.length < 1 || args.includes('--help') || args.includes('-h')) {
    usage();
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

  // Load registry for agent name lookups
  const registry = loadRegistry();
  const knownAgents = {};
  if (registry && registry.agents) {
    for (const [name, data] of Object.entries(registry.agents)) {
      if (data.atomId) {
        knownAgents[name.toLowerCase()] = data.atomId;
      }
    }
  }

  let atomId;

  const publicClient = createPublicClient({
    chain: intuitionMainnet,
    transport: http('https://rpc.intuition.systems/http'),
  });
  const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);

  // Determine if input is atom ID or label
  if (inputType === 'id' || (inputType === 'auto' && input.startsWith('0x') && input.length === 66)) {
    atomId = input;
  } else {
    // Check known agents first
    const knownId = knownAgents[input.toLowerCase()];
    if (knownId) {
      atomId = knownId;
    } else {
      // Calculate atom ID from label using contract function
      atomId = await publicClient.readContract({
        address: multiVaultAddress,
        abi: MultiVaultAbi,
        functionName: 'calculateAtomId',
        args: [toHex(input)],
      });
    }
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

  console.log('Label:', label);

  // Check known triples for this atom
  console.log('\n--- Known Triples ---');

  // Protocol-level predicate and object atom IDs
  const predicates = (registry && registry.predicates) || {};
  const objects = (registry && registry.objects) || {};

  const isPredicateId = predicates.is || '0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1';
  const aiAgentId = objects['AI Agent'] || '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e';
  const collaboratesWithId = predicates.collaboratesWith || '0xb3cf9e60665fe7674e3798d2452604431d4d4dc96aa8d6965016205d00e45c8e';

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

  // Check [Entity] [collaboratesWith] [OtherAgent] for all configured agents
  for (const [agentName, agentAtomId] of Object.entries(knownAgents)) {
    if (agentAtomId === atomId) continue; // Skip self

    // Check [Entity] [collaboratesWith] [OtherAgent]
    const collabTripleId = await publicClient.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'calculateTripleId',
      args: [atomId, collaboratesWithId, agentAtomId],
    });

    const collabExists = await publicClient.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'isTermCreated',
      args: [collabTripleId],
    });

    if (collabExists) {
      foundTriples = true;
      const vault = await getVaultInfo(publicClient, multiVaultAddress, collabTripleId);
      console.log(`\n[${label}] [collaboratesWith] [${agentName}]`);
      console.log(`  Triple: ${collabTripleId}`);
      console.log(`  Staked: ${(Number(vault.totalAssets) / 1e18).toFixed(4)} $TRUST`);
    }

    // Check [OtherAgent] [collaboratesWith] [Entity]
    const reverseCollabTripleId = await publicClient.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'calculateTripleId',
      args: [agentAtomId, collaboratesWithId, atomId],
    });

    const reverseCollabExists = await publicClient.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'isTermCreated',
      args: [reverseCollabTripleId],
    });

    if (reverseCollabExists) {
      foundTriples = true;
      const vault = await getVaultInfo(publicClient, multiVaultAddress, reverseCollabTripleId);
      console.log(`\n[${agentName}] [collaboratesWith] [${label}]`);
      console.log(`  Triple: ${reverseCollabTripleId}`);
      console.log(`  Staked: ${(Number(vault.totalAssets) / 1e18).toFixed(4)} $TRUST`);
    }
  }

  if (!foundTriples) {
    console.log('No known triples found for this atom');
  }

  console.log('\n--- Intuition Explorer ---');
  console.log(`https://intuition.sh/identity/${atomId}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
