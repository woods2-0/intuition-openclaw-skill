#!/usr/bin/env node
/**
 * intuition-positions.mjs
 * Check staking positions on the Intuition protocol for a wallet
 *
 * Usage:
 *   node intuition-positions.mjs                        # Use wallet from INTUITION_PRIVATE_KEY
 *   node intuition-positions.mjs 0x1234...5678          # Check specific address
 *   node intuition-positions.mjs --json                 # JSON output
 *
 * Examples:
 *   node intuition-positions.mjs
 *   node intuition-positions.mjs 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
 *   node intuition-positions.mjs 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --json
 *   node intuition-positions.mjs --limit 10
 *
 * Environment:
 *   INTUITION_PRIVATE_KEY    Wallet private key (used to derive address if no address arg)
 */

const GRAPHQL_ENDPOINT = process.env.INTUITION_GRAPHQL_ENDPOINT || 'https://mainnet.intuition.sh/v1/graphql';

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx > -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1]) : 50;

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
intuition-positions.mjs - Check staking positions on Intuition

Usage:
  node intuition-positions.mjs                        # Use wallet from INTUITION_PRIVATE_KEY
  node intuition-positions.mjs <address>              # Check specific address
  node intuition-positions.mjs --json                 # JSON output

Options:
  --json              Output as JSON
  --limit <n>         Max results (default: 50)

Examples:
  node intuition-positions.mjs
  node intuition-positions.mjs 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
  node intuition-positions.mjs 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --json
  node intuition-positions.mjs --limit 10

Environment:
  INTUITION_PRIVATE_KEY    Wallet private key (used to derive address if no address arg)

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

async function getPositions(address, limit) {
  const query = `
    query GetPositions($address: String!, $limit: Int = 50) {
      positions(
        where: { account_id: { _eq: $address } }
        limit: $limit
        order_by: { shares: desc }
      ) {
        id
        shares
        vault {
          total_shares
          total_assets
          current_share_price
          term_id
          term {
            id
            type
            atom { label }
            triple {
              subject { label }
              predicate { label }
              object { label }
            }
          }
        }
      }
    }
  `;
  return graphqlQuery(query, { address: address.toLowerCase(), limit });
}

function calculateValue(shares, totalAssets, totalShares) {
  if (!shares || !totalAssets || !totalShares || totalShares === '0') {
    return 0;
  }
  const value = (BigInt(shares) * BigInt(totalAssets)) / BigInt(totalShares);
  return Number(value) / 1e18;
}

function formatValue(value) {
  return value.toFixed(4);
}

async function resolveAddress() {
  // Check for a positional address argument
  const addressArg = args.find(a => !a.startsWith('--') && a.startsWith('0x'));
  if (addressArg) {
    return addressArg;
  }

  // Derive from private key
  if (!process.env.INTUITION_PRIVATE_KEY) {
    console.error('Error: No address provided and INTUITION_PRIVATE_KEY not set.');
    console.error('Usage: node intuition-positions.mjs <address>');
    console.error('   or: set INTUITION_PRIVATE_KEY environment variable');
    process.exit(1);
  }

  const { privateKeyToAccount } = await import('viem/accounts');
  const account = privateKeyToAccount(process.env.INTUITION_PRIVATE_KEY);
  return account.address;
}

async function main() {
  const address = await resolveAddress();

  const data = await getPositions(address, limit);
  const positions = data.positions || [];

  if (jsonOutput) {
    const output = positions.map(p => {
      const vault = p.vault;
      const term = vault.term;
      const isTriple = term?.type === 'Triple';
      const value = calculateValue(p.shares, vault.total_assets, vault.total_shares);

      return {
        id: p.id,
        type: isTriple ? 'triple' : 'atom',
        label: isTriple
          ? `[${term.triple.subject.label}] [${term.triple.predicate.label}] [${term.triple.object.label}]`
          : term?.atom?.label || 'unknown',
        shares: p.shares,
        value: formatValue(value),
        term_id: vault.term_id,
        vault: {
          total_shares: vault.total_shares,
          total_assets: vault.total_assets,
          current_share_price: vault.current_share_price,
        },
        ...(isTriple && {
          triple: {
            subject: term.triple.subject.label,
            predicate: term.triple.predicate.label,
            object: term.triple.object.label,
          },
        }),
        ...(term?.atom && {
          atom: {
            label: term.atom.label,
          },
        }),
      };
    });
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

  console.log('Intuition Positions');
  console.log('===================');
  console.log(`Wallet: ${shortAddr}`);

  if (positions.length === 0) {
    console.log('\nNo positions found for this wallet.');
    console.log('Stake on atoms or triples with: node intuition-stake.mjs <term_id> <amount>');
    return;
  }

  let totalValue = 0;

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const vault = p.vault;
    const term = vault.term;
    const isTriple = term?.type === 'Triple';
    const value = calculateValue(p.shares, vault.total_assets, vault.total_shares);
    totalValue += value;

    console.log('');

    if (isTriple && term.triple) {
      const { subject, predicate, object } = term.triple;
      console.log(`  ${i + 1}. [${subject.label}] [${predicate.label}] [${object.label}] (triple)`);
    } else {
      const label = term?.atom?.label || 'unknown';
      console.log(`  ${i + 1}. [${label}] (atom)`);
    }

    console.log(`     Shares: ${p.shares}`);
    console.log(`     Value: ${formatValue(value)} $TRUST`);
  }

  console.log('');
  console.log(`Total positions: ${positions.length}`);
  console.log(`Total value: ${formatValue(totalValue)} $TRUST`);
}

main().catch(err => {
  const msg = (err.message || '').replace(/0x[a-fA-F0-9]{64}/g, '0x[REDACTED]');
  console.error('Error:', msg);
  process.exit(1);
});
