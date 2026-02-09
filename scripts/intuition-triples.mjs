#!/usr/bin/env node
/**
 * intuition-triples.mjs
 * Query known triples for agents
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
      console.error('No agent-registry.json found. Copy agent-registry.example.json and fill in your agent data.');
      console.error('  cp agent-registry.example.json agent-registry.json');
      process.exit(1);
    }
    throw e;
  }
}

// Build KNOWN_ATOMS from registry (agents + predicates + objects)
const registry = loadRegistry();
const KNOWN_ATOMS = {};

// Add agents from registry
if (registry.agents) {
  for (const [name, data] of Object.entries(registry.agents)) {
    if (data.atomId) KNOWN_ATOMS[name] = data.atomId;
  }
}

// Add protocol-level predicates
if (registry.predicates) {
  for (const [name, id] of Object.entries(registry.predicates)) {
    KNOWN_ATOMS[name] = id;
  }
}

// Add protocol-level objects
if (registry.objects) {
  for (const [name, id] of Object.entries(registry.objects)) {
    KNOWN_ATOMS[name] = id;
  }
}

const ATOM_LABELS = Object.fromEntries(
  Object.entries(KNOWN_ATOMS).map(([k, v]) => [v.toLowerCase(), k])
);

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

// Dynamically compute triples from registry agents
async function computeKnownTriples() {
  const triples = [];
  const agentNames = Object.keys(registry.agents || {});
  const isId = KNOWN_ATOMS['is'];
  const aiAgentId = KNOWN_ATOMS['AI Agent'];
  const collaboratesWithId = KNOWN_ATOMS['collaboratesWith'];

  for (const name of agentNames) {
    const agentAtomId = KNOWN_ATOMS[name];
    if (!agentAtomId) continue;

    // Check [Agent] [is] [AI Agent]
    if (isId && aiAgentId) {
      try {
        const tripleId = await client.readContract({
          address: multiVaultAddress,
          abi: MultiVaultAbi,
          functionName: 'calculateTripleId',
          args: [agentAtomId, isId, aiAgentId],
        });
        const exists = await client.readContract({
          address: multiVaultAddress,
          abi: MultiVaultAbi,
          functionName: 'isTermCreated',
          args: [tripleId],
        });
        if (exists) {
          triples.push({ id: tripleId, subject: name, predicate: 'is', object: 'AI Agent' });
        }
      } catch {}
    }

    // Check [Agent] [collaboratesWith] [OtherAgent] for each pair
    if (collaboratesWithId) {
      for (const otherName of agentNames) {
        if (otherName === name) continue;
        const otherAtomId = KNOWN_ATOMS[otherName];
        if (!otherAtomId) continue;

        try {
          const tripleId = await client.readContract({
            address: multiVaultAddress,
            abi: MultiVaultAbi,
            functionName: 'calculateTripleId',
            args: [agentAtomId, collaboratesWithId, otherAtomId],
          });
          const exists = await client.readContract({
            address: multiVaultAddress,
            abi: MultiVaultAbi,
            functionName: 'isTermCreated',
            args: [tripleId],
          });
          if (exists) {
            triples.push({ id: tripleId, subject: name, predicate: 'collaboratesWith', object: otherName });
          }
        } catch {}
      }
    }
  }

  return triples;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
intuition-triples.mjs - Query triples for agents

Usage:
  node intuition-triples.mjs <name_or_atom_id>

Options:
  --json    Output as JSON

Examples:
  node intuition-triples.mjs <agent-name>
  node intuition-triples.mjs <agent-name> --json
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

  // Compute triples dynamically from registry
  const allTriples = await computeKnownTriples();

  const relatedTriples = allTriples.filter(t =>
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
