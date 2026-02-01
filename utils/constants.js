export const TREE_DEPTH = 7;

export const MERKLE_PADDING_VALUE = '0';

export const DEFAULT_TOPIC_ID = 'vote-topic-2024';

export const DOMAIN_CONFIG = {
    name: 'ZKVoting',
    version: '1',
    chainId: 1,
    verifyingContract: '0x0000000000000000000000000000000000000000'
};

export const VOTE_TYPES = {
    Vote: [
        { name: 'topic', type: 'string' }
    ]
};

export const FILE_PATHS = {
    data: {
        validVoters: 'data/valid-voters.json',
        invalidVoters: 'data/invalid-voters.json',
        merkleTree: 'data/merkle-tree.json'
    },
    build: {
        proofInput: 'build/proof_input.json',
        latestProof: 'build/latest_proof.json',
        wasm: 'build/vote_js/vote.wasm',
        zkey: 'build/vote.zkey',
        verificationKey: 'build/vote_verification_key.json'
    }
};

export const MAX_VOTE_MESSAGE_LENGTH = 500;

export const CIRCUIT_CONFIG = {
    CIRCUIT_NAME: 'vote',
    PTAU_SIZE: 15
};

export const NUM_ACCOUNTS = 100;
