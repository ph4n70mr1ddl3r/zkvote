pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Deterministic nullifier generation circuit
 * Creates a unique nullifier from signature and topic to prevent double voting
 *
 * The nullifier is computed as: Poseidon(sigR, sigS, topicId, messageHash)
 */

template Nullifier() {
    signal input sigR;
    signal input sigS;
    signal input topicId;
    signal input messageHash;
    
    signal output nullifier;
    
    component hasher = Poseidon(4);
    hasher.inputs[0] <== sigR;
    hasher.inputs[1] <== sigS;
    hasher.inputs[2] <== topicId;
    hasher.inputs[3] <== messageHash;
    
    nullifier <== hasher.out;
}
