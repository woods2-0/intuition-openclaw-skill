# Intuition GraphQL API Reference

## Endpoints

| Network | URL | Auth |
|---------|-----|------|
| Mainnet | `https://mainnet.intuition.sh/v1/graphql` | None required |
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
# Get a specific atom by ID
query GetAtom($id: numeric!) {
  atoms(where: { id: { _eq: $id } }) {
    id
    label
    type
    emoji
    image
    vault {
      total_shares
      position_count
      current_share_price
    }
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
    order_by: { vault: { total_shares: desc } }
  ) {
    id
    label
    type
    vault { total_shares position_count }
  }
}

# Get atom with all its relationships
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
      id
      predicate { id label }
      object { id label }
      vault { total_shares }
      counter_vault { total_shares }
    }
    as_object_triples {
      id
      subject { id label }
      predicate { id label }
      vault { total_shares }
      counter_vault { total_shares }
    }
    as_predicate_triples {
      id
      subject { id label }
      object { id label }
      vault { total_shares }
    }
  }
}

# Get atoms by data content (e.g., find atom for a specific string)
query GetAtomByData($data: String!) {
  atoms(where: { data: { _eq: $data } }) {
    id
    label
    type
  }
}
```

### Triples

```graphql
# Get a specific triple
query GetTriple($id: numeric!) {
  triples(where: { id: { _eq: $id } }) {
    id
    subject { id label }
    predicate { id label }
    object { id label }
    vault { total_shares position_count }
    counter_vault { total_shares position_count }
    creator { id label }
  }
}

# Find triples by subject
query GetTriplesForSubject($subjectId: numeric!, $limit: Int = 50) {
  triples(
    where: { subject_id: { _eq: $subjectId } }
    limit: $limit
    order_by: { vault: { total_shares: desc } }
  ) {
    id
    predicate { id label }
    object { id label }
    vault { total_shares }
    counter_vault { total_shares }
  }
}

# Find specific triple by subject + predicate + object
query FindTriple($subjectId: numeric!, $predicateId: numeric!, $objectId: numeric!) {
  triples(where: {
    subject_id: { _eq: $subjectId }
    predicate_id: { _eq: $predicateId }
    object_id: { _eq: $objectId }
  }) {
    id
    vault { total_shares position_count }
    counter_vault { total_shares position_count }
  }
}

# Get most-staked triples (trending claims)
query TrendingTriples($limit: Int = 20) {
  triples(
    order_by: { vault: { total_shares: desc } }
    limit: $limit
  ) {
    id
    subject { label }
    predicate { label }
    object { label }
    vault { total_shares position_count }
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
      atom { id label }
      triple {
        subject { label }
        predicate { label }
        object { label }
      }
      total_shares
      total_assets
    }
  }
}

# Get positions on a specific triple
query GetTriplePositions($tripleId: numeric!, $limit: Int = 20) {
  positions(
    where: { vault: { triple_id: { _eq: $tripleId } } }
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
# Global search across atoms and triples
query GlobalSearch($query: String!, $limit: Int = 20) {
  atoms(
    where: { label: { _ilike: $query } }
    limit: $limit
    order_by: { vault: { total_shares: desc } }
  ) {
    id
    label
    type
    vault { total_shares }
  }
}
```

## Filter Operators

Hasura-style operators available on all fields:

| Operator | Description | Example |
|----------|-------------|---------|
| `_eq` | Equals | `{ id: { _eq: 123 } }` |
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
  atoms(limit: $limit, offset: $offset, order_by: { id: desc }) {
    id
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
    id
    subject { label }
    predicate { label }
    object { label }
    vault { total_shares }
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

| Type | Description |
|------|-------------|
| `atoms` | Core entities with label, type, vault, relationships |
| `triples` | Subject-predicate-object claims with FOR/AGAINST vaults |
| `positions` | User stake positions (shares in a vault) |
| `deposits` | Deposit transactions |
| `vaults` | Vault state (total_shares, total_assets, position_count) |
| `accounts` | User/entity accounts |
| `signals` | Voting/signaling records |
| `events` | On-chain event log |
