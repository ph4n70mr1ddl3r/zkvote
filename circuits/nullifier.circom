pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Deterministic nullifier generation circuit
 * Creates a unique nullifier from signature and topic to prevent double voting
 *
 * The nullifier is computed as: Poseidon(sigR, sigS, topicId, messageHash)
 *
 * Security: This circuit enforces that signature components are non-zero.
 * Note: Full ECDSA verification is not included due to circuit constraints.
 * In production, signature verification should be performed outside the circuit
 * or a full ECDSA verification circuit should be used.
 */

template Nullifier() {
    signal input sigR;
    signal input sigS;
    signal input topicId;
    signal input messageHash;
    
    signal output nullifier;
    
    // Ensure signature components are non-zero (basic validation)
    // Full ECDSA range checking would be expensive in-circuit
    component nonZeroR = IsZero();
    nonZeroR.in <== sigR;
    nonZeroR.out === 0;
    
    component nonZeroS = IsZero();
    nonZeroS.in <== sigS;
    nonZeroS.out === 0;
    
    component hasher = Poseidon(4);
    hasher.inputs[0] <== sigR;
    hasher.inputs[1] <== sigS;
    hasher.inputs[2] <== topicId;
    hasher.inputs[3] <== messageHash;
    
    nullifier <== hasher.out;
}
