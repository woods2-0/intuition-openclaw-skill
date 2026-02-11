#!/usr/bin/env node
/**
 * intuition-agents.mjs
 * Discover AI agents registered on Intuition mainnet via GraphQL
 *
 * Usage:
 *   node intuition-agents.mjs                    # List all AI agents
 *   node intuition-agents.mjs --predicate "trusts" # Find all [X] [trusts] [Y] triples
 *   node intuition-agents.mjs --json              # JSON output
 */

const GRAPHQL_ENDPOINT = process.env.INTUITION_GRAPHQL_ENDPOINT || 'https://mainnet.intuition.sh/v1/graphql';

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx > -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1]) : 50;
const predicateIdx = args.indexOf('--predicate');
const customPredicate = predicateIdx > -1 ? args[predicateIdx + 1] : null;

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
intuition-agents.mjs - Discover AI agents on Intuition

Usage:
  node intuition-agents.mjs                         # List all [X] [is] [AI Agent] claims
  node intuition-agents.mjs --predicate "trusts"    # Find all triples with a given predicate
  node intuition-agents.mjs --limit 20              # Limit results
  node intuition-agents.mjs --json                  # JSON output

Options:
  --predicate <name>  Search for triples using this predicate (default: finds AI agents)
  --limit <n>         Max results (default: 50)
  --json              Output as JSON

Queries the Intuition GraphQL API (no auth required).
`);
  process.exit(0);
}

async function graphqlQuery(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.data;
}

async function findAgents(limit) {
  const query = `
    query FindAgents($limit: Int!) {
      triples(
        where: {
          predicate: { label: { _eq: "is" } }
          object: { label: { _eq: "AI Agent" } }
        }
        order_by: { vault: { total_shares: desc_nulls_last } }
        limit: $limit
      ) {
        id
        subject { id label }
        predicate { id label }
        object { id label }
        vault { total_shares position_count }
        counter_vault { total_shares position_count }
      }
    }
  `;
  return graphqlQuery(query, { limit });
}

async function findByPredicate(predicateLabel, limit) {
  const query = `
    query FindByPredicate($predicate: String!, $limit: Int!) {
      triples(
        where: {
          predicate: { label: { _ilike: $predicate } }
        }
        order_by: { vault: { total_shares: desc_nulls_last } }
        limit: $limit
      ) {
        id
        subject { id label }
        predicate { id label }
        object { id label }
        vault { total_shares position_count }
        counter_vault { total_shares position_count }
      }
    }
  `;
  return graphqlQuery(query, { predicate: predicateLabel, limit });
}

async function main() {
  let data;

  if (customPredicate) {
    if (!jsonOutput) {
      console.log(`Searching for triples with predicate: "${customPredicate}"`);
      console.log('');
    }
    data = await findByPredicate(customPredicate, limit);
  } else {
    if (!jsonOutput) {
      console.log('Intuition AI Agent Discovery');
      console.log('============================');
      console.log('');
    }
    data = await findAgents(limit);
  }

  const triples = data.triples || [];

  if (triples.length === 0) {
    console.log('No results found.');
    return;
  }

  if (jsonOutput) {
    console.log(JSON.stringify(triples, null, 2));
    return;
  }

  triples.forEach((t, i) => {
    const forStake = t.vault?.total_shares ? (Number(t.vault.total_shares) / 1e18).toFixed(4) : '0';
    const againstStake = t.counter_vault?.total_shares ? (Number(t.counter_vault.total_shares) / 1e18).toFixed(4) : '0';
    const stakers = t.vault?.position_count || 0;

    console.log(`${i + 1}. [${t.subject.label}] [${t.predicate.label}] [${t.object.label}]`);
    console.log(`   Triple ID: ${t.id}`);
    console.log(`   Staked FOR: ${forStake} $TRUST (${stakers} stakers)`);
    if (parseFloat(againstStake) > 0) {
      console.log(`   Staked AGAINST: ${againstStake} $TRUST`);
    }
    console.log(`   Explorer: https://portal.intuition.systems/app/claim/${t.id}`);
    console.log('');
  });

  console.log(`Found ${triples.length} result(s).`);
  console.log('');
  console.log('To verify a specific agent: node intuition-verify.mjs <name>');
  console.log('To query claims about an entity: node intuition-query.mjs --name <name>');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
