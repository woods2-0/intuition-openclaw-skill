#!/usr/bin/env node
/**
 * test-skill.mjs
 * Validates that all Intuition skill scripts execute correctly
 *
 * Usage: node test-skill.mjs
 *
 * Tests:
 *   1. intuition-tools.mjs --help - shows help (no env required)
 *   2. intuition-agents.mjs --help - shows help
 *   3. intuition-query.mjs --help - shows help
 *   4. intuition-triples.mjs --help - shows help
 *   5. intuition-verify.mjs --help - shows help
 *   6. intuition-stake.mjs --help - shows help
 *
 * If INTUITION_PRIVATE_KEY is set and a test entity is provided,
 * also runs live on-chain query tests.
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEST_ENTITY = process.argv[2] || null;

const TESTS = [
  // Help output tests (always run, no env required)
  {
    name: 'intuition-tools --help',
    script: 'intuition-tools.mjs',
    args: ['--help'],
    expectOutput: 'INTUITION AGENT TOOLS',
    expectCode: 0,
  },
  {
    name: 'intuition-agents --help',
    script: 'intuition-agents.mjs',
    args: ['--help'],
    expectOutput: 'intuition-agents',
    expectCode: 0,
  },
  {
    name: 'intuition-query --help',
    script: 'intuition-query.mjs',
    args: ['--help'],
    expectOutput: 'intuition-query',
    expectCode: 0,
  },
  {
    name: 'intuition-triples --help',
    script: 'intuition-triples.mjs',
    args: ['--help'],
    expectOutput: 'intuition-triples',
    expectCode: 0,
  },
  {
    name: 'intuition-verify --help',
    script: 'intuition-verify.mjs',
    args: ['--help'],
    expectOutput: 'Identity Verifier',
    expectCode: 0,
  },
  {
    name: 'intuition-stake --help',
    script: 'intuition-stake.mjs',
    args: ['--help'],
    expectOutput: 'intuition-stake',
    expectCode: 0,
  },
  {
    name: 'intuition-redeem --help',
    script: 'intuition-redeem.mjs',
    args: ['--help'],
    expectOutput: 'intuition-redeem',
    expectCode: 0,
  },
  {
    name: 'intuition-positions --help',
    script: 'intuition-positions.mjs',
    args: ['--help'],
    expectOutput: 'intuition-positions',
    expectCode: 0,
  },
  {
    name: 'intuition-health --help',
    script: 'intuition-health.mjs',
    args: ['--help'],
    expectOutput: 'intuition-health',
    expectCode: 0,
  },
];

// If a test entity is provided, add live query tests
if (TEST_ENTITY) {
  TESTS.push(
    {
      name: `intuition-query "${TEST_ENTITY}"`,
      script: 'intuition-query.mjs',
      args: [TEST_ENTITY],
      expectOutput: 'Atom ID',
      expectCode: 0,
    },
    {
      name: `intuition-verify "${TEST_ENTITY}"`,
      script: 'intuition-verify.mjs',
      args: [TEST_ENTITY],
      expectOutput: 'Target:',
      expectCode: 0,
    },
    {
      name: `intuition-triples "${TEST_ENTITY}"`,
      script: 'intuition-triples.mjs',
      args: [TEST_ENTITY],
      expectOutput: 'Intuition Triples',
      expectCode: 0,
    },
  );
}

async function runTest(test) {
  return new Promise((resolve) => {
    const scriptPath = join(__dirname, test.script);
    const proc = spawn('node', [scriptPath, ...test.args], {
      cwd: __dirname,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      const passed = code === test.expectCode &&
        (stdout + stderr).includes(test.expectOutput);
      resolve({
        name: test.name, passed, code,
        expectedCode: test.expectCode,
        output: stdout.slice(0, 200),
        expectedOutput: test.expectOutput,
        stderr: stderr.slice(0, 200),
      });
    });

    setTimeout(() => {
      proc.kill();
      resolve({ name: test.name, passed: false, error: 'Timeout after 30s' });
    }, 30000);
  });
}

async function main() {
  console.log('INTUITION SKILL VALIDATION TESTS');
  console.log('================================');

  if (TEST_ENTITY) {
    console.log(`Test entity: "${TEST_ENTITY}" (will run live on-chain queries)`);
  } else {
    console.log('No test entity provided. Running help-only tests.');
    console.log('Usage: node test-skill.mjs "EntityName" for live tests.');
  }

  console.log('');

  let passed = 0;
  let failed = 0;

  for (const test of TESTS) {
    process.stdout.write(`  ${test.name}... `);
    const result = await runTest(test);

    if (result.passed) {
      console.log('PASS');
      passed++;
    } else {
      console.log('FAIL');
      console.log(`    Expected code: ${result.expectedCode}, got: ${result.code}`);
      console.log(`    Expected output to contain: "${result.expectedOutput}"`);
      if (result.stderr) console.log(`    Stderr: ${result.stderr}`);
      if (result.error) console.log(`    Error: ${result.error}`);
      failed++;
    }
  }

  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('All tests passed. Skill is ready for distribution.');
  } else {
    console.log('Some tests failed. Review before distribution.');
    process.exit(1);
  }
}

main().catch(console.error);
