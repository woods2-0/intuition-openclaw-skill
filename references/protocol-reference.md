# Intuition Protocol Reference

Deep technical reference for the Intuition protocol. For conceptual overview and task guides, see SKILL.md.

## Contract Deployments

### Mainnet (Chain ID 1155)

| Contract | Address |
|----------|---------|
| MultiVault (EthMultiVault) | `0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e` |
| TrustBonding | `0x635bBD1367B66E7B16a21D6E5A63C812fFC00617` |
| WrappedTrust | `0x81cFb09cb44f7184Ad934C09F82000701A4bF672` |

### Testnet (Chain ID 13579)

| Contract | Address |
|----------|---------|
| MultiVault | `0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91` |
| TrustBonding | `0x75dD32b522c89566265eA32ecb50b4Fc4d00ADc7` |
| WrappedTrust | `0xDE80b6EE63f7D809427CA350e30093F436A0fe35` |

### Base (L1 Token)

| Contract | Address |
|----------|---------|
| $TRUST (ERC-20) | `0x6cd905dF2Ed214b22e0d48FF17CD4200C1C6d8A3` |

## MultiVault ABI -- Key Functions

The EthMultiVault is the core contract. It manages all vaults in a single contract (not a factory pattern).

### Atom Operations

```solidity
// Create atoms (always batch/plural). data is array of hex-encoded content.
// assets is array of initial deposit amounts per atom.
// Returns array of atom IDs (bytes32[]). msg.value must cover total costs.
function createAtoms(bytes[] calldata data, uint256[] calldata assets)
    external payable returns (bytes32[])
```

### Triple Operations

```solidity
// Create triples (always batch/plural). All arrays must have the same length.
// All atom IDs must exist (use bytes32, not uint256).
// assets is array of initial deposit amounts per triple.
// Returns array of triple IDs (bytes32[]). msg.value must cover total costs.
function createTriples(
    bytes32[] calldata subjectIds,
    bytes32[] calldata predicateIds,
    bytes32[] calldata objectIds,
    uint256[] calldata assets
) external payable returns (bytes32[])
```

### Deposit (Staking)

```solidity
// Unified deposit function for BOTH atoms and triples.
// curveId determines vault type:
//   0 = atom vault
//   1 = triple FOR vault (agreement)
//   2 = triple AGAINST vault (counter-triple, disagreement)
// msg.value is the deposit amount. Returns shares received.
function deposit(
    address receiver,
    bytes32 termId,
    uint256 curveId,
    uint256 minShares
) external payable returns (uint256 shares)

// Batch deposit across multiple vaults.
function depositBatch(
    address receiver,
    bytes32[] calldata termIds,
    uint256[] calldata curveIds,
    uint256[] calldata minShares
) external payable returns (uint256[] memory)
```

### Redeem (Unstaking)

```solidity
// Unified redeem function for BOTH atoms and triples.
// curveId determines vault type (0=atom, 1=triple FOR, 2=triple AGAINST).
// Returns $TRUST amount received.
function redeem(
    address receiver,
    bytes32 termId,
    uint256 curveId,
    uint256 shares,
    uint256 minAssets
) external nonReentrant returns (uint256 assets)

// Batch redeem across multiple vaults.
function redeemBatch(
    address receiver,
    bytes32[] calldata termIds,
    uint256[] calldata curveIds,
    uint256[] calldata shares,
    uint256[] calldata minAssets
) external nonReentrant returns (uint256[] memory)
```

### View Functions

