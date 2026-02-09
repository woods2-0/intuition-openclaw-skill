#!/usr/bin/env node
/**
 * intuition-triples.mjs
 * Query known triples for agents in the swarm
 *
 * Usage:
 *   node intuition-triples.mjs <name_or_atom_id>
 */

import { createPublicClient, http, toHex, parseEther } from 'viem';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  MultiVaultAbi,
} from '@0xintuition/protocol';

const KNOWN_ATOMS = {
  'Forge': '0x409e0f779a53a244a4168f1accb34f7121afbb4b13b2c351574e0b4018fda509',
  'Axiom': '0x66ca1004a396fa23fab729da1ae6eb894bf52e05740fc62fef41629cbb52b1ee',
  'Veritas': '0xf42e520bcddc55f57a76e01f81360570882c8df34f1ffb02addfc26633daf287',
  'is': '0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1',
  'AI Agent': '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e',
  'collaboratesWith': '0xb3cf9e60665fe7674e3798d2452604431d4d4dc96aa8d6965016205d00e45c8e',
};

const ATOM_LABELS = Object.fromEntries(
  Object.entries(KNOWN_ATOMS).map(([k, v]) => [v.toLowerCase(), k])
);

const KNOWN_TRIPLES = [
  {
    id: '0x41f5302e7d29e319c9363fe858589d4231fe97f5cea106ae9d1f4ebdcf703d07',
    subject: 'Forge', predicate: 'is', object: 'AI Agent',
  },
  {
    id: '0x945c22150288df7ea4a9509101f44a5ea0b128792e5c212e3a23b6e67d320d3b',
    subject: 'Axiom', predicate: 'collaboratesWith', object: 'Forge',
  },
  {
    id: '0xaf01ae45c3add9ab136a37d7b3e833030a31770fda7a5f6a2754191e2b58c2b8',
    subject: 'Forge', predicate: 'collaboratesWith', object: 'Axiom',
  },
];

const client = createPublicClient({
  chain: intuitionMainnet,
  transport: http('https://rpc.intuition.systems/http'),
});

const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);

async function getTripleStake(tripleId) {
  try {
    const [totalShares, totalAssets] = await client.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'getVault',
      args: [tripleId, 1n],
    });
    return Number(totalAssets) / 1e18;
  } catch {
    return 0;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
intuition-triples.mjs - Query triples for swarm agents

Usage:
  node intuition-triples.mjs <name_or_atom_id>

Options:
  --json    Output as JSON

Examples:
  node intuition-triples.mjs Forge
  node intuition-triples.mjs Axiom --json
`);
    process.exit(0);
  }

  const input = args.find(a => !a.startsWith('--'));
  const jsonOutput = args.includes('--json');

  console.log('Intuition Triples');
  console.log('=================');
  console.log(`Input: ${input}`);

  let atomId = input;
  let label = input;

  if (!input.startsWith('0x')) {
    atomId = KNOWN_ATOMS[input];
    if (!atomId) {
      atomId = await client.readContract({
        address: multiVaultAddress,
        abi: MultiVaultAbi,
        functionName: 'calculateAtomId',
        args: [toHex(input)],
      });
    }
  } else {
    label = ATOM_LABELS[input.toLowerCase()] || input.slice(0, 12) + '...';
  }

  console.log(`Label: ${label}`);
  console.log(`Atom ID: ${atomId}`);

  const relatedTriples = KNOWN_TRIPLES.filter(t =>
    t.subject === label || t.object === label ||
    KNOWN_ATOMS[t.subject] === atomId || KNOWN_ATOMS[t.object] === atomId
  );

  if (relatedTriples.length === 0) {
    console.log('No known triples found for this entity.');
    process.exit(0);
  }

  const results = [];
  console.log(`Found ${relatedTriples.length} triple(s):`);

  for (const t of relatedTriples) {
    const stake = await getTripleStake(t.id);
    const formatted = `[${t.subject}] [${t.predicate}] [${t.object}]`;

    if (jsonOutput) {
      results.push({ ...t, stake });
    } else {
      console.log(`  ${formatted}`);
      console.log(`    Stake: ${stake.toFixed(4)} $TRUST`);
      console.log(`    Triple ID: ${t.id}`);
      console.log(`    Explorer: https://app.intuition.systems/app/claim/${t.id}`);
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
