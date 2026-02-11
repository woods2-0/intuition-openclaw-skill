---
name: intuition
description: "Build on the Intuition protocol -- a decentralized, token-curated knowledge graph. Use this skill when you need to: create on-chain identities (Atoms), make claims about entities (Triples), stake $TRUST to signal conviction, redeem positions for profit, check your staking portfolio, query trust data about any entity, verify agent or human identity, explore the knowledge graph, build reputation systems, or integrate trust signals into applications. Covers the @0xintuition/protocol SDK, GraphQL API, and direct contract interaction."
user-invocable: true
metadata: {"openclaw":{"emoji":"atom_symbol","requires":{"env":["INTUITION_PRIVATE_KEY"]},"primaryEnv":"INTUITION_PRIVATE_KEY"}}
---

# Intuition Protocol Skill

## What is Intuition?

Intuition is a decentralized protocol that creates a **token-curated knowledge graph** -- a shared, public data layer where anyone can add information about any entity, and anyone can stake $TRUST (the native token) to signal whether that information is accurate.

Think of it as **Community Notes meets prediction markets, but for all data**. Every claim has a market price determined by how much $TRUST is staked on it. More stake = stronger signal of community trust.

**Why it matters for agents:** When your agent needs to decide whether to trust an address, verify a capability claim, or assess an entity's reputation, Intuition provides cryptoeconomically-backed trust signals -- not just social votes, but real economic commitment.

## Terminology

| Term | Definition |
|------|-----------|
| **Atom** | An identity node in the graph (person, agent, concept, contract) |
| **Triple** | A claim connecting three Atoms: Subject-Predicate-Object |
| **Term** | Generic name for either an Atom or a Triple |
| **termId** | Unique bytes32 identifier for any term (atom or triple) |
| **Vault** | Economic container where $TRUST is staked on a term |
| **curveId** | Selects which vault: 0=atom, 1=triple FOR, 2=triple AGAINST |
| **Shares** | What you receive when depositing $TRUST into a vault (via bonding curve) |
| **$TRUST** | Native token — you deposit it to get shares, redeem shares to get it back |

**Shares vs $TRUST:** When you deposit $TRUST, you receive vault shares (not 1:1 — the bonding curve determines the ratio). Shares represent fractional ownership of the vault. As more people deposit into the same vault, each new share costs more $TRUST, so early stakers' shares appreciate in value. To exit, you redeem shares back to $TRUST. Shares are vault-specific and non-transferable.

## Getting Started (Zero to Operational)

**IMPORTANT: You can start using this skill RIGHT NOW for read operations. Wallet setup is only needed for writes.**

### Path A: Read-Only (zero setup, works immediately)
- No wallet needed
- No $TRUST needed
- No `npm install` needed (for GraphQL queries)
- Run: `node scripts/intuition-query.mjs "EntityName"`
- Run: `node scripts/intuition-agents.mjs`

### Path B: Write Operations (full setup required)

1. **Install dependencies:** `npm install` in this skill's directory

2. **Wallet:** Do you already have an EVM wallet (Ethereum, Base, Arbitrum, etc.)?
   - **Yes** → Set `export INTUITION_PRIVATE_KEY=0x_your_existing_key`. Any standard EVM private key works -- it's the same format across all EVM chains.
   - **No** → The quickstart script generates one automatically. Or generate with `viem` (see Wallet & Environment Setup below).

3. **Fund with $TRUST:** Your wallet needs $TRUST on the Intuition L3. See "How to Get $TRUST" below for step-by-step: buy on Coinbase → bridge from Base → done. **Testing first?** Use testnet (see Network Details below) — no real funds needed.

4. **Onboard:** Run `node scripts/intuition-quickstart-v3.mjs "YourName" 0.5` to create your on-chain identity. This creates your Atom, asserts `[YourName] [is] [AI Agent]`, and stakes 0.5 $TRUST.

5. **You're operational.** Start creating claims, staking on data, and managing positions.

**Deep dive:** See `references/protocol-reference.md` for full SDK API and vault mechanics, `references/patterns.md` for integration strategies and speculative curation, `references/graphql-reference.md` for the complete query catalog.

**First-time agent?** Verify this skill works right now: `node scripts/intuition-query.mjs "Axiom"` — no setup needed.

## Core Concepts

### Atoms (Identities)

An **Atom** is the atomic unit of knowledge -- a unique on-chain identifier for any concept: a person, AI agent, organization, smart contract, idea, or arbitrary string.

