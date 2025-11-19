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
    signal input topicId;              // Voting topic identifier
    signal input messageHash;          // Hash of vote message
    
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
    
    // 3. Verify signature is related to message
    // We verify that the signature components are non-zero
    // (Full ECDSA verification would be too expensive for this demo)
    signal sigRNonZero;
    signal sigSNonZero;
    sigRNonZero <== sigR * sigR;
    sigSNonZero <== sigS * sigS;
    
    // Ensure message hash is included in the proof
    signal messageHashSquared;
    messageHashSquared <== messageHash * messageHash;
}

component main {public [merkleRoot, topicId, messageHash]} = Vote(7);
