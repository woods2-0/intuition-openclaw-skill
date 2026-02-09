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
 *   stake <triple_id> <amount> [FOR|AGAINST] - Stake on a triple
 *   agents                - List known AI agents
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
};

function showHelp() {
  console.log(`
INTUITION AGENT TOOLS
Build identity on-chain, one claim at a time

Usage: node intuition-tools.mjs <command> [args]

Commands:
  quickstart <name>              Full agent onboarding: wallet -> atom -> triple -> stake
  verify <name|atom_id>          Verify an atom exists and decode its label
  query <name|atom_id>           Query all claims about an entity
  triples <name|atom_id>         List all triples involving an entity
  stake <triple_id> <amount>     Stake $TRUST on a triple (default: FOR)
  agents [--verify <atom_id>]    List known AI agents in the swarm

Examples:
  node intuition-tools.mjs quickstart MyAgent
  node intuition-tools.mjs verify Axiom
  node intuition-tools.mjs query Forge --json
  node intuition-tools.mjs stake 0x41f5... 0.5 FOR
  node intuition-tools.mjs agents

Environment:
  PRIVATE_KEY - Required for quickstart and stake commands
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
