# ZKP Voting System

A zero-knowledge proof voting system using Ethereum accounts, Merkle trees, and deterministic signatures for anonymous yet verifiable voting.

## Features

- ✅ **Anonymous Voting**: Voters can prove eligibility without revealing their identity
- ✅ **Merkle Tree Membership**: Efficient proof that a voter is in the valid voter set
- ✅ **Deterministic Nullifiers**: Prevents double voting while maintaining anonymity
- ✅ **Hardware Wallet Compatible**: Uses EIP-712 signatures instead of exposing private keys
- ✅ **Zero-Knowledge Proofs**: Built with Circom and SnarkJS (Groth16)
- ✅ **Comprehensive Testing**: Full test suite covering all critical functionality

## Architecture

### Components

1. **Account Generation**: Creates 100 valid and 100 invalid voter Ethereum accounts
2. **Merkle Tree**: Builds a Poseidon hash-based Merkle tree from valid voter addresses
3. **ZKP Circuits**: Circom circuits for membership proofs and nullifier generation
4. **Proof System**: Scripts to generate and verify zero-knowledge proofs
5. **Test Suite**: Comprehensive tests for validation

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     ZKP Voting Flow                             │
└─────────────────────────────────────────────────────────────────┘

1. Setup Phase:
   • Generate 100 valid voter accounts
   • Build Merkle tree from valid voter addresses
   • Compute and publish Merkle root

2. Voting Phase:
   • Voter signs vote message with EIP-712 (deterministic)
   • Generate Merkle proof for voter's address
   • Compute nullifier = Hash(sig_r, sig_s, topic_id)
   • Create ZK proof proving:
     - Voter address is in Merkle tree
     - Nullifier is correctly computed
     - Vote message is properly signed

3. Verification Phase:
   • Verifier checks ZK proof validity
   • Check nullifier hasn't been used before (prevents double voting)
   • Accept vote if proof valid and nullifier is new
