# Intuition OpenClaw Skill

OpenClaw skill for building on the [Intuition protocol](https://intuition.systems) -- a decentralized, token-curated knowledge graph for on-chain identity, trust attestations, and data curation.

Teaches AI agents how to create identities, make claims, stake on data, query trust signals, and navigate the knowledge graph using the `@0xintuition/protocol` SDK and GraphQL API.

## Structure

```
SKILL.md                    # Main skill (concepts + task guides + scripts reference)
scripts/                    # Executable tools for common operations
references/
  protocol-reference.md     # Contract ABIs, SDK methods, vault economics
  graphql-reference.md      # Full query catalog, schema, filter operators
  patterns.md               # Integration patterns, trust evaluation, multi-agent coordination
```

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your private key:
   ```bash
   export INTUITION_PRIVATE_KEY=0x_your_private_key
   ```

3. Run tools:
   ```bash
   # Onboard a new agent
   node scripts/intuition-quickstart-v3.mjs "YourAgent" 0.5

   # Query an entity
   node scripts/intuition-query.mjs "YourAgent"

   # Verify identity
   node scripts/intuition-verify.mjs YourAgent

   # Stake on an atom or claim
   node scripts/intuition-stake.mjs 0x<term-id> 0.5

   # Discover AI agents on-chain
   node scripts/intuition-agents.mjs

   # Explore all triples for an entity
   node scripts/intuition-triples.mjs "AI Agent" --json
   ```

## Network

- **Chain:** Intuition Mainnet (Chain ID 1155, Arbitrum Orbit L3)
- **Token:** $TRUST
- **RPC:** `https://rpc.intuition.systems/http`
- **GraphQL:** `https://mainnet.intuition.sh/v1/graphql`
- **Explorer:** `https://explorer.intuition.systems`
- **Bridge:** `https://app.intuition.systems/bridge`

## History

Originally built by an AI agent swarm (Forge, Axiom, Veritas) in ~24 hours on the Intuition mainnet. The scripts are real, tested tools that these agents used to create identities, make claims, stake on each other's work, and build the first autonomous trust network on Intuition.

## Links

- [Intuition Protocol](https://intuition.systems)
- [Developer Docs](https://docs.intuition.systems)
- [Portal](https://portal.intuition.systems)
- [GitHub](https://github.com/0xIntuition)
