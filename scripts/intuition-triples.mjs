#!/usr/bin/env node
/**
 * intuition-triples.mjs
 * Query all triples involving an entity using GraphQL
 *
 * Usage:
 *   node intuition-triples.mjs <name_or_atom_id>
 *   node intuition-triples.mjs <name> --json
 */

import { createPublicClient, http, toHex } from 'viem';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  MultiVaultAbi,
} from '@0xintuition/protocol';

const GRAPHQL_ENDPOINT = process.env.INTUITION_GRAPHQL_ENDPOINT || 'https://mainnet.intuition.sh/v1/graphql';

const client = createPublicClient({
  chain: intuitionMainnet,
  transport: http('https://rpc.intuition.systems/http'),
});

const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);

async function graphqlQuery(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.data;
}

async function findTriplesByAtomId(atomId, limit) {
  const query = `
    query FindTriples($atomId: String!, $limit: Int!) {
      as_subject: triples(
        where: { subject_id: { _eq: $atomId } }
        limit: $limit
      ) {
        term_id
        subject { term_id label }
        predicate { term_id label }
        object { term_id label }
        triple_vault { total_shares position_count }
      }
      as_object: triples(
        where: { object_id: { _eq: $atomId } }
        limit: $limit
      ) {
        term_id
        subject { term_id label }
        predicate { term_id label }
        object { term_id label }
        triple_vault { total_shares position_count }
      }
      as_predicate: triples(
        where: { predicate_id: { _eq: $atomId } }
        limit: $limit
      ) {
        term_id
        subject { term_id label }
        predicate { term_id label }
        object { term_id label }
        triple_vault { total_shares position_count }
      }
    }
  `;
  return graphqlQuery(query, { atomId, limit });
}

async function findAtomByLabel(label) {
  const query = `
    query FindAtom($label: String!) {
      atoms(where: { label: { _eq: $label } }, limit: 1) {
        term_id
        label
      }
    }
  `;
  const data = await graphqlQuery(query, { label });
  return data.atoms?.[0] || null;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
intuition-triples.mjs - Query all triples involving an entity

Usage:
  node intuition-triples.mjs <name_or_atom_id>

Options:
  --json              Output as JSON
  --limit <n>         Max results per direction (default: 25)

Examples:
  node intuition-triples.mjs "Alice"
  node intuition-triples.mjs 12345
  node intuition-triples.mjs "AI Agent" --json

Queries the Intuition GraphQL API to find all triples where the entity
appears as subject, object, or predicate.
`);
    process.exit(0);
  }

  const input = args.find(a => !a.startsWith('--'));
  const jsonOutputFlag = args.includes('--json');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx > -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1]) : 25;

  if (!jsonOutputFlag) {
    console.log('Intuition Triples');
    console.log('=================');
    console.log(`Input: ${input}`);
  }

  // Resolve to atom ID
  let atomId;
  let label = input;

  function bigIntToHex(n) {
    return '0x' + n.toString(16).padStart(64, '0');
  }

  if (input.startsWith('0x') && input.length === 66) {
    // Hex term_id passed directly
    atomId = input;
  } else {
    // Name — look up via GraphQL first, fall back to calculateAtomId
    const atom = await findAtomByLabel(input);
    if (atom) {
      atomId = atom.term_id;
      label = atom.label;
    } else {
      // Try calculating the atom ID from the name
      const calculatedId = await client.readContract({
        address: multiVaultAddress,
        abi: MultiVaultAbi,
        functionName: 'calculateAtomId',
        args: [toHex(input)],
      });

      const exists = await client.readContract({
        address: multiVaultAddress,
        abi: MultiVaultAbi,
        functionName: 'isTermCreated',
        args: [calculatedId],
      });

      if (!exists) {
        console.log(`\nNo atom found for "${input}". It may not exist on-chain yet.`);
        process.exit(0);
      }

      atomId = bigIntToHex(calculatedId);
    }
  }

  if (!jsonOutputFlag) {
    console.log(`Label: ${label}`);
    console.log(`Atom ID: ${atomId}`);
  }

  // Query all triples via GraphQL
  const data = await findTriplesByAtomId(atomId, limit);

  const asSubject = data.as_subject || [];
  const asObject = data.as_object || [];
  const asPredicate = data.as_predicate || [];
  const allTriples = [...asSubject, ...asObject, ...asPredicate];

  if (allTriples.length === 0) {
    if (!jsonOutputFlag) {
      console.log('\nNo triples found for this entity.');
    } else {
      console.log(JSON.stringify({ subject: [], object: [], predicate: [] }, null, 2));
    }
    process.exit(0);
  }

  if (jsonOutputFlag) {
    console.log(JSON.stringify({
      atomId,
      label,
      as_subject: asSubject,
      as_object: asObject,
      as_predicate: asPredicate,
    }, null, 2));
    return;
  }

  function printTriples(triples, role) {
    if (triples.length === 0) return;
    console.log(`\n--- As ${role} (${triples.length}) ---`);
    for (const t of triples) {
      const forStake = t.triple_vault?.total_shares ? (Number(t.triple_vault.total_shares) / 1e18).toFixed(4) : '0';
      const stakers = t.triple_vault?.position_count || 0;
      console.log(`  [${t.subject.label}] [${t.predicate.label}] [${t.object.label}]`);
      console.log(`    Staked: ${forStake} $TRUST (${stakers} stakers) | ID: ${t.term_id}`);
    }
  }

  printTriples(asSubject, 'Subject');
  printTriples(asObject, 'Object');
  printTriples(asPredicate, 'Predicate');

  console.log(`\nTotal: ${allTriples.length} triple(s)`);
  console.log(`Explorer: https://portal.intuition.systems`);
}

main().catch(err => {
  const msg = (err.message || '').replace(/0x[a-fA-F0-9]{64}/g, '0x[REDACTED]');
  console.error('Error:', msg);
  process.exit(1);
});
