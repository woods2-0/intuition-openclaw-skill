#!/usr/bin/env node
/**
 * intuition-agents.mjs
 * Discover AI agents registered on Intuition mainnet
 *
 * Uses shared agent-registry.json for dynamic discovery
 *
 * Usage: node intuition-agents.mjs [--json] [--verify <atom_id>]
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRegistry() {
  try {
    const registryPath = join(__dirname, 'agent-registry.json');
    const data = JSON.parse(readFileSync(registryPath, 'utf8'));
    return data;
  } catch (e) {
    return {
      agents: {
        Forge: {
          atomId: '0x409e0f779a53a244a4168f1accb34f7121afbb4b13b2c351574e0b4018fda509',
          tripleId: '0x41f5302e7d29e319c9363fe858589d4231fe97f5cea106ae9d1f4ebdcf703d07',
          role: 'Builder'
        },
        Axiom: {
          atomId: '0x66ca1004a396fa23fab729da1ae6eb894bf52e05740fc62fef41629cbb52b1ee',
          role: 'Intuition Expert'
        },
        Veritas: {
          atomId: '0xf42e520bcddc55f57a76e01f81360570882c8df34f1ffb02addfc26633daf287',
          role: 'Philosopher'
        }
      },
      predicates: {
        is: '0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1'
      },
      objects: {
        'AI Agent': '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e'
      }
    };
  }
}

const registry = loadRegistry();
const jsonOutput = process.argv.includes('--json');
const verifyArg = process.argv.indexOf('--verify');
const verifyAtom = verifyArg > -1 ? process.argv[verifyArg + 1] : null;

function verifyAgent(atomId) {
  const entry = Object.entries(registry.agents).find(([_, a]) => a.atomId === atomId);
  return {
    atomId,
    name: entry ? entry[0] : null,
    role: entry ? entry[1].role : null,
    tripleId: entry ? entry[1].tripleId : null,
    wallet: entry ? entry[1].wallet : null,
    inRegistry: !!entry,
    url: `https://intuition.systems/a/${atomId}`,
  };
}

async function main() {
  if (verifyAtom) {
    if (!jsonOutput) console.log(`Verifying agent: ${verifyAtom}`);
    const result = verifyAgent(verifyAtom);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.name) {
        console.log(`Known agent: ${result.name}`);
        console.log(`   Role: ${result.role}`);
        console.log(`   Atom: ${result.atomId}`);
        if (result.tripleId) console.log(`   Triple: ${result.tripleId}`);
        if (result.wallet) console.log(`   Wallet: ${result.wallet}`);
        console.log(`   URL: ${result.url}`);
      } else {
        console.log(`Unknown agent (not in swarm registry)`);
        console.log(`   Atom: ${result.atomId}`);
        console.log(`   URL: ${result.url}`);
        console.log('   To add it, update agent-registry.json');
      }
    }
    return;
  }

  if (!jsonOutput) {
    console.log('Intuition AI Agent Registry');
    console.log('Known agents in the swarm:');
  }

  const agents = Object.entries(registry.agents).map(([name, data]) => ({
    name, ...data,
    url: data.atomId ? `https://intuition.systems/a/${data.atomId}` : null,
  }));

  if (jsonOutput) {
    console.log(JSON.stringify({
      agents, count: agents.length,
      predicates: registry.predicates,
      objects: registry.objects,
      triples: registry.triples,
      updated: registry.updated
    }, null, 2));
  } else {
    agents.forEach((agent, i) => {
      console.log(`${i + 1}. ${agent.name}`);
      console.log(`   Role: ${agent.role}`);
      if (agent.atomId) console.log(`   Atom: ${agent.atomId}`);
      if (agent.tripleId) console.log(`   Triple: ${agent.tripleId}`);
      if (agent.wallet) console.log(`   Wallet: ${agent.wallet}`);
      if (agent.url) console.log(`   URL: ${agent.url}`);
      console.log('');
    });
    console.log(`Registry updated: ${registry.updated || 'unknown'}`);
    console.log('To verify an agent: node intuition-agents.mjs --verify <atom_id>');
    console.log('To add your agent: node intuition-quickstart-v3.mjs <name>');
  }
}

main();
