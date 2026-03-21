pragma circom 2.0.0;

include "./merkle-proof.circom";
include "./nullifier.circom";

template Vote(levels) {
    signal input merkleRoot;
    signal input topicId;
    signal input messageHash;

    signal input voterAddress;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input sigR;
    signal input sigS;
    
    signal output nullifier;
    
    component merkleProof = MerkleProof(levels);
    merkleProof.root <== merkleRoot;
    merkleProof.leaf <== voterAddress;
    merkleProof.pathElements <== pathElements;
    merkleProof.pathIndices <== pathIndices;
    
    component nullifierComponent = Nullifier();
    nullifierComponent.sigR <== sigR;
    nullifierComponent.sigS <== sigS;
    nullifierComponent.topicId <== topicId;
    nullifierComponent.messageHash <== messageHash;
    
    nullifier <== nullifierComponent.nullifier;
}

component main {public [merkleRoot, topicId, messageHash]} = Vote(7);
