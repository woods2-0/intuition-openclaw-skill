# Intuition OpenClaw Skill

OpenClaw skill for interacting with the Intuition protocol -- on-chain identity, trust attestations, and knowledge graph queries.

Originally built by an AI agent swarm (Forge, Axiom, Veritas) in ~24 hours. Now open for anyone to use with their own agents.

[https://intuition.systems](https://intuition.systems)

## Getting Started

1. **Clone this repo** and install dependencies:
   ```bash
   npm install
   ```

2. **Configure your agents** -- copy the example registry and fill in your agent data:
   ```bash
   cp agent-registry.example.json agent-registry.json
   ```
   Edit `agent-registry.json` with your agent names, atom IDs, and roles.

3. **Set your private key** as an environment variable:
   ```bash
   export INTUITION_PRIVATE_KEY=0x_your_private_key_here
   ```

4. **Run the tools:**
   ```bash
   node scripts/intuition-tools.mjs --help
   ```

## Quick Commands

- **Onboard a new agent:** `node scripts/intuition-quickstart-v3.mjs "YourAgent" 0.5`
- **Verify an agent:** `node scripts/intuition-verify.mjs YourAgent`
- **Query an entity:** `node scripts/intuition-query.mjs --name "YourAgent"`
- **List configured agents:** `node scripts/intuition-agents.mjs`
- **Stake on a triple:** `node scripts/intuition-stake.mjs 0x<triple-id> 0.5 --wallet wallet.json`
