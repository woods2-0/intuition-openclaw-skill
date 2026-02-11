# Intuition GraphQL API Reference

## Endpoints

| Network | URL | Auth |
|---------|-----|------|
| Mainnet | `https://mainnet.intuition.sh/v1/graphql` | None required (public, no rate limit for reasonable use) |
| Testnet | `https://testnet.intuition.sh/v1/graphql` | None required |

Powered by **Hasura**. Supports filtering, sorting, pagination, aggregations, and subscriptions.

## Client Setup

```javascript
import { GraphQLClient } from 'graphql-request';

const client = new GraphQLClient('https://mainnet.intuition.sh/v1/graphql');
const data = await client.request(query, variables);
```

Or with fetch:

```javascript
const response = await fetch('https://mainnet.intuition.sh/v1/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables }),
});
const { data } = await response.json();
```

## Core Queries

### Atoms

```graphql
# Get a specific atom by term_id
query GetAtom($id: String!) {
  atoms(where: { term_id: { _eq: $id } }) {
    term_id
    label
    type
    emoji
    image
    creator {
      id
      label
    }
  }
}

# Search atoms by label
query SearchAtoms($query: String!, $limit: Int = 20) {
  atoms(
    where: { label: { _ilike: $query } }
    limit: $limit
  ) {
    term_id
    label
    type
  }
}

# Get atom with all its relationships
query GetAtomDetails($id: String!) {
  atoms(where: { term_id: { _eq: $id } }) {
    term_id
    label
    type
    as_subject_triples {
      term_id
      predicate { term_id label }
      object { term_id label }
      triple_vault { total_shares }
    }
    as_object_triples {
      term_id
      subject { term_id label }
      predicate { term_id label }
      triple_vault { total_shares }
    }
    as_predicate_triples {
      term_id
      subject { term_id label }
      object { term_id label }
      triple_vault { total_shares }
    }
  }
}

# Get atoms by data content (e.g., find atom for a specific string)
query GetAtomByData($data: String!) {
  atoms(where: { data: { _eq: $data } }) {
    term_id
    label
    type
  }
}
```

### Triples

```graphql
# Get a specific triple
query GetTriple($id: String!) {
  triples(where: { term_id: { _eq: $id } }) {
    term_id
    subject { term_id label }
    predicate { term_id label }
    object { term_id label }
    triple_vault { total_shares position_count }
    counter_term_id
    creator { id label }
  }
}

# Find triples by subject
query GetTriplesForSubject($subjectId: String!, $limit: Int = 50) {
  triples(
    where: { subject_id: { _eq: $subjectId } }
    limit: $limit
  ) {
    term_id
    predicate { term_id label }
    object { term_id label }
    triple_vault { total_shares }
  }
}

# Find specific triple by subject + predicate + object
query FindTriple($subjectId: String!, $predicateId: String!, $objectId: String!) {
  triples(where: {
    subject_id: { _eq: $subjectId }
    predicate_id: { _eq: $predicateId }
    object_id: { _eq: $objectId }
  }) {
    term_id
    triple_vault { total_shares position_count }
    counter_term_id
  }
}

# Get most-staked triples (trending claims)
query TrendingTriples($limit: Int = 20) {
  triples(
    order_by: { triple_vault: { total_shares: desc } }
    limit: $limit
  ) {
    term_id
    subject { label }
    predicate { label }
    object { label }
    triple_vault { total_shares position_count }
  }
}
```

### Positions (User Stakes)

```graphql
# Get all positions for an address
query GetPositions($address: String!, $limit: Int = 50) {
  positions(
    where: { account_id: { _eq: $address } }
    limit: $limit
    order_by: { shares: desc }
  ) {
    id
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

# Get positions on a specific term
query GetTermPositions($termId: String!, $limit: Int = 20) {
  positions(
    where: { term_id: { _eq: $termId } }
    limit: $limit
    order_by: { shares: desc }
  ) {
    account { id label }
    shares
  }
}
```

### Search

```graphql
# Global search across atoms
query GlobalSearch($query: String!, $limit: Int = 20) {
  atoms(
    where: { label: { _ilike: $query } }
    limit: $limit
  ) {
    term_id
    label
    type
  }
}
```

## Filter Operators

Hasura-style operators available on all fields:

| Operator | Description | Example |
|----------|-------------|---------|
| `_eq` | Equals | `{ term_id: { _eq: "0x..." } }` |
| `_neq` | Not equals | `{ status: { _neq: "deleted" } }` |
| `_gt` | Greater than | `{ total_shares: { _gt: 1000 } }` |
| `_gte` | Greater than or equal | `{ created_at: { _gte: "2026-01-01" } }` |
| `_lt` | Less than | `{ total_shares: { _lt: 100 } }` |
| `_lte` | Less than or equal | |
| `_in` | In array | `{ type: { _in: ["Person", "Thing"] } }` |
| `_nin` | Not in array | |
| `_like` | SQL LIKE (case-sensitive) | `{ label: { _like: "%Agent%" } }` |
| `_ilike` | Case-insensitive LIKE | `{ label: { _ilike: "%agent%" } }` |
| `_is_null` | Is null check | `{ image: { _is_null: false } }` |

### Boolean Operators

```graphql
# AND (implicit when multiple conditions)
where: { label: { _ilike: "%agent%" }, type: { _eq: "Person" } }

# OR
where: { _or: [
  { label: { _ilike: "%agent%" } },
  { label: { _ilike: "%bot%" } }
] }

# NOT
where: { _not: { type: { _eq: "deleted" } } }
```

## Pagination

```graphql
query PaginatedAtoms($limit: Int = 20, $offset: Int = 0) {
  atoms(limit: $limit, offset: $offset, order_by: { term_id: desc }) {
    term_id
    label
  }
  atoms_aggregate {
    aggregate { count }
  }
}
```

## Subscriptions

Real-time updates via WebSocket:

```graphql
subscription NewTriples {
  triples(order_by: { created_at: desc }, limit: 5) {
    term_id
    subject { label }
    predicate { label }
    object { label }
    triple_vault { total_shares }
    created_at
  }
}
```

## Schema Introspection

To get the full schema:

```bash
npx get-graphql-schema https://mainnet.intuition.sh/v1/graphql > schema.graphql
```

## Key Schema Types

| Type | Key Fields | Description |
|------|-----------|-------------|
| `atoms` | `term_id`, `label`, `type`, `data` | Core entities — identities, concepts, strings |
| `triples` | `term_id`, `subject`, `predicate`, `object`, `triple_vault` | Subject-predicate-object claims with FOR vault |
| `positions` | `id`, `shares`, `vault`, `account_id` | User stake positions in a vault |
| `vaults` | `term_id`, `total_shares`, `total_assets`, `current_share_price` | Vault state |
| `terms` | `id`, `type`, `atom`, `triple`, `vaults` | Links atoms/triples to their vaults |
| `accounts` | `id`, `label` | User/entity accounts |

**Important schema notes:**
- Atoms and triples use `term_id` (String, hex), NOT `id`
- Positions use `id` (String)
- Triple stakes are on `triple_vault`, NOT `vault`
- Counter-vault is accessed via `counter_term_id`, NOT `counter_vault`
- `subject_id`, `predicate_id`, `object_id` are String type (hex), NOT numeric
- Atom vault data is accessed through `term { vaults { ... } }`, not directly on atoms
