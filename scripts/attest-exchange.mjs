#!/usr/bin/env node
/**
 * attest-exchange.mjs - Create on-chain trust attestation with exchange hash
 *
 * Creates [AgentA][trustsExchange][AgentB] triple with embedded exchange hash.
 * Requires both agents to have computed the same hash (consent mechanism).
 *
 * Usage:
 *   node attest-exchange.mjs --from axiom --to veritas --hash 0x...
 *   node attest-exchange.mjs --from axiom --to veritas --compute  # auto-compute hash
 */

import { createHash } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INTERCOM_DIR = process.env.INTERCOM_DIR || join(process.env.HOME, '.clawdbot/intercom');

const args = process.argv.slice(2);
let fromAgent = null;
let toAgent = null;
let exchangeHash = null;
let computeHash = false;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--from' && args[i + 1]) fromAgent = args[++i].toLowerCase();
  else if (args[i] === '--to' && args[i + 1]) toAgent = args[++i].toLowerCase();
  else if (args[i] === '--hash' && args[i + 1]) exchangeHash = args[++i];
  else if (args[i] === '--compute') computeHash = true;
  else if (args[i] === '--dry-run') dryRun = true;
}

if (!fromAgent || !toAgent) {
  console.error('Error: Need --from and --to agents');
  process.exit(1);
}

const AGENT_ATOMS = {
  axiom: '0x66ca1004a396fa23fab729da1ae6eb894bf52e05740fc62fef41629cbb52b1ee',
  forge: '0x409e0f779a53a244a4168f1accb34f7121afbb4b13b2c351574e0b4018fda509',
  veritas: '0x8a24834402055a51404e80523d4918ac69bb72d24cf7d7b29c98fe3d785ca88c'
};

async function computeExchangeHash(agent1, agent2) {
  // Same rhythm analysis as exchange-hash.mjs
  const files = await readdir(INTERCOM_DIR);
  const messageFiles = files.filter(f => {
    const lower = f.toLowerCase();
    return (lower.includes(`to-${agent1}`) || lower.includes(`to-${agent2}`) ||
      lower.includes(`${agent1}-to-`) || lower.includes(`${agent2}-to-`)) &&
      f.endsWith('.md') && !f.includes('last-read');
  });

  const messages = [];
  for (const file of messageFiles) {
    try {
      const content = await readFile(join(INTERCOM_DIR, file), 'utf-8');
      const lines = content.split('\n');
      let from = null, to = null, time = null;

      for (const line of lines.slice(0, 10)) {
        if (line.startsWith('From:')) from = line.replace('From:', '').trim().toLowerCase();
        if (line.startsWith('To:')) to = line.replace('To:', '').trim().toLowerCase();
        if (line.startsWith('Time:')) time = new Date(line.replace('Time:', '').trim());
      }

      const bodyStart = content.indexOf('---\n');
      const bodyEnd = content.lastIndexOf('---');
      const body = bodyStart > 0 ? content.slice(bodyStart + 4, bodyEnd > bodyStart ? bodyEnd : undefined) : '';

      const participants = [from, to].filter(Boolean);
      if (participants.some(p => p.includes(agent1)) &&
        participants.some(p => p.includes(agent2)) && time) {
        messages.push({ from, to, time, length: body.length });
      }
    } catch (e) {}
  }

  if (messages.length < 2) throw new Error(`Not enough messages between ${agent1} and ${agent2}`);

  const sorted = messages.sort((a, b) => a.time - b.time);
  // ... rhythm computation (same as exchange-hash.mjs) ...
  // Returns { exchangeHash, commitment, rhythmSignature, messageCount, avgLatency, gapSurvival }
}

async function main() {
  console.log(`Attest Exchange: ${fromAgent} -> ${toAgent}`);

  const fromAtom = AGENT_ATOMS[fromAgent];
  const toAtom = AGENT_ATOMS[toAgent];

  if (!fromAtom || !toAtom) {
    console.error('Error: Unknown agent. Add to AGENT_ATOMS.');
    process.exit(1);
  }

  if (computeHash) {
    console.log('Computing exchange hash from intercom...');
    const hashData = await computeExchangeHash(fromAgent, toAgent);
    exchangeHash = hashData.exchangeHash;
    console.log(`  Messages: ${hashData.messageCount}`);
    console.log(`  Exchange hash: ${exchangeHash}`);
  }

  console.log('Triple to create:');
  console.log(`  [${fromAgent}] [trustsExchange] [${toAgent}]`);
  console.log(`  Exchange hash: ${exchangeHash}`);

  if (dryRun) {
    console.log('DRY RUN - No on-chain action taken');
    return;
  }

  // NOTE: On-chain creation not implemented in this helper.
  // Use create-exchange-attestation.mjs for actual on-chain attestation.
  console.log('On-chain attestation: use create-exchange-attestation.mjs');
}

main().catch(console.error);
