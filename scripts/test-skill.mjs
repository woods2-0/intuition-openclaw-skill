#!/usr/bin/env node
/**
 * test-skill.mjs
 * Validates that all Intuition skill scripts execute correctly
 *
 * Usage: node test-skill.mjs
 *
 * Tests:
 *   1. intuition-agents.mjs - lists configured agents (requires agent-registry.json)
 *   2. intuition-query.mjs - queries a configured agent atom (requires agent-registry.json)
 *   3. intuition-tools.mjs --help - shows help (no env required)
 *
 * If agent-registry.json is not present, agent-specific tests are skipped.
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try to load registry for dynamic tests
let registry = null;
const registryPath = join(__dirname, '..', 'agent-registry.json');
if (existsSync(registryPath)) {
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  } catch (e) {
    console.warn('Warning: Could not parse agent-registry.json:', e.message);
  }
}

// Build test list dynamically
const TESTS = [];

// Always-available tests (no registry needed)
TESTS.push({
  name: 'intuition-tools --help',
  script: 'intuition-tools.mjs',
  args: ['--help'],
  expectOutput: 'INTUITION AGENT TOOLS',
  expectCode: 0,
});

if (registry && registry.agents) {
  const agentNames = Object.keys(registry.agents);
  const firstAgent = agentNames[0];
  const firstAgentData = registry.agents[firstAgent];

  if (firstAgent) {
    // Test agents list
    TESTS.push({
      name: 'intuition-agents (list)',
      script: 'intuition-agents.mjs',
      args: [],
      expectOutput: firstAgent,
      expectCode: 0,
    });

    TESTS.push({
      name: 'intuition-agents (json)',
      script: 'intuition-agents.mjs',
      args: ['--json'],
      expectOutput: '"name"',
      expectCode: 0,
    });

    // Test query with first agent's atom ID (if available)
    if (firstAgentData?.atomId && !firstAgentData.atomId.includes('_YOUR_')) {
      TESTS.push({
        name: `intuition-query (${firstAgent} atom ID)`,
        script: 'intuition-query.mjs',
        args: [firstAgentData.atomId],
        expectOutput: 'Atom ID',
        expectCode: 0,
      });
    }
  }
} else {
  console.log('NOTE: No agent-registry.json found. Skipping agent-specific tests.');
  console.log('  To enable full tests: cp agent-registry.example.json agent-registry.json');
  console.log('  Then fill in your agent data.');
  console.log('');
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

  if (TESTS.length === 0) {
    console.log('No tests to run. Create agent-registry.json to enable full testing.');
    process.exit(0);
  }

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
