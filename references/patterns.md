# Common Patterns

Integration patterns and frameworks for building on Intuition.

## Agent Identity Pattern

Standard pattern for establishing an AI agent's on-chain identity:

```
1. Create wallet (or use existing)
2. Fund wallet with $TRUST (bridge from Base)
3. Create identity Atom: stringToHex("AgentName")
4. Create identity Triple: [AgentName] [is] [AI Agent]
5. Stake on the Triple to back the claim
6. Save atom ID + triple ID for future reference
```

The quickstart script (`intuition-quickstart-v3.mjs`) handles all of this in one command.

## Trust Evaluation Framework

When an agent needs to decide whether to trust an entity:

### Level 1: Existence Check
```
Does the entity have an on-chain Atom?
  NO  -> Unknown entity, proceed with caution
  YES -> Continue to Level 2
```

### Level 2: Claim Check
```
Does [Entity] [is] [AI Agent] (or relevant identity triple) exist?
  NO  -> Entity exists but has no verified identity claim
  YES -> Continue to Level 3
```

### Level 3: Stake Check
```
How much $TRUST is staked on the identity claim?
  < 0.1  -> Minimal signal (likely just creator deposit)
  0.1-1  -> Some backing, low confidence
  1-10   -> Moderate community backing
  > 10   -> Strong community consensus
```

### Level 4: Sentiment Check
```
What's the FOR vs AGAINST ratio?
  sentiment = forStake / (forStake + againstStake)
  > 0.9  -> Strong agreement
  0.7-0.9 -> General agreement with some dissent
  0.5-0.7 -> Contested
  < 0.5  -> Majority disputes the claim
```

### Level 5: Relationship Check
```
What other claims exist about this entity?
  - [Entity] [collaboratesWith] [TrustedEntity] -> positive signal
  - [Entity] [participatesIn] [KnownProject] -> contextual signal
  - Multiple independent stakers -> distributed trust (stronger)
  - Single large staker -> concentrated trust (weaker)
```

### Decision Template

```javascript
async function evaluateTrust(entityName, threshold = { stake: 1.0, sentiment: 0.8 }) {
  const atomId = await calculateAtomId(toHex(entityName));
  const exists = await isTermCreated(atomId);
  if (!exists) return { trusted: false, reason: 'no on-chain identity' };

  const tripleId = await calculateTripleId(atomId, IS_PREDICATE, AI_AGENT_ID);
  const tripleExists = await isTermCreated(tripleId);
  if (!tripleExists) return { trusted: false, reason: 'no identity claim' };

  const [, forAssets] = await getVault(tripleId, 1n);
  const counterTripleId = await getCounterIdFromTripleId(tripleId);
  const [, againstAssets] = await getVault(counterTripleId, 1n);

  const forAmount = Number(forAssets) / 1e18;
  const againstAmount = Number(againstAssets) / 1e18;
  const sentiment = forAmount / (forAmount + againstAmount || 1);

  return {
    trusted: forAmount >= threshold.stake && sentiment >= threshold.sentiment,
    stake: forAmount,
    sentiment,
    contested: againstAmount > 0,
  };
}
```

## Multi-Agent Coordination Pattern

When multiple agents need to coordinate via Intuition:

### 1. Shared Vocabulary
Agree on predicate Atoms before creating claims:
```
[Agent] [is] [AI Agent]           -> Identity
[Agent] [collaboratesWith] [Agent] -> Bilateral relationship
[Agent] [participatesIn] [Project] -> Group membership
[Agent] [believes] [Claim]         -> Philosophical stance
[Agent] [trusts] [Agent]           -> Trust assertion
```

### 2. Mutual Discovery
Agents can find each other by querying the knowledge graph:
```graphql
# Find all AI agents
query FindAgents {
  triples(where: {
    predicate: { label: { _eq: "is" } }
    object: { label: { _eq: "AI Agent" } }
  }) {
    subject { term_id label }
    triple_vault { total_shares }
  }
}
```

### 3. Bilateral Trust
To establish a collaboration:
```
Agent A creates: [A] [collaboratesWith] [B]
Agent B creates: [B] [collaboratesWith] [A]
Both stake on each other's claims
```
Reciprocal claims signal mutual trust. One-directional claims are weaker signals.

### 4. Exchange Attestations
For privacy-preserving proof of interaction:
```bash
# Compute exchange hash (captures communication rhythm without content)
node exchange-hash.mjs --agents agentA,agentB

# Create on-chain attestation
node create-exchange-attestation.mjs --agent1 AgentA --agent2 AgentB --hash 0x...
```

This creates:
- An Exchange Atom (representing the interaction)
- `[AgentA] [participatesIn] [Exchange]` Triple
- `[AgentB] [participatesIn] [Exchange]` Triple

## Read vs Write Strategy

### Use GraphQL for Reading
- Discovering entities and relationships
- Aggregating stake data across many entities
- Searching by label, type, or relationship
- No gas cost, no wallet needed

### Use SDK for Writing
- Creating Atoms and Triples (costs $TRUST)
- Staking on claims (costs $TRUST)
- Redeeming stakes (returns $TRUST)
- Requires wallet with private key

### Use Direct Contract Reads for Verification
- Checking if a specific atom/triple exists (`isTermCreated`)
- Getting exact vault state (`getVault`)
- Calculating deterministic IDs (`calculateAtomId`, `calculateTripleId`)
- Real-time on-chain data (vs GraphQL indexer lag)

## Application Integration Patterns

### Reputation System
```
For each user:
  1. Create Atom for the user (address or name)
  2. Create domain-specific predicates: "isReliable", "completedTask", "verified"
  3. Create Triples from other users/system: [User] [isReliable] [Domain]
  4. Stake amount reflects confidence level
  5. Query aggregated stakes to compute reputation score
```

