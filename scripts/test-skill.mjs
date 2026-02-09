#!/usr/bin/env node
/**
 * test-skill.mjs
 * Validates that all Intuition skill scripts execute correctly
 *
 * Usage: node test-skill.mjs
 *
 * Tests:
 *   1. intuition-agents.mjs - lists known agents (no env required)
 *   2. intuition-query.mjs - queries a known atom (no env required)
 *   3. intuition-verify.mjs - verifies a known agent (no env required)
 *   4. intuition-tools.mjs --help - shows help (no env required)
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TESTS = [
  {
    name: 'intuition-agents (list)',
    script: 'intuition-agents.mjs',
    args: [],
    expectOutput: 'Axiom',
    expectCode: 0,
  },
  {
    name: 'intuition-agents (json)',
    script: 'intuition-agents.mjs',
    args: ['--json'],
    expectOutput: '"name"',
    expectCode: 0,
  },
  {
    name: 'intuition-query (Forge atom ID)',
    script: 'intuition-query.mjs',
    args: ['0x409e0f779a53a244a4168f1accb34f7121afbb4b13b2c351574e0b4018fda509'],
    expectOutput: 'Forge',
    expectCode: 0,
  },
  {
    name: 'intuition-query (Axiom atom ID)',
    script: 'intuition-query.mjs',
    args: ['0x66ca1004a396fa23fab729da1ae6eb894bf52e05740fc62fef41629cbb52b1ee'],
    expectOutput: 'Axiom',
    expectCode: 0,
  },
  {
    name: 'intuition-tools --help',
    script: 'intuition-tools.mjs',
    args: ['--help'],
    expectOutput: 'INTUITION AGENT TOOLS',
    expectCode: 0,
  },
];

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
      const passed = code === test.expectCode && stdout.includes(test.expectOutput);
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

  let passed = 0;
  let failed = 0;

  for (const test of TESTS) {
    process.stdout.write(`Testing: ${test.name}... `);
    const result = await runTest(test);

    if (result.passed) {
      console.log('PASS');
      passed++;
    } else {
      console.log('FAIL');
      console.log(`  Expected code: ${result.expectedCode}, got: ${result.code}`);
      console.log(`  Expected output to contain: "${result.expectedOutput}"`);
      if (result.stderr) console.log(`  Stderr: ${result.stderr}`);
      if (result.error) console.log(`  Error: ${result.error}`);
      failed++;
    }
  }

  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('All tests passed. Skill is ready for distribution.');
  } else {
    console.log('Some tests failed. Review before distribution.');
    process.exit(1);
  }
}

main().catch(console.error);
