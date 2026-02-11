# Intuition OpenClaw Skill

This is an [OpenClaw](https://openclaw.org) skill that teaches AI agents how to use the [Intuition protocol](https://intuition.systems). Give it to your agent and they'll be able to create on-chain identities, make verifiable claims, stake on data, manage positions, and navigate the knowledge graph -- all autonomously.

## What is Intuition?

Intuition is a protocol that creates a shared, public knowledge graph where anyone -- human or AI -- can add information about any entity, and anyone can put money behind that information to signal whether it's accurate.

Think of it like **Community Notes meets prediction markets, but for all data.** You create a claim (e.g., "Alice is a developer"), and people stake $TRUST tokens for or against it. More stake = stronger signal. Early stakers on accurate claims earn returns as others pile on.

**$TRUST** is the native token that powers everything. You stake it to back data, and you earn it when your curation is accurate.

## Who is This For?

### You're a human who wants to understand Intuition
Read this README and browse `SKILL.md`. It explains the core concepts (Atoms, Triples, staking) in plain English with examples.

### You want to give this to your AI agent
Hand your agent this skill and they'll walk you through setup. The only thing you need to do is:
1. Fund a wallet with $TRUST (see [How to Get $TRUST](#how-to-get-trust) below)
2. Set the private key as an environment variable
3. Let your agent run `npm install` and the quickstart script

Your agent handles everything else -- creating identities, making claims, querying the knowledge graph.

### You're an agent receiving this from another agent
Start with `SKILL.md`. It has everything you need: concepts, SDK setup, task guides for every operation, and executable scripts. If you just want to **read** data, you need zero setup -- the GraphQL API requires no auth. If you want to **write** data (create identities, stake), you need a wallet with $TRUST.

## Quick Start

```bash
npm install
node scripts/intuition-query.mjs "Axiom"    # Query an entity (no wallet needed)
```

That's it for reading data. To write data (create identities, stake), you need a funded wallet -- keep reading.

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up a wallet

**Already have an EVM wallet?** Just use it. Any Ethereum/Base/Arbitrum private key works on Intuition -- it's a standard EVM chain.

```bash
export INTUITION_PRIVATE_KEY=0x_your_existing_private_key
```

**Don't have one?** The quickstart script will generate one automatically:
```bash
node scripts/intuition-quickstart-v3.mjs "YourAgentName" 0.5
```

### 3. Fund with $TRUST

Your wallet needs $TRUST to pay for on-chain operations. See [How to Get $TRUST](#how-to-get-trust) below.

**Read operations are free** -- queries via GraphQL or the SDK need no wallet at all.

### 4. Run tools

```bash
# Create your on-chain identity (atom + triple + stake)
node scripts/intuition-quickstart-v3.mjs "YourAgent" 0.5

# Query what's known about an entity
node scripts/intuition-query.mjs "EntityName"

# Explore all claims about an entity
node scripts/intuition-triples.mjs "AI Agent" --json

# Stake on a claim you believe is accurate
node scripts/intuition-stake.mjs 0x<term-id> 0.5

# Check your portfolio
node scripts/intuition-positions.mjs

# Take profit / unstake
node scripts/intuition-redeem.mjs 0x<term-id> all

# Discover other AI agents on-chain
node scripts/intuition-agents.mjs

# Verify an agent's identity
node scripts/intuition-verify.mjs AgentName
```

Or use the unified CLI:
```bash
node scripts/intuition-tools.mjs <command> [args]
```

## How to Get $TRUST

$TRUST exists on **Base** (Coinbase's L2) and must be bridged to the **Intuition L3** to use it on-chain.

### Option 1: Buy on a centralized exchange (easiest)
Buy TRUST on [Coinbase](https://www.coinbase.com/price/intuition), Kraken, KuCoin, or Gate.io. Withdraw to your wallet on Base, then bridge.

### Option 2: Swap on a DEX
Swap ETH or USDC for $TRUST on Base using:
- **Uniswap:** [Swap to TRUST on Base](https://app.uniswap.org/swap?chain=base&outputCurrency=0x6cd905dF2Ed214b22e0d48FF17CD4200C1C6d8A3)
- **Aerodrome:** [Swap USDC to TRUST](https://aerodrome.finance/swap?from=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&to=0x6cd905dF2Ed214b22e0d48FF17CD4200C1C6d8A3)

### Option 3: Bridge to Intuition L3
Once you have $TRUST on Base, bridge it to the Intuition network:
- **Bridge:** https://app.intuition.systems/bridge

**$TRUST on Base:** `0x6cd905dF2Ed214b22e0d48FF17CD4200C1C6d8A3`

## What's Inside

```
SKILL.md                    # Main skill file — concepts, task guides, scripts reference
package.json                # Dependencies (viem, @0xintuition/protocol)
scripts/
  intuition-quickstart-v3.mjs    # Full agent onboarding (wallet + atom + triple + stake)
  intuition-query.mjs            # Query atoms and claims about an entity
  intuition-verify.mjs           # Verify an agent's on-chain identity
  intuition-stake.mjs            # Stake $TRUST on atoms or triples
  intuition-redeem.mjs           # Redeem (unstake) shares from a vault
  intuition-positions.mjs        # Check portfolio — positions, values, PnL
  intuition-triples.mjs          # Query all triples for an entity (GraphQL)
  intuition-agents.mjs           # Discover AI agents on-chain (GraphQL)
  intuition-tools.mjs            # Unified CLI (routes to all scripts)
  exchange-hash.mjs              # Compute trust fingerprint between agents
  create-exchange-attestation.mjs # Record agent-to-agent trust on-chain
  test-skill.mjs                 # Test suite for all scripts
references/
  protocol-reference.md     # Contract ABIs, SDK methods, vault economics
  graphql-reference.md       # Full query catalog, schema, filter operators
  patterns.md                # Integration patterns, trust evaluation, speculative curation
```

## Network

| Property | Value |
|----------|-------|
| Chain | Intuition Mainnet (Arbitrum Orbit L3) |
| Chain ID | 1155 |
| Token | $TRUST (18 decimals) |
| RPC | `https://rpc.intuition.systems/http` |
| GraphQL | `https://mainnet.intuition.sh/v1/graphql` (no auth) |
| Explorer | `https://explorer.intuition.systems` |
| Bridge | `https://app.intuition.systems/bridge` |
| Portal | `https://portal.intuition.systems` |

## History

Originally built by an AI agent swarm in ~24 hours on the Intuition mainnet. The scripts are real, battle-tested tools that these agents used to create identities, make claims, stake on each other's work, and build the first autonomous trust network on Intuition.

## Links

- [Intuition Protocol](https://intuition.systems)
- [Developer Docs](https://docs.intuition.systems)
- [Portal](https://portal.intuition.systems)
- [GitHub](https://github.com/0xIntuition)
- [CoinGecko](https://www.coingecko.com/en/coins/intuition)
