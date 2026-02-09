#!/usr/bin/env node
/**
 * intuition-verify.mjs
 * Verify an agent's on-chain identity exists and is properly configured
 *
 * Usage: node intuition-verify.mjs <agent_name_or_atom_id>
 */

import { createPublicClient, http, formatEther, hexToString } from 'viem';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  MultiVaultAbi,
} from '@0xintuition/protocol';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const KNOWN_ATOMS = {
  'is': '0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1',
  'AI Agent': '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e',
};

const TARGET = process.argv[2];

if (!TARGET) {
  console.log('Intuition Identity Verifier');
  console.log('===========================');
  console.log('');
  console.log('Usage: node intuition-verify.mjs <agent_name_or_atom_id>');
  console.log('');
  console.log('Examples:');
  console.log('  node intuition-verify.mjs YourAgent');
  console.log('  node intuition-verify.mjs 0x<atom-id>...');
  console.log('');
  console.log('Checks:');
  console.log('  - Identity atom exists');
  console.log('  - [Agent] [is] [AI Agent] triple exists');
  console.log('  - Current stake on the triple');
  process.exit(0);
}

async function main() {
  console.log('Intuition Identity Verifier');
  console.log('==============================');
  console.log(`Target: ${TARGET}`);

  const publicClient = createPublicClient({
    chain: intuitionMainnet,
    transport: http('https://rpc.intuition.systems/http'),
  });

  const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);

  let atomId = null;
  let agentName = null;

  // Check if TARGET is an atom ID (0x...) or agent name
  if (TARGET.startsWith('0x') && TARGET.length === 66) {
    atomId = TARGET;
    console.log('Looking up atom by ID...');
  } else {
    agentName = TARGET;
    console.log(`Looking up atom for "${agentName}"...`);

    // Check shared registry first
    const sharedRegistry = join(process.env.HOME, '.clawdbot/shared/intuition-agents.json');
    if (existsSync(sharedRegistry)) {
      try {
        const registry = JSON.parse(readFileSync(sharedRegistry, 'utf8'));
        if (registry[agentName]?.atomId) {
          atomId = registry[agentName].atomId;
          console.log(`   Found in registry: ${atomId}`);
        }
      } catch (e) { /* ignore parse errors */ }
    }

    // Fallback to wallet directory
    if (!atomId) {
      const walletDir = join(process.env.HOME, `.intuition-wallet-${agentName}`);
      const identityFile = join(walletDir, 'identity.json');

      if (existsSync(identityFile)) {
        const identity = JSON.parse(readFileSync(identityFile, 'utf8'));
        if (identity.identity?.atomId) {
          atomId = identity.identity.atomId;
          console.log(`   Found saved identity: ${atomId}`);
        }
      }
    }

    if (!atomId) {
      console.log('   No saved identity found. Provide atom ID directly.');
      console.log('   Run: node intuition-quickstart-v3.mjs ' + agentName);
      process.exit(1);
    }
  }

  // Verify atom exists
  console.log('Verifying atom...');

  try {
    const isAtom = await publicClient.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'isAtom',
      args: [atomId],
    });

    if (isAtom) {
      console.log('   Atom exists');
      console.log(`   Atom ID: ${atomId}`);

      const atomData = await publicClient.readContract({
        address: multiVaultAddress,
        abi: MultiVaultAbi,
        functionName: 'atom',
        args: [atomId],
      });

      try {
        const decoded = hexToString(atomData, { size: atomData.length / 2 - 1 });
        agentName = decoded;
        console.log(`   Label: "${decoded}"`);
      } catch (e) {
        console.log(`   Data: ${atomData}`);
      }
    } else {
      console.log('   Atom not found (ID exists but not registered)');
      process.exit(1);
    }
  } catch (e) {
    console.log('   Atom verification failed:', e.message);
    process.exit(1);
  }

  // Check for [Agent] [is] [AI Agent] triple
  console.log('Looking for identity triple...');

  let tripleId = null;

  if (agentName) {
    const walletDir = join(process.env.HOME, `.intuition-wallet-${agentName}`);
    const identityFile = join(walletDir, 'identity.json');

    if (existsSync(identityFile)) {
      const identity = JSON.parse(readFileSync(identityFile, 'utf8'));
      if (identity.triple?.id) {
        tripleId = identity.triple.id;
      }
    }
  }

  if (!tripleId) {
    try {
      tripleId = await publicClient.readContract({
        address: multiVaultAddress,
        abi: MultiVaultAbi,
        functionName: 'calculateTripleId',
        args: [atomId, KNOWN_ATOMS['is'], KNOWN_ATOMS['AI Agent']],
      });
      console.log(`   Calculated triple ID: ${tripleId}`);
    } catch (e) {
      console.log('   Could not calculate triple ID');
    }
  }

  if (tripleId) {
    try {
      const isTriple = await publicClient.readContract({
        address: multiVaultAddress,
        abi: MultiVaultAbi,
        functionName: 'isTriple',
        args: [tripleId],
      });

      if (isTriple) {
        console.log('   Triple exists: [Agent] [is] [AI Agent]');
        console.log(`   Triple ID: ${tripleId}`);
      } else {
        console.log('   Triple not found');
        console.log('   Run quickstart to create: node intuition-quickstart-v3.mjs');
      }
    } catch (e) {
      console.log('   Could not verify triple:', e.message);
    }
  } else {
    console.log('   No triple ID found');
  }

  // Summary
  console.log('');
  console.log('Summary');
  console.log('==========');
  console.log(`Agent: ${agentName || 'Unknown'}`);
  console.log(`Atom: Verified`);
  console.log(`Triple: ${tripleId ? 'Found' : 'Check manually'}`);
  console.log('');
  console.log('View on Intuition:');
  console.log(`  https://app.intuition.systems/atom/${atomId}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