```solidity
// Check if an atom or triple has been created (termId is bytes32)
function isTermCreated(bytes32 termId) external view returns (bool)

// Check if a term ID is specifically a triple
function isTriple(bytes32 termId) external view returns (bool)

// Get raw atom data (the bytes that were passed to createAtoms)
function atom(bytes32 atomId) external view returns (bytes memory)

// Get the counter-triple ID (the AGAINST vault) for a triple.
// Both functions exist and are equivalent:
function getCounterIdFromTripleId(bytes32 tripleId) external pure returns (bytes32)
function getInverseTripleId(bytes32 tripleId) external view returns (bytes32)

// Get vault state: totalShares and totalAssets for a given vault + curve
function getVault(bytes32 termId, uint256 curveId)
    external view returns (uint256 totalShares, uint256 totalAssets)

// Preview operations (all take bytes32 termId, uint256 curveId)
function convertToShares(uint256 assets, bytes32 termId, uint256 curveId) external view returns (uint256)
function convertToAssets(uint256 shares, bytes32 termId, uint256 curveId) external view returns (uint256)
function currentSharePrice(bytes32 termId, uint256 curveId) external view returns (uint256) // scaled by 1e18
function maxRedeem(address sender, bytes32 termId, uint256 curveId) external view returns (uint256)
```

### Cost Functions

```solidity
// Base cost to create an atom (protocol fee + minimum deposit)
function getAtomCost() external view returns (uint256)

// Base cost to create a triple
function getTripleCost() external view returns (uint256)
```

## SDK Functions (@0xintuition/protocol)

All functions take a config object as their first argument:
- **ReadConfig:** `{ address: multiVaultAddress, publicClient }`
- **WriteConfig:** `{ address: multiVaultAddress, publicClient, walletClient }`

### curveId Parameter

The curveId parameter specifies which vault curve to interact with:

- **0** = Atom vault (default for atoms)
- **1** = Triple FOR vault (agreement with the claim)
- **2** = Triple AGAINST vault (counter-triple, disagreement with the claim)

Each triple has two independent vaults (FOR and AGAINST), each with its own bonding curve and share price.

### Write Functions

| Function | Args | Returns |
|----------|------|---------|
| `multiVaultCreateAtoms(config, { args, value })` | `args: [bytes[], uint256[]]` | Transaction hash |
| `multiVaultCreateTriples(config, { args, value })` | `args: [bytes32[], bytes32[], bytes32[], uint256[]]` | Transaction hash |
| `multiVaultDeposit(config, { args, value })` | `args: [address receiver, bytes32 termId, uint256 curveId, uint256 minShares]` | Transaction hash |
| `multiVaultRedeem(config, { args })` | `args: [address receiver, bytes32 termId, uint256 curveId, uint256 shares, uint256 minAssets]` | Transaction hash |

### Read Functions

| Function | Args | Returns |
|----------|------|---------|
| `multiVaultGetAtomCost(config)` | None | `BigInt` (cost in wei) |
| `multiVaultGetTripleCost(config)` | None | `BigInt` (cost in wei) |
| `multiVaultIsTriple(config, { args })` | `args: [bytes32 termId]` | `boolean` |
| `multiVaultGetAtom(config, { args })` | `args: [bytes32 atomId]` | Atom data (bytes) |
| `multiVaultGetTriple(config, { args })` | `args: [bytes32 tripleId]` | Triple data |
| `multiVaultGetInverseTripleId(config, { args })` | `args: [bytes32 tripleId]` | `bytes32` counter-triple ID |
| `multiVaultGetVault(config, { args })` | `args: [bytes32 termId, uint256 curveId]` | `{ totalShares, totalAssets }` |

### Event Parsing

| Function | Returns |
|----------|---------|
| `eventParseAtomCreated(publicClient, txHash)` | `{ termId, creator, atomData, ... }` |
| `eventParseTripleCreated(publicClient, txHash)` | `{ termId, subject, predicate, object, ... }` |
| `eventParseDeposited(publicClient, txHash)` | `{ receiver, termId, shares, assets, ... }` |
| `eventParseRedeemed(publicClient, txHash)` | `{ receiver, termId, shares, assets, ... }` |

## Vault Economics

### Bonding Curves

Each vault uses a bonding curve to price shares. Two types:

1. **LinearCurve** -- share price increases linearly with deposits
2. **OffsetProgressiveCurve** -- exponential pricing (default for new vaults)

**Key principle:** Early stakers get more shares per $TRUST. As a vault grows, each new share costs more.

