pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Merkle tree membership proof circuit
 * Verifies that a leaf is part of a Merkle tree with a given root
 */

template MerkleProof(levels) {
    // Public inputs
    signal input root;
    signal input leaf;
    
    // Private inputs
    signal input pathElements[levels];
    signal input pathIndices[levels];
    
    // Compute Merkle root from leaf and path
    signal computedHash[levels + 1];
    computedHash[0] <== leaf;
    
    component hashers[levels];
    
    // Intermediate signals for selecting left/right based on path index
    signal leftSelector[levels];
    signal rightSelector[levels];
    
    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        
        // Select left and right based on path index
        // If pathIndices[i] == 0, current is left (leftSelector), sibling is right (rightSelector)
        // If pathIndices[i] == 1, current is right (rightSelector), sibling is left (leftSelector)
        
        leftSelector[i] <== computedHash[i] + pathIndices[i] * (pathElements[i] - computedHash[i]);
        rightSelector[i] <== pathElements[i] + pathIndices[i] * (computedHash[i] - pathElements[i]);
        
        hashers[i].inputs[0] <== leftSelector[i];
        hashers[i].inputs[1] <== rightSelector[i];
        
        computedHash[i + 1] <== hashers[i].out;
    }
    
    // Verify computed root matches expected root
    root === computedHash[levels];
}
