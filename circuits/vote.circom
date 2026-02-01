pragma circom 2.0.0;

include "./merkle-proof.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Main voting circuit
 * Proves:
 * 1. Voter's address is in the Merkle tree (eligible voter)
 * 2. Generates deterministic nullifier from signature
 * 3. Links signature to vote message
 */

template Vote(levels) {
    // Public inputs
    signal input merkleRoot;          // Merkle root of valid voters
    signal input topicId;              // Voting topic identifier (used in nullifier)
    signal input messageHash;          // Hash of vote message (currently unused, kept for future use)

    // Private inputs
    signal input voterAddress;         // Voter's Ethereum address
    signal input pathElements[levels]; // Merkle proof
    signal input pathIndices[levels];  // Merkle proof indices
    signal input sigR;                 // Signature r component
    signal input sigS;                 // Signature s component
    
    // Public output
    signal output nullifier;
    
    // 1. Verify Merkle proof (voter is in valid voter set)
    component merkleProof = MerkleProof(levels);
    merkleProof.root <== merkleRoot;
    merkleProof.leaf <== voterAddress;
    merkleProof.pathElements <== pathElements;
    merkleProof.pathIndices <== pathIndices;
    
    // 2. Generate deterministic nullifier
    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== sigR;
    nullifierHasher.inputs[1] <== sigS;
    nullifierHasher.inputs[2] <== topicId;
    
    nullifier <== nullifierHasher.out;

    // Note: Full ECDSA signature verification is not implemented here
    // For production use, implement proper ECDSA verification circuit
    // or validate signatures outside of the ZK proof
}

// Note: TREE_DEPTH=7 is hardcoded here to match utils/constants.js
// If changing TREE_DEPTH, update both files
component main {public [merkleRoot, topicId, messageHash]} = Vote(7);