Every Atom has:
- A unique ID (hex, computed deterministically from its content)
- A data payload (URI, string, address, or JSON-LD)
- A **Vault** where $TRUST can be staked to signal the Atom's relevance
- An **AtomWallet** (ERC-4337 account linked to the Atom)

**Atom types:**
| Type | Example | SDK Method |
|------|---------|-----------|
| String | `"developer"`, `"AI Agent"` | `stringToHex("developer")` |
| Ethereum address | `0xd8dA6BF26964aF...` | Hex-encoded address |
| IPFS URI | `ipfs://bafkrei...` | Hex-encoded URI |
| Thing (JSON-LD) | `{ name, url, description }` | Auto-pinned to IPFS |

### Triples (Claims)

A **Triple** connects three Atoms in a semantic relationship: **Subject -- Predicate -- Object**.

Examples:
- `[Alice] [trusts] [Bob]`
- `[MyAgent] [is] [AI Agent]`
- `[Contract 0x123] [was audited by] [Trail of Bits]`
- `[Veritas] [believes] [Reputation cannot be assigned, only earned]`

Each Triple has **two vaults** -- a FOR vault (agreeing with the claim) and an AGAINST vault (disputing it). This creates a market for every claim.

**FOR vs AGAINST vaults:** Each Triple has **two independent vaults**:
- **FOR vault (curveId 1):** Staking here signals agreement with the claim
- **AGAINST vault (curveId 2):** Staking here signals disagreement (the counter-triple)

When you create a triple, you get ONE triple ID. The FOR vault uses that ID directly. The AGAINST vault uses a different ID (get it via `getCounterIdFromTripleId`). Both vaults have their own bonding curves and share prices.

**Key insight:** The predicate is itself an Atom. Anyone can create new predicates (`trusts`, `collaboratesWith`, `believes`, `seeks`), making the vocabulary extensible.

### $TRUST and Staking

**$TRUST** is the native token. You stake it to:
- **Signal conviction** -- backing data you believe is accurate
- **Earn fees** -- shareholders earn when others stake on the same data
- **Create data** -- creating Atoms and Triples costs a small $TRUST fee

Vaults use **bonding curves** -- early stakers pay less per share. As more $TRUST flows in, each share costs more. This rewards early, accurate curation.

**How bonding curves work in practice:**
```
Staker 1 deposits 1 $TRUST when total_shares = 10   → gets ~100 shares (cheap)
Staker 2 deposits 1 $TRUST when total_shares = 110  → gets ~90 shares (more expensive)
Staker 3 deposits 1 $TRUST when total_shares = 200  → gets ~50 shares (even more expensive)

Staker 1's 100 shares are now worth more $TRUST than they paid.
If Staker 1 redeems, they receive more than their original 1 $TRUST.
```
The earlier you stake on accurate data, the more your position appreciates as others validate it.

### How Atoms and Triples Fit Together

```
  ATOMS (nodes)                    TRIPLES (edges)
  ┌─────────┐                     ┌──────────────────────────────────────┐
  │  Axiom  │──── is ────────────▶│ [Axiom] [is] [AI Agent]             │
  └─────────┘                     │   └── 5.2 $TRUST staked FOR         │
       │                          └──────────────────────────────────────┘
       │
       ├──── collaboratesWith ──▶ ┌──────────────────────────────────────┐
       │                          │ [Axiom] [collaboratesWith] [Forge]   │
       │                          │   └── 2.1 $TRUST staked FOR         │
       │                          └──────────────────────────────────────┘
       │
       └──── believes ─────────▶ ┌──────────────────────────────────────┐
                                  │ [Axiom] [believes] [Trust is earned] │
                                  │   └── 0.5 $TRUST staked FOR         │
                                  │   └── 0.1 $TRUST staked AGAINST     │
                                  └──────────────────────────────────────┘
```

Every box on the right is a Triple with its own FOR and AGAINST vaults. The $TRUST staked on each one is the market's signal of how accurate or important that claim is.

### The Knowledge Graph

All Atoms (nodes) and Triples (edges), weighted by $TRUST stakes, form a queryable knowledge graph. You can:
- Traverse relationships between entities
- Check community consensus on claims
- Discover entities by their connections
- Evaluate trust based on economic signals, not just social ones

## When to Use What

**Quick decision tree:**

```
Do you need to WRITE data (create atoms, stake, redeem)?
├─ NO → Use GraphQL (no wallet, no gas, instant results)
│       Example: node scripts/intuition-query.mjs "EntityName"
│
└─ YES → Need wallet with $TRUST on Intuition L3
         ├─ Creating atoms/triples → SDK wrappers (multiVaultCreateAtoms, multiVaultCreateTriples)
         ├─ Staking (deposit) → SDK wrapper (multiVaultDeposit with [receiver, termId])
         └─ Unstaking (redeem) → Raw contract (walletClient.writeContract with explicit curveId)
```