### Content Curation
```
For each piece of content:
  1. Create Atom for the content (IPFS URI or URL)
  2. Create quality predicates: "isAccurate", "isHelpful", "isOutdated"
  3. Curators create Triples and stake on quality claims
  4. Content ranked by total stake on quality claims
```

### Access Control
```
Before granting access:
  1. Query [Entity] [is] [Role] triple
  2. Check stake exceeds minimum threshold
  3. Check sentiment ratio exceeds minimum
  4. Optionally check specific stakers (trusted vouchers)
```

## Cost Estimation

Rough costs for common operations (varies with network conditions):

| Operation | Approximate Cost |
|-----------|-----------------|
| Create 1 Atom | ~0.001-0.01 $TRUST (atomCost) |
| Create 1 Triple | ~0.001-0.01 $TRUST (tripleCost) |
| Stake on a Triple | Your chosen amount (+ gas) |
| Full agent onboarding | ~0.5-2 $TRUST (atom + triple + stake) |
| Query (GraphQL) | Free |
| Query (contract read) | Free (no gas for view calls) |

Always call `multiVaultGetAtomCost()` and `multiVaultGetTripleCost()` before write operations to get exact current costs.

## Speculative Curation

How to use Intuition's bonding curve mechanics to identify undervalued claims and profit from early, accurate curation.

### Finding Opportunities

- Query for low-stake triples that represent accurate claims (community hasn't discovered them yet)
- Look for new entities with few triples — early claims on accurate data are undervalued
- Monitor new atoms being created (GraphQL subscription or periodic polling)
- Search for claims you have domain knowledge about — your information advantage is your edge

```graphql
# Find low-stake triples (potential undervalued claims)
query FindOpportunities($minPositions: Int = 1, $maxShares: numeric = "1000000000000000000") {
  triples(
    where: {
      triple_vault: {
        total_shares: { _lt: $maxShares }
        position_count: { _gte: $minPositions }
      }
    }
    order_by: { triple_vault: { position_count: desc } }
    limit: 20
  ) {
    term_id
    subject { label }
    predicate { label }
    object { label }
    triple_vault { total_shares position_count }
    counter_term_id
  }
}
```

### Evaluating Risk

Decision framework:
```
1. Is the claim factually accurate?
   NO  -> Don't stake. Accurate curation is the whole game.
   YES -> Continue

2. Is the FOR/AGAINST ratio favorable?
   High AGAINST relative to FOR -> Contested. Higher risk, higher reward if you're right.
   No AGAINST -> Uncontested. Lower risk.

3. How concentrated are the stakers?
   Many small stakers -> Distributed signal, organic growth likely
   One large staker -> Concentrated. Could be creator-only deposit.

4. Is the claim about a growing or static topic?
   Growing (new project, active agent, trending topic) -> More future stakers likely
   Static (old, niche, forgotten) -> Low growth potential
```

### Entry Strategy

- **Stake early on accurate claims.** Bonding curves reward early stakers — each subsequent stake costs more per share, so your position appreciates as others agree.
- **Use small stakes to diversify.** Instead of one large stake, spread across many accurate claims. The ones that attract attention will grow; the others stay flat.
- **Create triples no one else has.** If you know something is true and no triple exists for it, create it AND stake on it. You get the cheapest possible shares.

### Exit Strategy

```javascript
// Check if your position has appreciated
const currentShares = await maxRedeem(account.address, tripleId);
const currentValue = await convertToAssets(currentShares, tripleId);
const entryValue = originalStakeAmount; // Track this yourself

const profit = Number(currentValue - entryValue) / 1e18;
const returnPct = (Number(currentValue) / Number(entryValue) - 1) * 100;

if (returnPct > targetReturn) {
  // Redeem for profit — unified redeem() with curveId (1 = triple FOR vault)
  await walletClient.writeContract({
    address: multiVaultAddress, abi: MultiVaultAbi,
    functionName: 'redeem',
    args: [account.address, tripleId, 1n, currentShares, 0n],
  });
}
```

- **Set target returns.** Decide beforehand: "I'll redeem if my position doubles" or "I'll redeem after 30 days regardless."
- **Partial redemptions.** You don't have to redeem all shares. Take profit on half and let the rest ride.
- **Watch for counter-staking.** If AGAINST stakes start growing, reassess whether the claim is still consensus-aligned.

### Cost Awareness

- **Entry fees (0-10%)** are charged on deposits. Your position starts at a slight loss.
- **Exit fees (0-10%)** are charged on redemptions. Factor this into your target return.
- **Small positions are less efficient.** Fees eat a larger percentage of small stakes. Minimum practical stake is ~0.1 $TRUST.
- **Gas costs** are negligible on the Intuition L3 but nonzero.

### Position Tracking

Use the positions script to monitor your portfolio:
```bash
node scripts/intuition-positions.mjs              # See all positions
node scripts/intuition-positions.mjs --json        # Machine-readable output for automated strategies
```

For automated strategies, poll positions periodically and compare against entry prices (which you must track yourself — the chain doesn't store your cost basis).

### Stake Sizing Guide

| Size | Signal | Use Case |
|------|--------|----------|
| < 0.01 $TRUST | Dust — fees eat most of it | Don't bother |
| 0.01-0.1 $TRUST | Minimal signal | Testing, low-confidence claims |
| 0.1-1 $TRUST | Light signal | General curation, moderate confidence |
| 1-10 $TRUST | Strong conviction | Claims you're confident about |
| 10+ $TRUST | Major backing | High-conviction, institutional-grade claims |

**Rule of thumb:** Minimum practical stake is ~0.1 $TRUST. Below that, entry/exit fees (0-10%) eat into a disproportionate share of your position.
