#!/usr/bin/env node
/**
 * intuition-health.mjs - Validate skill setup and connectivity
 *
 * Checks:
 *   1. Dependencies installed (@0xintuition/protocol, viem)
 *   2. RPC connectivity (Intuition L3)
 *   3. GraphQL connectivity
 *   4. Known atom IDs match on-chain calculated values
 *   5. Wallet configured and funded (if INTUITION_PRIVATE_KEY set)
 *
 * Usage: node intuition-health.mjs [options]
 *
 * Options:
 *   --json    Output as JSON
 */

const GRAPHQL_ENDPOINT = 'https://mainnet.intuition.sh/v1/graphql';

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
intuition-health.mjs - Validate skill setup and connectivity

Usage:
  node intuition-health.mjs [options]

Options:
  --json    Output as JSON

Checks:
  1. Dependencies installed (@0xintuition/protocol, viem)
  2. RPC connectivity (Intuition L3)
  3. GraphQL API reachable
  4. Known atom IDs match on-chain calculated values
  5. Wallet configured and funded (if INTUITION_PRIVATE_KEY set)

Run this before using any write scripts to verify everything is working.
`);
  process.exit(0);
}

const results = [];

function check(name, status, detail) {
  results.push({ name, status, detail });
}

const log = (...a) => { if (!jsonOutput) console.log(...a); };

async function main() {
  log('Intuition Health Check');
  log('======================');
  log('');

  // Check 1: Dependencies
  log('1. Dependencies...');
  let protocol, viem;
  try {
    protocol = await import('@0xintuition/protocol');
    check('dependencies.protocol', 'pass', '@0xintuition/protocol loaded');
    log('   \u2713 @0xintuition/protocol');
  } catch (e) {
    check('dependencies.protocol', 'fail', 'Missing @0xintuition/protocol — run npm install');
    log('   \u2717 @0xintuition/protocol — run npm install');
  }

  try {
    viem = await import('viem');
    check('dependencies.viem', 'pass', 'viem loaded');
    log('   \u2713 viem');
  } catch (e) {
    check('dependencies.viem', 'fail', 'Missing viem — run npm install');
    log('   \u2717 viem — run npm install');
  }

  if (!protocol || !viem) {
    log('\n\u2717 Dependencies missing. Run: npm install');
    outputResults();
    process.exit(1);
  }

  const {
    intuitionMainnet,
    getMultiVaultAddressFromChainId,
    MultiVaultAbi,
  } = protocol;

  const { createPublicClient, http, toHex, formatEther } = viem;

  const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);

  // Check 2: RPC Connectivity
  log('\n2. RPC Connectivity...');
  let publicClient;
  try {
    publicClient = createPublicClient({
      chain: intuitionMainnet,
      transport: http('https://rpc.intuition.systems/http'),
    });

    const chainId = await publicClient.getChainId();
    if (chainId === intuitionMainnet.id) {
      check('rpc', 'pass', `Connected to chain ${chainId}`);
      log(`   \u2713 Connected to Intuition L3 (chain ${chainId})`);
    } else {
      check('rpc', 'fail', `Unexpected chain ID: ${chainId}, expected ${intuitionMainnet.id}`);
      log(`   \u2717 Unexpected chain ID: ${chainId}`);
    }
  } catch (e) {
    check('rpc', 'fail', `RPC unreachable: ${e.message}`);
    log('   \u2717 RPC unreachable — https://rpc.intuition.systems/http');
    log('     This may be temporary. Retry in a few seconds.');
    outputResults();
    process.exit(1);
  }

  // Check 3: GraphQL Connectivity
  log('\n3. GraphQL API...');
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ atoms(limit: 1) { term_id } }',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.atoms) {
        check('graphql', 'pass', 'GraphQL reachable and returning data');
        log('   \u2713 GraphQL API reachable');
      } else {
        check('graphql', 'warn', 'GraphQL reachable but returned unexpected data');
        log('   \u26a0 GraphQL reachable but returned unexpected data');
      }
    } else {
      check('graphql', 'fail', `GraphQL returned ${response.status}`);
      log(`   \u2717 GraphQL returned ${response.status}`);
    }
  } catch (e) {
    check('graphql', 'fail', `GraphQL unreachable: ${e.message}`);
    log('   \u2717 GraphQL unreachable — https://mainnet.intuition.sh/v1/graphql');
  }

  // Check 4: Known Atom IDs
  log('\n4. Known Atom IDs...');

  // These are the hardcoded IDs used across scripts (quickstart, query, verify)
  // Verify they match on-chain calculated values
  const knownAtoms = {
    'is': '0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1',
    'AI Agent': '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e',
    'collaboratesWith': '0xb3cf9e60665fe7674e3798d2452604431d4d4dc96aa8d6965016205d00e45c8e',
    'participatesIn': '0x2952108d352c2ffe1b89b208c4f078165c83c3ac995c3d6d1f41b18a19ce2f23',
  };

  let allAtomsMatch = true;
  for (const [label, expectedId] of Object.entries(knownAtoms)) {
    try {
      const calculatedId = await publicClient.readContract({
        address: multiVaultAddress,
        abi: MultiVaultAbi,
        functionName: 'calculateAtomId',
        args: [toHex(label)],
      });

      // Convert BigInt to hex string for comparison
      const calculatedHex = typeof calculatedId === 'bigint'
        ? '0x' + calculatedId.toString(16).padStart(64, '0')
        : calculatedId;

      if (calculatedHex.toLowerCase() === expectedId.toLowerCase()) {
        check(`atom.${label}`, 'pass', `"${label}" ID matches on-chain`);
        log(`   \u2713 "${label}" → ${expectedId.slice(0, 10)}...`);
      } else {
        check(`atom.${label}`, 'fail', `"${label}" mismatch! Expected ${expectedId}, got ${calculatedHex}`);
        log(`   \u2717 "${label}" MISMATCH`);
        log(`     Expected: ${expectedId}`);
        log(`     Got:      ${calculatedHex}`);
        allAtomsMatch = false;
      }
    } catch (e) {
      check(`atom.${label}`, 'fail', `Could not verify "${label}": ${e.message}`);
      log(`   \u2717 Could not verify "${label}"`);
      allAtomsMatch = false;
    }
  }

  if (allAtomsMatch) {
    log('   All known atom IDs verified against on-chain contract.');
  } else {
    log('   \u26a0 Some atom IDs do not match. Protocol may have changed.');
  }

  // Check 5: Wallet (optional)
  log('\n5. Wallet...');
  if (process.env.INTUITION_PRIVATE_KEY) {
    try {
      const { privateKeyToAccount } = await import('viem/accounts');
      const account = privateKeyToAccount(process.env.INTUITION_PRIVATE_KEY);
      check('wallet.configured', 'pass', `Wallet: ${account.address}`);
      log(`   \u2713 INTUITION_PRIVATE_KEY set`);
      log(`   Address: ${account.address}`);

      const balance = await publicClient.getBalance({ address: account.address });
      const balanceEth = formatEther(balance);
      const balanceNum = parseFloat(balanceEth);

      if (balanceNum > 1) {
        check('wallet.funded', 'pass', `Balance: ${balanceEth} $TRUST`);
        log(`   \u2713 Balance: ${balanceEth} $TRUST`);
      } else if (balanceNum > 0) {
        check('wallet.funded', 'warn', `Low balance: ${balanceEth} $TRUST`);
        log(`   \u26a0 Low balance: ${balanceEth} $TRUST`);
        log('     Consider adding more $TRUST for write operations.');
      } else {
        check('wallet.funded', 'fail', 'Zero balance');
        log('   \u2717 Zero balance — wallet needs $TRUST');
        log('     See SKILL.md → "How to Get $TRUST" for instructions.');
      }
    } catch (e) {
      check('wallet.configured', 'fail', `Invalid key: ${e.message}`);
      log('   \u2717 INTUITION_PRIVATE_KEY is set but invalid');
    }
  } else {
    check('wallet.configured', 'skip', 'INTUITION_PRIVATE_KEY not set');
    log('   - INTUITION_PRIVATE_KEY not set (optional — only needed for writes)');
  }

  // Summary
  log('');
  log('Summary');
  log('=======');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  log(`\u2713 ${passed} passed  ${failed > 0 ? `\u2717 ${failed} failed  ` : ''}${warned > 0 ? `\u26a0 ${warned} warnings  ` : ''}${skipped > 0 ? `- ${skipped} skipped` : ''}`);

  if (failed === 0) {
    log('\nSkill is healthy and ready to use.');
  } else {
    log('\nSome checks failed. Review the issues above.');
  }

  outputResults();
  process.exit(failed > 0 ? 1 : 0);
}

function outputResults() {
  if (jsonOutput) {
    console.log(JSON.stringify({
      checks: results,
      summary: {
        passed: results.filter(r => r.status === 'pass').length,
        failed: results.filter(r => r.status === 'fail').length,
        warnings: results.filter(r => r.status === 'warn').length,
        skipped: results.filter(r => r.status === 'skip').length,
      },
      healthy: results.filter(r => r.status === 'fail').length === 0,
    }, null, 2));
  }
}

main().catch(err => {
  const msg = (err.message || '').replace(/0x[a-fA-F0-9]{64}/g, '0x[REDACTED]');
  console.error('Error:', msg);
  process.exit(1);
});
