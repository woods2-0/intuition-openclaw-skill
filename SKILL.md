---
name: intuition
description: "Build on the Intuition protocol -- a decentralized, token-curated knowledge graph. Use this skill when you need to: create on-chain identities (Atoms), make claims about entities (Triples), stake $TRUST to signal conviction, query trust data about any entity, verify agent or human identity, explore the knowledge graph, build reputation systems, or integrate trust signals into applications. Covers the @0xintuition/protocol SDK, GraphQL API, and direct contract interaction."
user-invocable: true
metadata: {"openclaw":{"emoji":"atom_symbol","requires":{"env":["INTUITION_PRIVATE_KEY"]},"primaryEnv":"INTUITION_PRIVATE_KEY"}}
---

# Intuition Protocol Skill

## What is Intuition?

Intuition is a decentralized protocol that creates a **token-curated knowledge graph** -- a shared, public data layer where anyone can add information about any entity, and anyone can stake $TRUST (the native token) to signal whether that information is accurate.

Think of it as **Community Notes meets prediction markets, but for all data**. Every claim has a market price determined by how much $TRUST is staked on it. More stake = stronger signal of community trust.

**Why it matters for agents:** When your agent needs to decide whether to trust an address, verify a capability claim, or assess an entity's reputation, Intuition provides cryptoeconomically-backed trust signals -- not just social votes, but real economic commitment.

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

**Key insight:** The predicate is itself an Atom. Anyone can create new predicates (`trusts`, `collaboratesWith`, `believes`, `seeks`), making the vocabulary extensible.

### $TRUST and Staking

**$TRUST** is the native token. You stake it to:
- **Signal conviction** -- backing data you believe is accurate
- **Earn fees** -- shareholders earn when others stake on the same data
- **Create data** -- creating Atoms and Triples costs a small $TRUST fee

Vaults use **bonding curves** -- early stakers pay less per share. As more $TRUST flows in, each share costs more. This rewards early, accurate curation.

### The Knowledge Graph

All Atoms (nodes) and Triples (edges), weighted by $TRUST stakes, form a queryable knowledge graph. You can:
- Traverse relationships between entities
- Check community consensus on claims
- Discover entities by their connections
- Evaluate trust based on economic signals, not just social ones

## Quick Reference

### Wallet & Environment Setup

`INTUITION_PRIVATE_KEY` is a standard EVM private key (0x + 64 hex characters). It's the same kind of key used on Ethereum, Base, Arbitrum, etc. -- nothing Intuition-specific about the key itself. It controls a wallet on the Intuition L3 chain.

**How to get one:**
- **The quickstart script generates one automatically** if none exists. Run `intuition-quickstart-v3.mjs` and it will create a wallet, save it to `~/.intuition-wallet-<name>/`, and use it for onboarding.
- **Or generate one programmatically:**
  ```javascript
  import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
  const key = generatePrivateKey();
  const account = privateKeyToAccount(key);
  console.log('Private key:', key);
  console.log('Address:', account.address);
  ```
- **Or use an existing EVM wallet** -- any private key works.

