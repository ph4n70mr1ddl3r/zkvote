# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-03-21

### Changed

- Added non-zero validation for signature components (r, s) in nullifier circuit
- Enhanced security warnings in README with detailed production considerations
- Added `.nvmrc` for Node.js version consistency
- Added `engines` field to `package.json` specifying Node.js >= 18.0.0

### Security

- Circuit now enforces non-zero signature components to prevent trivial attacks
- Documented the lack of in-circuit ECDSA verification and its implications
- Added warning about signature-to-address binding limitations

## [1.0.0] - 2024-01-01

### Added

- Initial release of ZKP Voting System
- Merkle tree-based voter membership verification
- EIP-712 deterministic signature generation
- Poseidon hash-based nullifier computation
- Groth16 proof generation and verification
- Solidity verifier contract generation
- Comprehensive test suite
    - Valid voter proof generation
    - Invalid voter rejection
    - Nullifier determinism
    - Double voting prevention

### Security

- Basic non-zero validation for signature components in circuit
- Path traversal protection in file operations
- Input validation for all user-provided data

### Known Limitations

- No full ECDSA verification in circuit (expensive)
- Uses public powers of tau (not production trusted setup)
- Requires external nullifier registry for double-vote prevention
