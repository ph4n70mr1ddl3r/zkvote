pragma circom 2.0.0;

include "./merkle-proof.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/less_than.circom";

var SECP256K1_N = 115792089237316195423570985008687907852837564279074904382605163141518161494337;

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

    component ltR = LessThan(254);
    ltR.in[0] <== sigR;
    ltR.in[1] <== SECP256K1_N;
    ltR.out === 1;

    component ltS = LessThan(254);
    ltS.in[0] <== sigS;
    ltS.in[1] <== SECP256K1_N;
    ltS.out === 1;

    signal sigRNonZero;
    sigRNonZero <== (sigR > 0) ? 1 : 0;
    sigRNonZero === 1;

    signal sigSNonZero;
    sigSNonZero <== (sigS > 0) ? 1 : 0;
    sigSNonZero === 1;

    signal vValid;
    vValid <== (sigV == 27 || sigV == 28) ? 1 : 0;
    vValid === 1;
    
    component nullifierHasher = Poseidon(4);
    nullifierHasher.inputs[0] <== sigR;
    nullifierHasher.inputs[1] <== sigS;
    nullifierHasher.inputs[2] <== topicId;
    nullifierHasher.inputs[3] <== messageHash;
    
    nullifier <== nullifierHasher.out;
}

component main {public [merkleRoot, topicId, messageHash]} = Vote(7);

