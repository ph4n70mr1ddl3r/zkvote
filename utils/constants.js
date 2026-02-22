/**
 * Depth of the Merkle tree (supports up to 2^7 = 128 voters)
 */
export const TREE_DEPTH = 7;

/**
 * Padding value for Merkle tree leaves (using BN254 field order)
 */
export const MERKLE_PADDING_VALUE =
    '21888242871839275222246405745257275088548364400416034343698204186575808495616';

/**
 * Minimum file size for powers of tau in bytes
 */
export const PTAU_MIN_FILE_SIZE = 1000000;

/**
 * Default topic ID for voting
 */
export const DEFAULT_TOPIC_ID = 'vote-topic-2024';

/**
 * Regular expression for allowed vote message characters (ASCII printable, non-empty)
 */
export const ALLOWED_VOTE_MESSAGE_PATTERN = /^[\x20-\x7E]+$/;

/**
 * EIP-712 domain configuration
 */
function parseChainId(envValue) {
    const parsed = parseInt(envValue, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        if (envValue !== undefined && envValue !== '1') {
            console.warn(`Warning: Invalid CHAIN_ID "${envValue}", defaulting to 1`);
        }
        return 1;
    }
    return parsed;
}

export const DOMAIN_CONFIG = {
    name: 'ZKVoting',
    version: '1',
    chainId: parseChainId(process.env.CHAIN_ID || '1'),
    verifyingContract:
        process.env.VERIFYING_CONTRACT || '0x0000000000000000000000000000000000000000',
};

/**
 * EIP-712 type definitions for vote message
 */
export const VOTE_TYPES = {
    Vote: [{ name: 'topic', type: 'string' }],
};

/**
 * File paths for data and build artifacts
 */
export const FILE_PATHS = {
    data: {
        validVoters: 'data/valid-voters.json',
        invalidVoters: 'data/invalid-voters.json',
        merkleTree: 'data/merkle-tree.json',
    },
    build: {
        proofInput: 'build/proof_input.json',
        latestProof: 'build/latest_proof.json',
        wasm: 'build/vote_js/vote.wasm',
        zkey: 'build/vote.zkey',
        verificationKey: 'build/vote_verification_key.json',
    },
};

/**
 * Maximum length for vote message in characters
 */
export const MAX_VOTE_MESSAGE_LENGTH = 500;

/**
 * Maximum length for topic ID in characters
 */
export const MAX_TOPIC_ID_LENGTH = 256;

export const TOPIC_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Circuit configuration
 */
export const CIRCUIT_CONFIG = {
    CIRCUIT_NAME: 'vote',
    PTAU_SIZE: 15,
};

/**
 * Number of accounts to generate for testing
 */
export const NUM_ACCOUNTS = 100;

/**
 * Public signal indices in proof
 */
export const PUBLIC_SIGNAL = {
    NULLIFIER: 0,
    MERKLE_ROOT: 1,
    TOPIC_ID: 2,
    MESSAGE_HASH: 3,
};

/**
 * Display widths for console output
 */
export const DISPLAY_WIDTH = {
    STANDARD: 70,
    WIDE: 80,
};

/**
 * Maximum tree size based on TREE_DEPTH (computed dynamically)
 */
export const MAX_TREE_SIZE = 2 ** TREE_DEPTH;

/**
 * Maximum voter index based on TREE_DEPTH (computed dynamically)
 */
export const MAX_VOTER_INDEX = MAX_TREE_SIZE - 1;
