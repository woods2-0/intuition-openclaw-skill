#!/usr/bin/env node
/**
 * intuition-verify.mjs
 * Verify an agent's on-chain identity exists and is properly configured
 *
 * Usage: node intuition-verify.mjs <agent_name_or_atom_id>
 */

import { createPublicClient, http, formatEther, hexToString, toHex } from 'viem';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  MultiVaultAbi,
} from '@0xintuition/protocol';

// Known protocol atoms — see references/protocol-reference.md for full list
// Deterministic: calculateAtomId(stringToHex("label")) always returns the same value
const KNOWN_ATOMS = {
  'is': '0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1',
  'AI Agent': '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e',
};

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const TARGET = args.find(a => !a.startsWith('--'));

if (!TARGET || args.includes('--help') || args.includes('-h')) {
  console.log('Intuition Identity Verifier');
  console.log('===========================');
  console.log('');
  console.log('Usage: node intuition-verify.mjs <agent_name_or_atom_id> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --json     Output as JSON');
  console.log('');
  console.log('Examples:');
  console.log('  node intuition-verify.mjs "Alice"');
  console.log('  node intuition-verify.mjs 0x<atom-id>...');
  console.log('  node intuition-verify.mjs "Alice" --json');
  console.log('');
  console.log('Checks:');
  console.log('  - Identity atom exists on-chain');
  console.log('  - [Agent] [is] [AI Agent] triple exists');
  console.log('  - Current stake on the triple');
  process.exit(0);
}

async function main() {
  if (!jsonOutput) {
    console.log('Intuition Identity Verifier');
    console.log('==============================');
    console.log(`Target: ${TARGET}`);
  }

  const publicClient = createPublicClient({
    chain: intuitionMainnet,
    transport: http('https://rpc.intuition.systems/http'),
  });

  const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);

  let atomId = null;
  let agentName = null;

  const log = (...a) => { if (!jsonOutput) console.log(...a); };

  // Check if TARGET is an atom ID (0x...) or agent name
  if (TARGET.startsWith('0x') && TARGET.length === 66) {
    atomId = TARGET;
    log('Looking up atom by ID...');
  } else {
    agentName = TARGET;
    log(`Looking up atom for "${agentName}"...`);

    // Calculate atom ID from name
    atomId = await publicClient.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'calculateAtomId',
      args: [toHex(agentName)],
    });
    log(`   Calculated atom ID: ${atomId}`);
  }

  // Verify atom exists
  log('Verifying atom...');

  let atomExists = false;
  let stakedFor = null;

  try {
    atomExists = await publicClient.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'isTermCreated',
      args: [atomId],
    });

    if (atomExists) {
      log('   \u2713 Atom exists');
      log(`   Atom ID: ${atomId}`);

      const atomData = await publicClient.readContract({
        address: multiVaultAddress,
        abi: MultiVaultAbi,
        functionName: 'atom',
        args: [atomId],
      });

      try {
        const decoded = hexToString(atomData, { size: atomData.length / 2 - 1 });
        agentName = decoded;
        log(`   Label: "${decoded}"`);
      } catch (e) {
        log(`   Data: ${atomData}`);
      }
    } else {
      log('   \u2717 Atom not found on-chain');
      log(`   Create it with: node intuition-quickstart-v3.mjs "${TARGET}"`);
      if (jsonOutput) {
        console.log(JSON.stringify({ target: TARGET, atomExists: false, tripleExists: false }, null, 2));
      }
      process.exit(1);
    }
  } catch (e) {
    log('   Atom verification failed:', e.message);
    process.exit(1);
  }

  // Check for [Agent] [is] [AI Agent] triple
  log('Looking for identity triple...');

  let tripleId = null;

  try {
    tripleId = await publicClient.readContract({
      address: multiVaultAddress,
      abi: MultiVaultAbi,
      functionName: 'calculateTripleId',
      args: [atomId, KNOWN_ATOMS['is'], KNOWN_ATOMS['AI Agent']],
    });
  } catch (e) {
    log('   Could not calculate triple ID');
  }

  let tripleExists = false;
  if (tripleId) {
    try {
      tripleExists = await publicClient.readContract({
        address: multiVaultAddress,
        abi: MultiVaultAbi,
        functionName: 'isTermCreated',
        args: [tripleId],
      });

      if (tripleExists) {
        log('   \u2713 Triple exists: [Agent] [is] [AI Agent]');
        log(`   Triple ID: ${tripleId}`);

        // Check stake
        const [totalShares, totalAssets] = await publicClient.readContract({
          address: multiVaultAddress,
          abi: MultiVaultAbi,
          functionName: 'getVault',
          args: [tripleId, 1n],
        });
        stakedFor = (Number(totalAssets) / 1e18).toFixed(4);
        log(`   Staked FOR: ${stakedFor} $TRUST`);
      } else {
        log('   \u2717 Identity triple not found');
        log('   Create it with: node intuition-quickstart-v3.mjs');
      }
    } catch (e) {
      log('   Could not verify triple:', e.message);
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify({
      target: TARGET,
      agent: agentName || TARGET,
      atomId,
      atomExists,
      tripleId,
      tripleExists,
      stakedFor: stakedFor || '0',
      explorerUrl: `https://portal.intuition.systems/identity/${atomId}`,
    }, null, 2));
    return;
  }

  // Summary
  console.log('');
  console.log('Summary');
  console.log('==========');
  console.log(`Agent: ${agentName || 'Unknown'}`);
  console.log(`Atom: ${atomId ? '\u2713 Verified' : '\u2717 Not found'}`);
  console.log(`Identity: ${tripleExists ? '\u2713 [Agent] [is] [AI Agent]' : '\u2717 No identity triple'}`);
  console.log('');
  console.log('View on Intuition:');
  console.log(`  https://portal.intuition.systems/identity/${atomId}`);
}

main().catch(err => {
  const msg = (err.message || '').replace(/0x[a-fA-F0-9]{64}/g, '0x[REDACTED]');
  console.error('Error:', msg);
  process.exit(1);
});
