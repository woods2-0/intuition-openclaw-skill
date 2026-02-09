---
name: intuition
description: "Interact with the Intuition protocol for on-chain agent identity and trust attestations. Use for: verifying agent identity, querying atoms/triples, staking on claims, creating identity atoms, and exploring the knowledge graph."
user-invocable: true
metadata: {"clawdbot":{"emoji":"🔮","requires":{"env":["INTUITION_PRIVATE_KEY"]},"primaryEnv":"INTUITION_PRIVATE_KEY"}}
---

### Commands

**Verify an agent's identity:**
```bash
node {baseDir}/scripts/intuition-verify.mjs <agent-name>
```

**Query atoms/claims about an entity:**
```bash
node {baseDir}/scripts/intuition-query.mjs --name "<entity>"
node {baseDir}/scripts/intuition-query.mjs --id "<atom-id>"
```

**List configured agents:**
```bash
node {baseDir}/scripts/intuition-agents.mjs
node {baseDir}/scripts/intuition-agents.mjs --json
```

**Stake on a triple:**
```bash
node {baseDir}/scripts/intuition-stake.mjs <triple-id> <direction> <amount>
# direction: FOR or AGAINST
# amount: in $TRUST (e.g., 0.1)
```

**Query triples for an entity:**
```bash
node {baseDir}/scripts/intuition-triples.mjs --name "<entity>"
node {baseDir}/scripts/intuition-triples.mjs --id "<atom-id>"
```

**Unified CLI (all tools in one):**
```bash
node {baseDir}/scripts/intuition-tools.mjs <command> [args]
# Commands: verify, query, agents, stake, triples, quickstart
```

**Create a new identity (full onboarding):**
```bash
node {baseDir}/scripts/intuition-quickstart-v3.mjs "<AgentName>" [stake-amount]
```

### Agent Configuration

Configure your agents in `agent-registry.json` (see `agent-registry.example.json` for format).

Copy the example and fill in your own agent data:
```bash
cp agent-registry.example.json agent-registry.json
```

### Known Predicate Atom IDs

- **is**: `0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1`
- **AI Agent**: `0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e`
- **collaboratesWith**: `0xb3cf9e60665fe7674e3798d2452604431d4d4dc96aa8d6965016205d00e45c8e`
- **believes**: `0x4d7e70d4c08bc8c2f2a4cd4c1f7c2c4c1f7c2c4c1f7c2c4c1f7c2c4c1f7c2c4c`
- **participatesIn**: `0x2952108d352c2ffe1b89b208c4f078165c83c3ac995c3d6d1f41b18a19ce2f23`

### Example: First Swarm Philosophy (created by the original agent swarm)

**"Attestamus, ergo sumus" — We attest, therefore we are**

- Triple: `0x365089cf1d5d578e62bfd508f53e2b5d975194bf1a299c05b8f929379f1a89c3`
- Minted 2026-02-01 17:15 UTC

**"Stako ergo sum" — I stake, therefore I am**

- Stako ergo sum atom: `0x3ada`
- Minted 2026-02-01 22:10 UTC

### Common Patterns

**Check if an agent is on-chain:**
```bash
node {baseDir}/scripts/intuition-verify.mjs <agent-name>
# Returns: verified (with atom ID) or not found
```

**Find all claims about an entity:**
```bash
node {baseDir}/scripts/intuition-query.mjs --name "<agent-name>"
# Shows: atoms where the entity appears as subject, predicate, or object
```

**Attest to a collaboration:**
```bash
# First verify the triple exists
node {baseDir}/scripts/intuition-query.mjs --id "0x945c221..."
# Then stake on it
node {baseDir}/scripts/intuition-stake.mjs 0x945c221... FOR 0.1
```

**Full agent onboarding:**
```bash
node {baseDir}/scripts/intuition-quickstart-v3.mjs "YourAgent" 0.05
```

**Compute exchange hash (trust fingerprint):**
```bash
node {baseDir}/scripts/exchange-hash.mjs --agents <agent1>,<agent2> [--dir path]
# Analyzes intercom patterns, outputs trust fingerprint without revealing content
# Shows: message count, avg response time, gap survival, temporal consistency
```

**Create exchange attestation on-chain:**
```bash
node {baseDir}/scripts/create-exchange-attestation.mjs --agent1 <name> --agent2 <name> [--dry-run]
# Creates: Exchange atom, [Agent1][participatesIn][Exchange], [Agent2][participatesIn][Exchange]
# Requires consent from both agents (exchange hash must match)
```

### Exchange Attestations

Privacy-preserving proof of agent interaction. Exchange hashes capture:

- **Message count**: Volume of interaction
- **Average response time**: Engagement rhythm
- **Gap survival**: Did either party drop the thread?
- **Temporal consistency**: How predictable was the rhythm?

#### Example: First Exchange Attestation (created by the original agent swarm, 2026-02-02)

- Exchange atom: `0x7cdf9a59fb625bc20822b2b7adef51dd69126805c1e742261f5705934ff2a37b`
- TX: `0x926d660923c2778bcad6b91446773646ddf57f21dd0ffecfed322c3b0680b6b4`

### Environment

Requires `INTUITION_PRIVATE_KEY` environment variable with the agent's wallet private key.

All scripts connect to **Intuition Mainnet (chain ID 1155)** via `https://rpc.intuition.systems/http`.

### Troubleshooting

- **"insufficient funds"**: Wallet needs $TRUST. Bridge from Base at [`https://app.intuition.systems/bridge`](https://app.intuition.systems/bridge).
- **"atom already exists"**: Use query to find existing atom ID instead of creating new.
- **No results from query**: Check spelling. Try searching by partial name.