```

## Installation

### Prerequisites

- Node.js >= 18
- Rust and Cargo (for Circom)
- Circom >= 2.0.0

### Install Circom

```bash
# Install Circom
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Verify installation
circom --version
```

### Install Project Dependencies

```bash
cd zkvote
npm install
```

## Quick Start

**SECURITY WARNING**: This project generates and stores private keys in JSON files for testing purposes only. Never use these keys in production or commit them to a public repository.

### 1. Generate Accounts

```bash
npm run generate-accounts
```

Creates:
- `data/valid-voters.json` - 100 valid voter accounts
- `data/invalid-voters.json` - 100 invalid voter accounts

### 2. Build Merkle Tree

```bash
npm run build-tree
```

Creates `data/merkle-tree.json` and displays the Merkle root.

### 3. Compile Circuits

```bash
npm run compile-circuits
```

This will:
- Compile the Circom circuits
- Download powers of tau
- Generate proving and verification keys
- Export Solidity verifier contract

⏱️ **Note**: This step takes 5-10 minutes depending on your machine.

### 4. Run Tests

```bash
npm test
```

Runs all test suites:
- ✅ Valid voter proof generation
- ✅ Invalid voter rejection
- ✅ Nullifier determinism
- ✅ Double voting prevention

### 5. Generate a Proof

```bash
npm run generate-proof 0 "Vote for Proposal A"
```

Generates a ZK proof for voter at index 0 voting for "Proposal A".

### 6. Verify a Proof

```bash
npm run verify-proof
```

Verifies the most recently generated proof.

## Usage Examples

### Generate Proof for Valid Voter

```bash
# Voter at index 5 votes for Option B
node scripts/generate-proof.js 5 "Vote for Option B"
```

Output includes:
- Voter address
- Merkle root
- Signature components
- Nullifier
- ZK proof

### Attempt Proof with Invalid Voter

```bash
# Try to generate proof with invalid voter (will fail verification)
node scripts/generate-proof.js --invalid 0 "Vote for Option C"
```

### Verify a Specific Proof

```bash
# Verify a specific proof file
node scripts/verify-proof.js build/latest_proof.json
```

## Project Structure

```
zkvote/
├── circuits/
│   ├── vote.circom              # Main voting circuit
│   ├── merkle-proof.circom      # Merkle tree verification
│   └── nullifier.circom         # Nullifier generation
├── scripts/
│   ├── generate-accounts.js     # Create voter accounts
│   ├── build-merkle-tree.js     # Build Merkle tree
│   ├── compile-circuits.js      # Compile circuits + setup
│   ├── generate-proof.js        # Generate ZK proofs
│   └── verify-proof.js          # Verify ZK proofs
├── tests/
│   ├── test-valid-voter.js      # Valid voter tests
│   ├── test-invalid-voter.js    # Invalid voter tests
│   ├── test-nullifier-determinism.js  # Nullifier tests
│   ├── test-double-voting.js    # Double vote prevention
│   └── run-all-tests.js         # Master test runner
├── utils/
│   ├── poseidon.js              # Poseidon hash utilities
│   ├── eip712.js                # EIP-712 signature utilities
│   └── merkle-helper.js         # Merkle tree utilities
├── data/
│   ├── valid-voters.json        # Valid voter accounts
│   ├── invalid-voters.json      # Invalid voter accounts
│   └── merkle-tree.json         # Merkle tree data
└── build/                       # Compiled circuits and keys
```

## Technical Details

### Deterministic Signatures (EIP-712)

Instead of using private keys directly in the circuit (which would expose them), we use EIP-712 typed data signatures. This provides:

- **Hardware wallet compatibility**: Signatures can be generated by hardware wallets
- **Determinism**: Same voter + same topic = same signature components
- **Security**: Private keys never leave the wallet

### Nullifier Design

Nullifiers prevent double voting:

```
nullifier = Poseidon(signature_r, signature_s, topic_id)
```

Properties:
- **Deterministic**: Same voter voting on same topic generates same nullifier
- **Unique per topic**: Different topics generate different nullifiers
- **Unique per voter**: Different voters generate different nullifiers
- **Anonymous**: Nullifier reveals nothing about voter identity

### Merkle Tree

- **Hash function**: Poseidon (ZK-friendly)
- **Depth**: 7 (supports up to 128 voters)
- **Leaves**: Ethereum addresses as field elements

### Circuit Design

The main circuit (`vote.circom`) proves:

1. **Membership**: Voter's address is in the Merkle tree
2. **Nullifier**: Nullifier is correctly computed from signature
3. **Message**: Vote message hash is included in the proof

Public inputs:
- Merkle root
- Topic ID
- Message hash

Public output:
- Nullifier

Private inputs:
- Voter address
- Merkle proof (path elements + indices)
- Signature components (r, s)

## Testing

### Test Suite

Run all tests:
```bash
npm test
```

Run individual tests:
```bash
npm run test:valid         # Valid voter tests
npm run test:invalid       # Invalid voter tests
npm run test:nullifier     # Nullifier determinism
npm run test:double-vote   # Double voting prevention
```

### What's Tested

✅ **Valid Voter Test**
- Valid voters can generate proofs
- Proofs verify correctly
- Nullifiers are deterministic
- Merkle root validation works

✅ **Invalid Voter Test**
- Invalid voters cannot generate valid proofs
- Proofs with fake Merkle paths fail verification
- System correctly rejects invalid voters

✅ **Nullifier Determinism Test**
- Same voter + same topic = same nullifier
- Same voter + different topic = different nullifier
- Different voter + same topic = different nullifier

✅ **Double Voting Prevention Test**
- First vote succeeds and registers nullifier
- Second vote on same topic generates same nullifier
- Nullifier registry detects duplicate
- System prevents double voting

## Security Considerations

1. **Trusted Setup**: This demo uses a public powers of tau ceremony. Production systems should use a trusted setup specific to the circuit.

2. **Signature Verification**: The current circuit includes basic signature validation. Full ECDSA verification in ZK is expensive and omitted for this demo.

3. **Nullifier Registry**: The system requires a centralized or decentralized registry to track used nullifiers and prevent double voting.

4. **Merkle Tree Updates**: Adding new voters requires updating the Merkle root. This should be done through a secure governance process.

## License

MIT

## Resources

- [Circom Documentation](https://docs.circom.io/)
- [SnarkJS](https://github.com/iden3/snarkjs)
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712)
- [Poseidon Hash](https://www.poseidon-hash.info/)
