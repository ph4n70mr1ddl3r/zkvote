pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Deterministic nullifier generation circuit
 * Creates a unique nullifier from signature and topic to prevent double voting
 */

template Nullifier() {
    // Private inputs: signature components
    signal input sigR;
    signal input sigS;
    
    // Public input: topic identifier
    signal input topicId;
    
    // Public output: nullifier
    signal output nullifier;
    
    // Compute nullifier = Poseidon(sigR, sigS, topicId)
    component hasher = Poseidon(3);
    hasher.inputs[0] <== sigR;
    hasher.inputs[1] <== sigS;
    hasher.inputs[2] <== topicId;
    
    nullifier <== hasher.out;
}