### Fee Structure

| Fee | Range | Description |
|-----|-------|-------------|
| Entry fee | 0-10% | Charged on deposits |
| Exit fee | 0-10% | Charged on redemptions |
| Protocol fee | 0-10% | Goes to protocol multisig |
| Atom deposit fraction | Variable | For triple vaults only -- portion distributed to constituent atom vaults |

### Share Math

```
shares_received = deposit_amount * (totalShares / totalAssets)
withdrawal_amount = shares_redeemed * (totalAssets / totalShares)
```

### Counter-Triples

Every Triple has an automatic counter-triple (the AGAINST position). When you stake on the FOR vault, you're agreeing with the claim. When you stake on the counter-triple vault, you're disputing it.

The FOR and AGAINST vaults are independent -- each has its own bonding curve and share price.

## Known Protocol Atoms

These Atoms are commonly used and already exist on mainnet:

| Label | Atom ID | Usage |
|-------|---------|-------|
| `is` | `0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1` | Identity predicate |
| `AI Agent` | `0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e` | Agent type object |
| `collaboratesWith` | `0xb3cf9e60665fe7674e3798d2452604431d4d4dc96aa8d6965016205d00e45c8e` | Collaboration predicate |
| `participatesIn` | `0x2952108d352c2ffe1b89b208c4f078165c83c3ac995c3d6d1f41b18a19ce2f23` | Participation predicate |
| `believes` | `0x934c2417ec225701257feefab4dbcdd2731efde0a0ffab99904a3a75afdf5f5c` | Belief predicate |
| `seeks` | `0xa9cca0d77e5da495ca0ca288167042f0e5427e63203c8c16df31f6f147e24492` | Purpose predicate |
| `explores` | `0x8bb75e0204b61a2467c6b93d62f355d37f40428ffe40b94f4e1eba272d91326e` | Exploration predicate |
| `partnersWith` | `0x513ab56c087bbe891fe8d3800d4b9514f663b17e223cbfe74e33fe79dffae39f` | Partnership predicate |

## Higher-Level SDK (@0xintuition/sdk)

The `@0xintuition/sdk` package wraps the protocol package with convenience functions.

```bash
npm install @0xintuition/sdk viem
```

### Atom Creation Helpers

```javascript
import {
  createAtomFromString,
  createAtomFromThing,
  createAtomFromEthereumAccount,
  createAtomFromSmartContract,
  createAtomFromIpfsUri,
} from '@0xintuition/sdk';

// String atom
const atom = await createAtomFromString(config, 'developer', parseEther('0.01'));

// Thing atom (JSON-LD, auto-pinned to IPFS)
const atom = await createAtomFromThing(config, {
  url: 'https://example.com',
  name: 'Example Project',
  description: 'A project description',
  image: 'https://example.com/logo.png',
  tags: ['web3', 'defi'],
}, parseEther('0.05'));

// Ethereum account atom
const atom = await createAtomFromEthereumAccount(config, '0xd8dA6BF26964aF...');

// Smart contract atom
const atom = await createAtomFromSmartContract(config, '0x1f9840a...');

// IPFS URI atom
const atom = await createAtomFromIpfsUri(config, 'ipfs://bafkrei...');
```

### Search & Discovery

```javascript
import { globalSearch, semanticSearch, findAtomIds, findTripleIds } from '@0xintuition/sdk';

const results = await globalSearch({ query: 'AI Agent' });
const atomIds = await findAtomIds({ labels: ['developer', 'AI Agent'] });
const tripleIds = await findTripleIds({ subject: atomId, predicate: isPredicateId });
```

## External Resources

- **Protocol repo:** github.com/0xIntuition/intuition-ts
- **Contracts repo:** github.com/0xIntuition/intuition-beta-contracts
- **Docs:** docs.intuition.systems
- **Tech docs:** tech.docs.intuition.systems
- **Portal:** portal.intuition.systems
- **Explorer:** explorer.intuition.systems