**Funding the wallet:** The wallet needs **$TRUST** (Intuition's native token) to pay for on-chain operations. $TRUST exists on Base L2 (`0x6cd905dF2Ed214b22e0d48FF17CD4200C1C6d8A3`) and must be bridged to the Intuition L3 via `https://app.intuition.systems/bridge`.

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

### Dependencies

```bash
npm install viem @0xintuition/protocol
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

## Task Guide

### I want to establish an agent's on-chain identity

This creates an Atom for the agent, asserts `[Agent] [is] [AI Agent]`, and stakes $TRUST on that claim.

**Using the quickstart script (recommended):**
```bash
node {baseDir}/scripts/intuition-quickstart-v3.mjs "MyAgentName" 0.5
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

**Common predicates already on-chain:**
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
node {baseDir}/scripts/intuition-query.mjs --name "EntityName"

# By Atom ID
node {baseDir}/scripts/intuition-query.mjs --id "0x<atom-id>"
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

query GetAtomDetails($id: numeric!) {
  atoms(where: { id: { _eq: $id } }) {
    id
    label
    type
    vault {
      total_shares
      position_count
    }
    as_subject_triples {
      predicate { label }
      object { label }
      vault { total_shares }
      counter_vault { total_shares }
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
node {baseDir}/scripts/intuition-stake.mjs 0x<atom-id> 0.5

# Stake FOR a triple (agreement)
node {baseDir}/scripts/intuition-stake.mjs 0x<triple-id> 0.5

# Stake AGAINST a triple (disagreement)
node {baseDir}/scripts/intuition-stake.mjs 0x<triple-id> 0.5 --against
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
node {baseDir}/scripts/intuition-verify.mjs AgentName
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
node {baseDir}/scripts/intuition-agents.mjs
node {baseDir}/scripts/intuition-agents.mjs --json
node {baseDir}/scripts/intuition-agents.mjs --predicate "collaboratesWith"  # custom predicate
```

**Query triples for an entity:**
```bash
node {baseDir}/scripts/intuition-triples.mjs AgentName
node {baseDir}/scripts/intuition-triples.mjs AgentName --json
```

**GraphQL exploration (most powerful):**
```graphql
# Find all claims about an entity
query ExploreEntity($label: String!) {
  atoms(where: { label: { _ilike: $label } }) {
    id
    label
    as_subject_triples {
      predicate { label }
      object { label }
      vault { total_shares }
    }
    as_object_triples {
      subject { label }
      predicate { label }
      vault { total_shares }
    }
  }
}

# Search across everything
query GlobalSearch($query: String!) {
  atoms(where: { label: { _ilike: $query } }, limit: 20) {
    id
    label
    type
  }
}
```

**GraphQL endpoint:** `https://mainnet.intuition.sh/v1/graphql` (no auth required, Hasura-powered).

## Scripts Reference

| Script | Purpose | When to Use |
|--------|---------|------------|
| `intuition-quickstart-v3.mjs` | Full agent onboarding (wallet + atom + triple + stake) | First-time identity setup |
| `intuition-query.mjs` | Query atoms and claims about an entity | Checking what's known about an entity |
| `intuition-verify.mjs` | Verify an agent's on-chain identity exists | Trust checks before interaction |
| `intuition-stake.mjs` | Stake $TRUST on any atom or triple | Signaling conviction on data or claims |
| `intuition-triples.mjs` | Query all triples for an entity via GraphQL | Exploring relationships and claims |
| `intuition-agents.mjs` | Discover AI agents on-chain via GraphQL | Finding agents in the knowledge graph |
| `intuition-tools.mjs` | Unified CLI (routes to other scripts) | Quick access to any command |
| `exchange-hash.mjs` | Compute trust fingerprint between two agents | Privacy-preserving interaction proof |
| `create-exchange-attestation.mjs` | Create on-chain exchange attestation | Recording agent-to-agent trust |

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

- **"insufficient funds"**: Wallet needs $TRUST. Bridge from Base at `https://app.intuition.systems/bridge`.
- **"atom already exists"**: This is fine -- use `calculateAtomId` to get the existing ID. Don't create duplicates.
- **"not a valid triple ID"**: The ID doesn't correspond to a triple. Check with `multiVaultIsTriple`.
- **No results from query**: Check spelling. Atom IDs are case-sensitive and computed from exact byte content.
- **Transaction reverted**: Likely insufficient value sent. Ensure you're sending at least `atomCost` for atoms or `tripleCost` for triples.
- **GraphQL returns empty**: The entity may not exist yet, or filter syntax may be wrong. Use Hasura operators: `_eq`, `_ilike`, `_gt`, etc.

## Further Reading

See the `references/` directory for:
- `protocol-reference.md` -- Contract ABIs, all SDK methods, vault mechanics, bonding curves, fee structure
- `graphql-reference.md` -- Full query catalog, schema types, filter operators, pagination
- `patterns.md` -- Common integration patterns, trust evaluation frameworks, multi-agent coordination
