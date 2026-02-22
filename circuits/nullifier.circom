pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Deterministic nullifier generation circuit
 * Creates a unique nullifier from signature and topic to prevent double voting
 *
 * Note: This circuit does not have a 'component main' definition because it is
 * designed to be used as a sub-component within the main Vote circuit.
 * For standalone nullifier computation, use utils/poseidon.js:computeNullifier
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
