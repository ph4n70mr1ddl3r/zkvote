import * as merkleHelper from './utils/merkle-helper.js';
import * as poseidon from './utils/poseidon.js';
import * as eip712 from './utils/eip712.js';
import * as jsonHelper from './utils/json-helper.js';
import * as proofHelper from './utils/proof-helper.js';
import * as constants from './utils/constants.js';

/**
 * ZKVote - Zero-Knowledge Proof Voting System Library
 *
 * Provides utilities for:
 * - Merkle tree construction and proof generation
 * - Poseidon hash functions for SNARK compatibility
 * - EIP-712 typed data signing for deterministic signatures
 * - JSON file handling with validation
 * - Groth16 proof generation and verification
 *
 * @module zkvote
 * @version 1.0.1
 */
export const zkvote = {
    version: '1.0.1',
    merkle: merkleHelper,
    poseidon,
    eip712,
    file: jsonHelper,
    proof: proofHelper,
    constants,
};

export default zkvote;
