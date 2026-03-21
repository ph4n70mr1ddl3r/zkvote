pragma circom 2.0.0;

include "./merkle-proof.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template Vote(levels) {
    signal input merkleRoot;
    signal input topicId;
    signal input messageHash;

    signal input voterAddress;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input sigR;
    signal input sigS;
    signal input sigV;
    
    signal output nullifier;
    
    component merkleProof = MerkleProof(levels);
    merkleProof.root <== merkleRoot;
    merkleProof.leaf <== voterAddress;
    merkleProof.pathElements <== pathElements;
    merkleProof.pathIndices <== pathIndices;
    
    component nullifierHasher = Poseidon(4);
    nullifierHasher.inputs[0] <== sigR;
    nullifierHasher.inputs[1] <== sigS;
    nullifierHasher.inputs[2] <== topicId;
    nullifierHasher.inputs[3] <== messageHash;
    
    nullifier <== nullifierHasher.out;
}

component main {public [merkleRoot, topicId, messageHash]} = Vote(7);
