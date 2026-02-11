#!/usr/bin/env node
/**
 * intuition-tools.mjs
 * Unified CLI for Intuition agent tools
 *
 * Usage:
 *   node intuition-tools.mjs <command> [args]
 *
 * Commands:
 *   quickstart <name>     - Full agent onboarding
 *   verify <name|id>      - Verify an atom exists
 *   query <name|id>       - Query claims about an entity
 *   triples <name|id>     - List triples for an entity
 *   stake <id> <amount>   - Stake on an atom or triple
 *   agents                - Discover AI agents on-chain
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOOLS = {
  quickstart: 'intuition-quickstart-v3.mjs',
  verify: 'intuition-verify.mjs',
  query: 'intuition-query.mjs',
  triples: 'intuition-triples.mjs',
  stake: 'intuition-stake.mjs',
  agents: 'intuition-agents.mjs',
  hash: 'exchange-hash.mjs',
  exchange: 'create-exchange-attestation.mjs',
};

function showHelp() {
  console.log(`
INTUITION AGENT TOOLS
Build identity on-chain, one claim at a time

Usage: node intuition-tools.mjs <command> [args]

Commands:
  quickstart <name> [amount]     Full agent onboarding: wallet -> atom -> triple -> stake
  verify <name|atom_id>          Verify an atom exists and check identity claims
  query <name|atom_id>           Query claims about an entity
  triples <name|atom_id>         List all triples involving an entity (via GraphQL)
  stake <term_id> <amount>       Stake $TRUST on an atom or triple
  agents                         Discover AI agents on-chain (via GraphQL)
  hash <agent1> <agent2>         Compute exchange trust fingerprint
  exchange --name1 A --name2 B   Create on-chain exchange attestation

Examples:
  node intuition-tools.mjs quickstart MyAgent 0.5
  node intuition-tools.mjs verify MyAgent
  node intuition-tools.mjs query MyAgent
  node intuition-tools.mjs triples "AI Agent" --json
  node intuition-tools.mjs stake 0x<term-id> 0.5
  node intuition-tools.mjs stake 0x<triple-id> 0.5 --against
  node intuition-tools.mjs agents --json

Environment:
  INTUITION_PRIVATE_KEY - Required for quickstart, stake, and exchange commands
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  const toolArgs = args.slice(1);

  if (!TOOLS[command]) {
    console.error(`Unknown command: ${command}`);
    console.error('Run with --help to see available commands.');
    process.exit(1);
  }

  const toolPath = join(__dirname, TOOLS[command]);
  const child = spawn('node', [toolPath, ...toolArgs], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('close', (code) => process.exit(code || 0));
  child.on('error', (err) => {
    console.error(`Failed to run ${command}:`, err.message);
    process.exit(1);
  });
}

main();