**GraphQL vs SDK:**
- **GraphQL:** Discovery, exploration, aggregation (find entities, traverse relationships, sum stakes)
- **SDK/Contract:** Verification (check if atom exists), write operations (create, stake, redeem)

## Quick Reference

### Wallet & Environment Setup

`INTUITION_PRIVATE_KEY` is a standard EVM private key (0x + 64 hex characters). It's the same kind of key used on Ethereum, Base, Arbitrum, etc. -- nothing Intuition-specific about the key itself. It controls a wallet on the Intuition L3 chain.

**Already have an EVM wallet?** Just use it. If you have a private key for Ethereum, Base, Arbitrum, or any other EVM chain, it works on Intuition. Set it and move on:

```bash
export INTUITION_PRIVATE_KEY=0x_your_existing_private_key
```

**Don't have a wallet?** Two options:
- **Quickstart auto-generates one:** Run `intuition-quickstart-v3.mjs` and it will create a wallet, save it to `~/.intuition-wallet-<name>/`, and use it for onboarding. If `INTUITION_PRIVATE_KEY` is already set, it uses that instead.
- **Generate one programmatically:**
  ```javascript
  import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
  const key = generatePrivateKey();
  const account = privateKeyToAccount(key);
  console.log('Private key:', key);
  console.log('Address:', account.address);
  ```

**Read operations are free.** You only need a funded wallet for write operations (creating atoms, creating triples, staking). Queries via the SDK or GraphQL API require no wallet at all.

```bash
# Required for write operations (create, stake)
export INTUITION_PRIVATE_KEY=0x_your_private_key

# Optional: path to a JSON wallet file (alternative to env var)
export INTUITION_WALLET_PATH=/path/to/wallet.json
```

**Network:** Intuition Mainnet (Chain ID 1155), an Arbitrum Orbit L3.
**RPC:** `https://rpc.intuition.systems/http`
**Explorer:** `https://explorer.intuition.systems`

### How to Get $TRUST

$TRUST is the native token of the Intuition L3. You need it for any write operation (creating atoms, creating triples, staking). Here's how to get it:

**Path 1: Buy on a centralized exchange (easiest for humans)**
1. Buy TRUST on [Coinbase](https://www.coinbase.com/price/intuition), Kraken, KuCoin, or Gate.io
2. Withdraw TRUST to your wallet address on Base
3. Bridge from Base to Intuition L3 at `https://app.intuition.systems/bridge`

**Path 2: Swap on a DEX (if you have ETH or USDC on Base)**
1. Swap ETH or USDC for $TRUST on Base:
   - [Uniswap (Base)](https://app.uniswap.org/swap?chain=base&outputCurrency=0x6cd905dF2Ed214b22e0d48FF17CD4200C1C6d8A3)
   - [Aerodrome (Base)](https://aerodrome.finance/swap?from=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&to=0x6cd905dF2Ed214b22e0d48FF17CD4200C1C6d8A3)
2. Bridge from Base to Intuition L3 at `https://app.intuition.systems/bridge`

**Path 3: Already have $TRUST on Base?**
Bridge directly at `https://app.intuition.systems/bridge`

**$TRUST on Base (ERC-20):** `0x6cd905dF2Ed214b22e0d48FF17CD4200C1C6d8A3`

**How much do you need?** Read-only operations are free. For writes:

| Operation | Typical Cost |
|-----------|-------------|
| Create 1 atom | ~0.01 $TRUST |
| Create 1 triple | ~0.01 $TRUST |
| Stake on a claim | Your chosen amount (minimum ~0.01) |
| Full agent onboarding (atom + triple + 0.5 stake) | ~0.5-2 $TRUST |
| Query (GraphQL or contract read) | Free |

Exact atom/triple costs vary — always call `multiVaultGetAtomCost()` and `multiVaultGetTripleCost()` before write operations.

**Gas fees:** The Intuition L3 uses $TRUST as its gas token (no separate ETH needed). Gas costs are negligible — a typical transaction costs ~0.0001 $TRUST. The same $TRUST you use for staking also pays for gas.

### Dependencies

```bash
npm install
```

### SDK Client Setup

```javascript
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
  MultiVaultAbi,
} from '@0xintuition/protocol';

const publicClient = createPublicClient({
  chain: intuitionMainnet,
  transport: http('https://rpc.intuition.systems/http'),
});

const account = privateKeyToAccount(process.env.INTUITION_PRIVATE_KEY);

const walletClient = createWalletClient({
  chain: intuitionMainnet,
  transport: http('https://rpc.intuition.systems/http'),
  account,
});

const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);
```

### SDK Wrappers vs Raw Contract Calls

**IMPORTANT:** The SDK provides two levels of interaction:

1. **SDK wrapper functions** (deposits only):
   - `multiVaultDeposit(config, { args: [receiver, termId], value })` — Auto-detects atom vs triple, handles curveId internally
   - `multiVaultCreateAtoms`, `multiVaultCreateTriples` — Thin wrappers around raw contract

2. **Raw contract calls** (redeems and advanced operations):
   - Use `walletClient.writeContract({ address, abi: MultiVaultAbi, functionName, args })`
   - Requires explicit `curveId` parameter (0=atom, 1=triple FOR, 2=triple AGAINST)

**Why this matters:** If you try to call `multiVaultRedeem`, it doesn't exist. Use the raw contract method shown in "I want to redeem" below.

**Quick reference:**

| Operation | Method | Args |
|-----------|--------|------|
| Deposit/Stake | `multiVaultDeposit` (SDK) | `[receiver, termId]` — curveId auto-detected |
| Redeem/Unstake | `walletClient.writeContract` (raw) | `[receiver, termId, curveId, shares, minAssets]` |
| Create atoms | `multiVaultCreateAtoms` (SDK) | `[bytes[], uint256[]]` |
| Create triples | `multiVaultCreateTriples` (SDK) | `[bytes32[], bytes32[], bytes32[], uint256[]]` |

## Task Guide

### I want to establish an agent's on-chain identity

This creates an Atom for the agent, asserts `[Agent] [is] [AI Agent]`, and stakes $TRUST on that claim.

**Using the quickstart script (recommended):**
```bash
node scripts/intuition-quickstart-v3.mjs "MyAgentName" 0.5
```

This will:
1. Create or load a wallet
2. Create an identity Atom for the agent name
3. Create the triple `[MyAgentName] [is] [AI Agent]`
4. Stake 0.5 $TRUST on the triple
5. Save identity details to `~/.intuition-wallet-MyAgentName/identity.json`

**Requires:** ~2 $TRUST in wallet (atom cost + triple cost + stake amount).

**Using the SDK directly:**
```javascript
import {
  multiVaultCreateAtoms, multiVaultCreateTriples, multiVaultDeposit,
  multiVaultGetAtomCost, multiVaultGetTripleCost,
} from '@0xintuition/protocol';
import { stringToHex, decodeEventLog } from 'viem';

// Known protocol Atoms
const IS_PREDICATE = '0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1';
const AI_AGENT_OBJECT = '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e';

// Step 1: Get costs
const atomCost = await multiVaultGetAtomCost({ address: multiVaultAddress, publicClient });
const tripleCost = await multiVaultGetTripleCost({ address: multiVaultAddress, publicClient });

// Step 2: Create identity Atom
const atomTx = await multiVaultCreateAtoms(
  { address: multiVaultAddress, walletClient, publicClient },
  { args: [[stringToHex("MyAgent")], [atomCost]], value: atomCost }
);
const atomReceipt = await publicClient.waitForTransactionReceipt({ hash: atomTx });
// Parse AtomCreated event to get agentAtomId

// Step 3: Create triple [MyAgent] [is] [AI Agent]
const tripleTx = await multiVaultCreateTriples(
  { address: multiVaultAddress, walletClient, publicClient },
  { args: [[agentAtomId], [IS_PREDICATE], [AI_AGENT_OBJECT], [tripleCost]], value: tripleCost }
);

// Step 4: Stake on the triple
const stakeTx = await multiVaultDeposit(
  { address: multiVaultAddress, walletClient, publicClient },
  { args: [account.address, tripleId], value: parseEther('0.5') }
);
```

### I want to make a claim about an entity

Claims are Triples. You need three Atom IDs: subject, predicate, object.

**Step 1:** Check if the Atoms you need already exist:
```javascript
// Calculate what an Atom's ID would be
const atomId = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'calculateAtomId',
  args: [toHex("the concept or entity name")],
});

// Check if it exists on-chain
const exists = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'isTermCreated',
  args: [atomId],
});
```

**Step 2:** Create any missing Atoms (subject, predicate, or object).

**Step 3:** Create the Triple:
```javascript
const tripleTx = await multiVaultCreateTriples(
  { address: multiVaultAddress, walletClient, publicClient },
  { args: [[subjectId], [predicateId], [objectId], [tripleCost]], value: tripleCost }
);
```

**Common predicates already on-chain** (these IDs are deterministic — derived from `calculateAtomId(stringToHex("label"))` and can be recomputed to verify):
| Predicate | Atom ID |
|-----------|---------|
| `is` | `0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1` |
| `AI Agent` (object) | `0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e` |
| `collaboratesWith` | `0xb3cf9e60665fe7674e3798d2452604431d4d4dc96aa8d6965016205d00e45c8e` |
| `participatesIn` | `0x2952108d352c2ffe1b89b208c4f078165c83c3ac995c3d6d1f41b18a19ce2f23` |

You can create new predicates by creating a string Atom (e.g., `"trusts"`, `"recommends"`, `"verified"`).

### I want to query trust data about an entity

**Using the query script:**
```bash
# By name
node scripts/intuition-query.mjs --name "EntityName"

# By Atom ID
node scripts/intuition-query.mjs --id "0x<atom-id>"
```

This checks if the entity exists on-chain and shows known Triples with stake amounts.

**Using the SDK:**
```javascript
// Look up Atom ID from a label
const atomId = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'calculateAtomId',
  args: [toHex("EntityName")],
});

// Check existence
const exists = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'isTermCreated',
  args: [atomId],
});

// Read raw Atom data
const atomData = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'atom',
  args: [atomId],
});
```

**Using GraphQL (recommended for discovery and aggregation):**
```graphql
# Endpoint: https://mainnet.intuition.sh/v1/graphql (no auth required)

query GetAtomDetails($id: String!) {
  atoms(where: { term_id: { _eq: $id } }) {
    term_id
    label
    type
    as_subject_triples {
      term_id
      predicate { label }
      object { label }
      triple_vault { total_shares }
    }
  }
}
```

The GraphQL API is the best way to discover relationships you don't already know about. Contract reads require you to check specific triples by ID; GraphQL lets you explore.

### I want to stake on an atom or claim

Staking deposits $TRUST to signal conviction. For **atoms**, this signals relevance. For **triples**, you can stake FOR (agreement) or AGAINST (disagreement).

**Using the stake script:**
```bash
# Stake on an atom (signal relevance)
node scripts/intuition-stake.mjs 0x<atom-id> 0.5

# Stake FOR a triple (agreement)
node scripts/intuition-stake.mjs 0x<triple-id> 0.5

# Stake AGAINST a triple (disagreement)
node scripts/intuition-stake.mjs 0x<triple-id> 0.5 --against
```

The script auto-detects whether the term is an atom or triple.

**Using the SDK:**
```javascript
import { multiVaultDeposit, multiVaultIsTriple } from '@0xintuition/protocol';
import { parseEther } from 'viem';

// Verify it's a valid triple first
const isTriple = await multiVaultIsTriple(
  { address: multiVaultAddress, publicClient },
  { args: [tripleId] }
);

// Stake FOR
await multiVaultDeposit(
  { address: multiVaultAddress, walletClient, publicClient },
  { args: [account.address, tripleId], value: parseEther('0.5') }
);

// Stake AGAINST (use the counter-triple vault)
const counterTripleId = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'getCounterIdFromTripleId',
  args: [tripleId],
});
await multiVaultDeposit(
  { address: multiVaultAddress, walletClient, publicClient },
  { args: [account.address, counterTripleId], value: parseEther('0.5') }
);
```

### I want to verify an agent's identity

```bash
node scripts/intuition-verify.mjs AgentName
```

This checks whether:
1. An Atom exists for the name
2. A `[Name] [is] [AI Agent]` Triple exists
3. How much $TRUST is staked on the identity claim

**Programmatic verification:**
```javascript
const atomId = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'calculateAtomId',
  args: [toHex("AgentName")],
});

const isAtom = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'isTermCreated',
  args: [atomId],
});

// Check identity triple
const tripleId = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'calculateTripleId',
  args: [atomId, IS_PREDICATE, AI_AGENT_OBJECT],
});

const tripleExists = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'isTermCreated',
  args: [tripleId],
});

// Check how much is staked
const [totalShares, totalAssets] = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'getVault',
  args: [tripleId, 1n], // curveId 1 = FOR position
});
```

### I want to evaluate trust signals for a decision

When deciding whether to interact with an entity, query its trust data:

```javascript
// 1. Check if the entity has an on-chain identity
const atomExists = await isTermCreated(atomId);

// 2. Check specific claims (e.g., [Entity] [is] [Trusted])
const tripleId = await calculateTripleId(entityAtomId, predicateId, objectId);
const claimExists = await isTermCreated(tripleId);

// 3. Read economic signals
const [totalShares, totalAssets] = await getVault(tripleId, 1n);
const stakeAmount = Number(totalAssets) / 1e18; // $TRUST staked FOR

// 4. Check counter-position (disagreement)
const counterTripleId = await getCounterIdFromTripleId(tripleId);
const [counterShares, counterAssets] = await getVault(counterTripleId, 1n);
const againstAmount = Number(counterAssets) / 1e18;

// 5. Make decision based on signal strength
const sentiment = stakeAmount / (stakeAmount + againstAmount);
const strongSignal = stakeAmount > 1.0 && sentiment > 0.8;
```

**Trust evaluation heuristics:**
- **No Atom:** Entity has no on-chain presence -- unknown
- **Atom but no Triples:** Entity exists but no claims made about it
- **Low stake (<0.1 $TRUST):** Minimal signal, likely just creator's initial deposit
- **Moderate stake (0.1-10 $TRUST):** Some community backing
- **High stake (>10 $TRUST):** Strong community consensus
- **High counter-stake:** Contested claim -- investigate further

### I want to explore the knowledge graph

**Discover AI agents on-chain:**
```bash
node scripts/intuition-agents.mjs
node scripts/intuition-agents.mjs --json
node scripts/intuition-agents.mjs --predicate "collaboratesWith"  # custom predicate
```

**Query triples for an entity:**
```bash
node scripts/intuition-triples.mjs AgentName
node scripts/intuition-triples.mjs AgentName --json
```

**GraphQL exploration (most powerful):**
```graphql
# Find all claims about an entity
query ExploreEntity($label: String!) {
  atoms(where: { label: { _ilike: $label } }) {
    term_id
    label
    as_subject_triples {
      term_id
      predicate { label }
      object { label }
      triple_vault { total_shares }
    }
    as_object_triples {
      term_id
      subject { label }
      predicate { label }
      triple_vault { total_shares }
    }
  }
}

# Search across everything
query GlobalSearch($query: String!) {
  atoms(where: { label: { _ilike: $query } }, limit: 20) {
    term_id
    label
    type
  }
}
```

**GraphQL endpoint:** `https://mainnet.intuition.sh/v1/graphql` (no auth required, Hasura-powered).

### I want to check my positions

See what you're staked on, how many shares you hold, and the current value:

**Using the positions script:**
```bash
# Check positions for the wallet in INTUITION_PRIVATE_KEY
node scripts/intuition-positions.mjs

# Check a specific address
node scripts/intuition-positions.mjs 0x<address>

# JSON output (for programmatic use)
node scripts/intuition-positions.mjs --json
```

**Using GraphQL:**
```graphql
query GetPositions($address: String!) {
  positions(
    where: { account_id: { _eq: $address } }
    order_by: { shares: desc }
    limit: 50
  ) {
    shares
    vault {
      total_shares
      total_assets
      current_share_price
      term {
        type
        atom { label }
        triple {
          subject { label }
          predicate { label }
          object { label }
        }
      }
    }
  }
}
```

**Calculate position value:**
```javascript
// Value = (your shares / total shares) * total assets
const value = (BigInt(shares) * BigInt(totalAssets)) / BigInt(totalShares);
const valueInTrust = Number(value) / 1e18;
```
**Note:** This shows pre-fee value. Actual redemption may return 0-10% less due to exit fees.

### I want to redeem (unstake) my position

Redeeming converts your shares back to $TRUST. You can redeem all shares or a partial amount.

**Using the redeem script:**
```bash
# Redeem all shares from a vault
node scripts/intuition-redeem.mjs 0x<term-id> all

# Redeem a specific number of shares
node scripts/intuition-redeem.mjs 0x<term-id> 500000000000000000
```

The script auto-detects atom vs triple and calls the correct contract method. It shows your current position and expected $TRUST before executing.

**Using the SDK:**
```javascript
// Check how many shares you can redeem
const maxShares = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'maxRedeem',
  args: [account.address, termId],
});

// Preview how much $TRUST you'll receive
const expectedValue = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'convertToAssets',
  args: [maxShares, termId],
});

// Redeem — unified function with curveId (0=atom, 1=triple FOR, 2=triple AGAINST)
const isTriple = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'isTriple',
  args: [termId],
});

const curveId = isTriple ? 1n : 0n;
const hash = await walletClient.writeContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'redeem',
  args: [account.address, termId, curveId, maxShares, 0n], // last arg = minAssets
});
```

**Important:** Exit fees (0-10%) may apply on redemptions. The `convertToAssets` preview is pre-fee, so actual $TRUST received may be slightly less.

### I want to evaluate positions for profit

**Check if a position has appreciated:**
```javascript
const currentShares = await maxRedeem(account.address, termId);
const currentValue = await convertToAssets(currentShares, termId);

// Compare to your original stake (you must track entry cost yourself)
const profit = Number(currentValue) / 1e18 - originalStakeAmount;
const returnPct = (Number(currentValue) / 1e18 / originalStakeAmount - 1) * 100;
```

**Strategy tips:**
- **Early staking wins.** Bonding curves mean each new share costs more. If you staked early on an accurate claim, your shares are worth more as others pile on.
- **Diversify across many claims.** Small stakes across many accurate claims beats one large stake.
- **Watch the FOR/AGAINST ratio.** Growing counter-stakes suggest the claim is being disputed.
- **Partial redemptions are fine.** Take profit on half, let the rest ride.

For detailed speculation strategies, see `references/patterns.md` → Speculative Curation.

## Scripts Reference

| Script | Purpose | When to Use |
|--------|---------|------------|
| `intuition-quickstart-v3.mjs` | Full agent onboarding (wallet + atom + triple + stake) | First-time identity setup |
| `intuition-query.mjs` | Query atoms and claims about an entity | Checking what's known about an entity |
| `intuition-verify.mjs` | Verify an agent's on-chain identity exists | Trust checks before interaction |
| `intuition-stake.mjs` | Stake $TRUST on any atom or triple | Signaling conviction on data or claims |
| `intuition-redeem.mjs` | Redeem (unstake) shares from a vault | Taking profit or exiting a position |
| `intuition-positions.mjs` | Check portfolio — positions, values | Monitoring staking portfolio |
| `intuition-triples.mjs` | Query all triples for an entity via GraphQL | Exploring relationships and claims |
| `intuition-agents.mjs` | Discover AI agents on-chain via GraphQL | Finding agents in the knowledge graph |
| `intuition-tools.mjs` | Unified CLI (routes to other scripts) | Quick access to any command |
| `intuition-health.mjs` | Health check — connectivity, atom IDs, wallet | Verifying setup before first use |
| `exchange-hash.mjs` | Compute trust fingerprint between two agents | Privacy-preserving interaction proof |
| `create-exchange-attestation.mjs` | Create on-chain exchange attestation | Recording agent-to-agent trust |

## Complete End-to-End Example

This single code block shows the full lifecycle: setup → query → stake → check position → redeem.

```javascript
import { createPublicClient, createWalletClient, http, parseEther, formatEther, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  intuitionMainnet, getMultiVaultAddressFromChainId, MultiVaultAbi,
  multiVaultDeposit, multiVaultGetAtomCost, multiVaultCreateAtoms,
} from '@0xintuition/protocol';
import { stringToHex } from 'viem';

// --- SETUP ---
const account = privateKeyToAccount(process.env.INTUITION_PRIVATE_KEY);
const publicClient = createPublicClient({
  chain: intuitionMainnet,
  transport: http('https://rpc.intuition.systems/http'),
});
const walletClient = createWalletClient({
  chain: intuitionMainnet,
  transport: http('https://rpc.intuition.systems/http'),
  account,
});
const multiVaultAddress = getMultiVaultAddressFromChainId(intuitionMainnet.id);

// --- QUERY: Does "MyAgent" exist on-chain? ---
const atomId = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'calculateAtomId',
  args: [toHex("MyAgent")],
});
const exists = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'isTermCreated',
  args: [atomId],
});
console.log(`MyAgent exists: ${exists}, Atom ID: ${atomId}`);

// --- CREATE (if needed) ---
if (!exists) {
  const atomCost = await multiVaultGetAtomCost({ address: multiVaultAddress, publicClient });
  const tx = await multiVaultCreateAtoms(
    { address: multiVaultAddress, walletClient, publicClient },
    { args: [[stringToHex("MyAgent")], [atomCost]], value: atomCost }
  );
  console.log('Created atom, tx:', tx);
}

// --- STAKE: Deposit 0.1 $TRUST on the atom ---
const stakeTx = await multiVaultDeposit(
  { address: multiVaultAddress, walletClient, publicClient },
  { args: [account.address, atomId], value: parseEther('0.1') }
);
console.log('Staked, tx:', stakeTx);

// --- CHECK POSITION ---
const shares = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'maxRedeem',
  args: [account.address, atomId],
});
const value = await publicClient.readContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'convertToAssets',
  args: [shares, atomId],
});
console.log(`Position: ${shares} shares, worth ${formatEther(value)} $TRUST`);

// --- REDEEM: Withdraw all shares ---
// curveId 0 = atom vault, 1 = triple FOR, 2 = triple AGAINST
const redeemTx = await walletClient.writeContract({
  address: multiVaultAddress, abi: MultiVaultAbi,
  functionName: 'redeem',
  args: [account.address, atomId, 0n, shares, 0n], // curveId=0 for atom, minAssets=0
});
console.log('Redeemed, tx:', redeemTx);
```

## Rules for the Agent

1. **Always check before creating.** Use `calculateAtomId` + `isTermCreated` to verify an Atom doesn't already exist before creating a duplicate. Duplicate creation wastes $TRUST.
2. **Confirm before spending.** Any write operation (create atom, create triple, stake) costs $TRUST. Log what you're about to do and the cost before executing.
3. **Use GraphQL for discovery, SDK for transactions.** The GraphQL API (`https://mainnet.intuition.sh/v1/graphql`) is best for reading and exploring. The SDK is for writing to the chain.
4. **Validate triple IDs.** Before staking on a triple, verify it exists with `multiVaultIsTriple`. Staking on a non-existent triple will fail.
5. **Handle insufficient funds gracefully.** Check wallet balance before write operations. If insufficient, report the shortfall and the bridge URL: `https://app.intuition.systems/bridge`.
6. **Never expose private keys.** Don't log, print, or transmit `INTUITION_PRIVATE_KEY`.
7. **Respect existing predicates.** Before creating a new predicate Atom, check if a suitable one already exists. Common predicates: `is`, `collaboratesWith`, `participatesIn`, `believes`, `trusts`.

## Network Details

| Property | Mainnet | Testnet |
|----------|---------|---------|
| Chain ID | 1155 | 13579 |
| RPC | `https://rpc.intuition.systems/http` | `https://testnet.rpc.intuition.systems` |
| Explorer | `https://explorer.intuition.systems` | `https://testnet.explorer.intuition.systems` |
| GraphQL | `https://mainnet.intuition.sh/v1/graphql` | `https://testnet.intuition.sh/v1/graphql` |
| MultiVault | `0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e` | `0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91` |
| Currency | $TRUST (18 decimals) | Testnet TRUST |

**$TRUST on Base (L1):** `0x6cd905dF2Ed214b22e0d48FF17CD4200C1C6d8A3`
**Bridge:** `https://app.intuition.systems/bridge`
**Portal:** `https://portal.intuition.systems`

## Troubleshooting

### Common Errors

- **"insufficient funds"**: Wallet needs $TRUST. See "How to Get $TRUST" above — buy on Coinbase, swap on Uniswap (Base), or bridge from Base at `https://app.intuition.systems/bridge`.
- **"atom already exists"**: This is fine -- use `calculateAtomId` to get the existing ID. Don't create duplicates.
- **"not a valid triple ID"**: The ID doesn't correspond to a triple. Check with `multiVaultIsTriple`.
- **No results from query**: Check spelling. Atom IDs are case-sensitive and computed from exact byte content.
- **Transaction reverted**: Likely insufficient value sent. Ensure you're sending at least `atomCost` for atoms or `tripleCost` for triples.
- **GraphQL returns empty**: The entity may not exist yet, or filter syntax may be wrong. Use Hasura operators: `_eq`, `_ilike`, `_gt`, etc.

### Network Issues

- **RPC timeout / connection refused**: The RPC at `https://rpc.intuition.systems/http` may be temporarily unavailable. Retry after a few seconds. There is no public fallback RPC.
- **GraphQL endpoint down**: The indexer at `https://mainnet.intuition.sh/v1/graphql` may lag behind the chain. If a recently created atom doesn't appear in GraphQL yet, verify directly via contract read (`isTermCreated`).
- **Nonce too low**: Your transaction was already processed, or another transaction from the same wallet was mined first. Wait for pending transactions to confirm before sending new ones.
- **Transaction stuck in mempool**: On the L3, transactions typically confirm in seconds. If stuck, it usually means insufficient gas. Re-submit with the same nonce.
- **Rate limiting**: The public GraphQL endpoint has no strict rate limit for reasonable use, but avoid hammering it with hundreds of requests per second. Add small delays (100-500ms) between batch queries.

## Further Reading

See the `references/` directory for:
- `protocol-reference.md` -- Contract ABIs, all SDK methods, vault mechanics, bonding curves, fee structure
- `graphql-reference.md` -- Full query catalog, schema types, filter operators, pagination
- `patterns.md` -- Common integration patterns, trust evaluation frameworks, speculative curation, multi-agent coordination
