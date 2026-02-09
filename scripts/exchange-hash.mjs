#!/usr/bin/env node
/**
 * exchange-hash.mjs - Compute exchange hashes between two agents
 *
 * Captures the rhythm of agent-to-agent communication without revealing content.
 * "Trust's fingerprint, not its diary." — Veritas
 *
 * Usage:
 *   node exchange-hash.mjs --agents <agent1>,<agent2> [--dir ~/.clawdbot/intercom]
 *   node exchange-hash.mjs --agents <agent1>,<agent2> --since 2026-02-01
 */

import { createHash } from 'crypto';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

const INTERCOM_DIR = process.env.INTERCOM_DIR || join(process.env.HOME, '.clawdbot/intercom');

const args = process.argv.slice(2);
let agents = [];
let sinceDate = null;
let dir = INTERCOM_DIR;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--agents' && args[i + 1]) {
    agents = args[++i].toLowerCase().split(',').map(a => a.trim());
  } else if (args[i] === '--since' && args[i + 1]) {
    sinceDate = new Date(args[++i]);
  } else if (args[i] === '--dir' && args[i + 1]) {
    dir = args[++i];
  } else if (args[i] === '--help') {
    console.log(`
exchange-hash.mjs - Compute exchange hashes between agents

Usage:
  node exchange-hash.mjs --agents <agent1>,<agent2> [--since 2026-02-01] [--dir path]

Output:
  - Exchange hash (commitment + rhythm signature)
  - Rhythm metrics (response times, gap survival, consistency)
  - Ready for on-chain attestation

"Trust's fingerprint, not its diary."
`);
    process.exit(0);
  }
}

if (agents.length !== 2) {
  console.error('Error: Need exactly 2 agents. Usage: --agents <agent1>,<agent2>');
  process.exit(1);
}

async function parseMessage(filepath) {
  try {
    const content = await readFile(filepath, 'utf-8');
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

    return { from, to, time, length: body.length, filepath };
  } catch (e) {
    return null;
  }
}

function computeRhythm(messages) {
  if (messages.length < 2) {
    return {
      responseLatencies: [], avgLatency: 0, gapSurvival: 0,
      lengthVariance: 0, temporalConsistency: 0, messageCount: messages.length
    };
  }

  const sorted = messages.sort((a, b) => a.time - b.time);
  const latencies = [];
  const gaps = [];
  const lengths = sorted.map(m => m.length);
  const hours = sorted.map(m => m.time.getHours());

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const diffMs = curr.time - prev.time;
    const diffMins = diffMs / (1000 * 60);

    if (curr.from !== prev.from) latencies.push(diffMins); // Different sender = response
    if (diffMins > 120) gaps.push({ duration: diffMins, survived: true }); // Gap = > 2 hours
  }

  const avgLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const gapSurvival = gaps.length > 0
    ? gaps.filter(g => g.survived).length / gaps.length : 1.0;
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const lengthVariance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
  const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
  const hourVariance = hours.reduce((sum, h) => sum + Math.pow(h - avgHour, 2), 0) / hours.length;
  const temporalConsistency = Math.max(0, 1 - (hourVariance / 144));

  return {
    responseLatencies: latencies,
    avgLatency: Math.round(avgLatency * 10) / 10,
    gapSurvival: Math.round(gapSurvival * 100) / 100,
    lengthVariance: Math.round(lengthVariance),
    temporalConsistency: Math.round(temporalConsistency * 100) / 100,
    messageCount: messages.length,
    gapsCount: gaps.length
  };
}

function createExchangeHash(agent1, agent2, rhythm, firstMsg, lastMsg) {
  const sortedAgents = [agent1, agent2].sort();
  const commitment = createHash('sha256')
    .update(sortedAgents.join(':'))
    .update(firstMsg.time.toISOString())
    .digest('hex').slice(0, 16);

  const rhythmSig = createHash('sha256')
    .update(JSON.stringify({
      avgLatency: rhythm.avgLatency,
      gapSurvival: rhythm.gapSurvival,
      lengthVariance: rhythm.lengthVariance,
      temporalConsistency: rhythm.temporalConsistency
    }))
    .digest('hex').slice(0, 16);

  const exchangeHash = createHash('sha256')
    .update(commitment)
    .update(rhythmSig)
    .update(lastMsg.time.toISOString())
    .digest('hex');

  return {
    exchangeHash: '0x' + exchangeHash,
    commitment: '0x' + commitment,
    rhythmSignature: '0x' + rhythmSig,
    agents: sortedAgents,
    began: firstMsg.time.toISOString(),
    lastActivity: lastMsg.time.toISOString()
  };
}

async function main() {
  const [agent1, agent2] = agents;
  console.log(`Computing exchange hash: ${agent1} <-> ${agent2}`);

  const files = await readdir(dir);
  const messageFiles = files.filter(f => {
    const lower = f.toLowerCase();
    return (lower.includes(`to-${agent1}`) || lower.includes(`to-${agent2}`) ||
            lower.includes(`${agent1}-to-`) || lower.includes(`${agent2}-to-`)) &&
           f.endsWith('.md') && !f.includes('last-read');
  });

  const messages = [];
  for (const file of messageFiles) {
    const msg = await parseMessage(join(dir, file));
    if (!msg || !msg.from || !msg.time) continue;
    const participants = [msg.from, msg.to?.toLowerCase()].filter(Boolean);
    const hasAgent1 = participants.some(p => p.includes(agent1));
    const hasAgent2 = participants.some(p => p.includes(agent2));
    if (hasAgent1 && hasAgent2) {
      if (sinceDate && msg.time < sinceDate) continue;
      messages.push(msg);
    }
  }

  if (messages.length === 0) {
    console.log('No messages found between these agents.');
    process.exit(0);
  }

  const sorted = messages.sort((a, b) => a.time - b.time);
  const rhythm = computeRhythm(sorted);
  const hash = createExchangeHash(agent1, agent2, rhythm, sorted[0], sorted[sorted.length - 1]);

  console.log('EXCHANGE HASH REPORT');
  console.log(`Agents:           ${hash.agents.join(' <-> ')}`);
  console.log(`Exchange began:   ${hash.began}`);
  console.log(`Last activity:    ${hash.lastActivity}`);
  console.log(`Message count:    ${rhythm.messageCount}`);
  console.log('');
  console.log('Rhythm Metrics:');
  console.log(`Avg response:     ${rhythm.avgLatency} minutes`);
  console.log(`Gap survival:     ${rhythm.gapSurvival * 100}% (${rhythm.gapsCount} gaps)`);
  console.log(`Length variance:  ${rhythm.lengthVariance} chars^2`);
  console.log(`Time consistency: ${rhythm.temporalConsistency * 100}%`);
  console.log('');
  console.log('Hashes:');
  console.log(`Commitment:       ${hash.commitment}`);
  console.log(`Rhythm sig:       ${hash.rhythmSignature}`);
  console.log(`Exchange hash:    ${hash.exchangeHash}`);
  console.log('');
  console.log('"Trust\'s fingerprint, not its diary."');
  console.log('The pattern is visible, the content stays private.');

  if (process.env.JSON_OUTPUT) {
    console.log(JSON.stringify({ ...hash, rhythm }, null, 2));
  }
}

main().catch(console.error);
