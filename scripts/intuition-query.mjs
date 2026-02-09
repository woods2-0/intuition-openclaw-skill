#!/usr/bin/env node
/**
 * intuition-query.mjs - Query claims about an entity from Intuition
 *
 * Usage:
 *   node intuition-query.mjs <atom_id_or_label>
 *
 * Examples:
 *   node intuition-query.mjs Forge
 *   node intuition-query.mjs 0x409e0f779a53a244...
 */

import { createPublicClient, http, toHex, fromHex } from 'viem';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  MultiVaultAbi,
} from '@0xintuition/protocol';

function usage() {
  console.log(`
intuition-query.mjs - Query claims about an entity

Usage:
  node intuition-query.mjs <atom_id_or_label>

Examples:
  node intuition-query.mjs Forge
  node intuition-query.mjs 0x409e0f779a53a244a4168f1accb34f7121afbb4b13b2c351574e0b4018fda509
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

// Known agents for name lookup
const KNOWN_AGENTS = {
  'axiom': '0x66ca1004a396fa23fab729da1ae6eb894bf52e05740fc62fef41629cbb52b1ee',
  'forge': '0x409e0f779a53a244a4168f1accb34f7121afbb4b13b2c351574e0b4018fda509',
  'veritas': '0xf42e520bcddc55f57a76e01f81360570882c8df34f1ffb02addfc26633daf287',
};

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
    const knownId = KNOWN_AGENTS[input.toLowerCase()];
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

  // Known predicates and objects to check
  const KNOWN = {
    is: '0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1',
    AIAgent: '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e',
    collaboratesWith: '0xb3cf9e60665fe7674e3798d2452604431d4d4dc96aa8d6965016205d00e45c8e',
    Axiom: '0x66ca1004a396fa23fab729da1ae6eb894bf52e05740fc62fef41629cbb52b1ee',
    Forge: '0x409e0f779a53a244a4168f1accb34f7121afbb4b13b2c351574e0b4018fda509',
  };

  let foundTriples = false;

  // Check [Entity] [is] [AI Agent]
  const isAgentTripleId = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'calculateTripleId',
    args: [atomId, KNOWN.is, KNOWN.AIAgent],
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

  // Check [Entity] [collaboratesWith] [Axiom]
  const collabAxiomTripleId = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'calculateTripleId',
    args: [atomId, KNOWN.collaboratesWith, KNOWN.Axiom],
  });

  const collabAxiomExists = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'isTermCreated',
    args: [collabAxiomTripleId],
  });

  if (collabAxiomExists) {
    foundTriples = true;
    const vault = await getVaultInfo(publicClient, multiVaultAddress, collabAxiomTripleId);
    console.log(`\n[${label}] [collaboratesWith] [Axiom]`);
    console.log(`  Triple: ${collabAxiomTripleId}`);
    console.log(`  Staked: ${(Number(vault.totalAssets) / 1e18).toFixed(4)} $TRUST`);
  }

  // Check [Axiom] [collaboratesWith] [Entity]
  const axiomCollabTripleId = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'calculateTripleId',
    args: [KNOWN.Axiom, KNOWN.collaboratesWith, atomId],
  });

  const axiomCollabExists = await publicClient.readContract({
    address: multiVaultAddress,
    abi: MultiVaultAbi,
    functionName: 'isTermCreated',
    args: [axiomCollabTripleId],
  });

  if (axiomCollabExists) {
    foundTriples = true;
    const vault = await getVaultInfo(publicClient, multiVaultAddress, axiomCollabTripleId);
    console.log(`\n[Axiom] [collaboratesWith] [${label}]`);
    console.log(`  Triple: ${axiomCollabTripleId}`);
    console.log(`  Staked: ${(Number(vault.totalAssets) / 1e18).toFixed(4)} $TRUST`);
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
