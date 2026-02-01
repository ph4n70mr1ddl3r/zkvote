import { buildPoseidon } from 'circomlibjs';

let poseidonInstance = null;
let poseidonPromise = null;

/**
 * Get or create a singleton Poseidon hash instance
 * @returns {Promise<Object>} Poseidon instance
 */
export async function getPoseidon() {
    if (!poseidonPromise) {
        poseidonPromise = buildPoseidon();
    }
    const instance = await poseidonPromise;
    if (!poseidonInstance) {
        poseidonInstance = instance;
    }
    return poseidonInstance;
}

/**
 * Reset the singleton Poseidon instance (useful for testing)
 */
export function resetPoseidonInstance() {
    poseidonInstance = null;
    poseidonPromise = null;
}

/**
 * Hash a single value using Poseidon
 * @param {string|number} input - Value to hash
 * @returns {Promise<string>} Hash as a string
 */
export async function poseidonHash(input) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon([input]));
    return hash;
}

/**
 * Hash two values using Poseidon (used for Merkle tree)
 * @param {string|number} left - Left value to hash
 * @param {string|number} right - Right value to hash
 * @returns {Promise<string>} Hash as a string
 */
export async function poseidonHash2(left, right) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon([left, right]));
    return hash;
}

/**
 * Hash multiple values using Poseidon
 * @param {Array<string|number>} inputs - Array of values to hash
 * @returns {Promise<string>} Hash as a string
 */
export async function poseidonHashMany(inputs) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon(inputs));
    return hash;
}

/**
 * Convert Ethereum address to field element
 * @param {string} address - Ethereum address with 0x prefix
 * @returns {string} Address as a field element string
 * @throws {Error} If address is invalid
 */
export function addressToFieldElement(address) {
    if (typeof address !== 'string') {
        throw new Error('Address must be a string');
    }
    if (!address.startsWith('0x')) {
        throw new Error('Address must start with 0x prefix');
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error('Address must be a valid 20-byte Ethereum address');
    }
    const addressBigInt = BigInt(address);
    return addressBigInt.toString();
}

/**
 * Compute nullifier from signature and topic ID
 * This is used to prevent double voting
 * @param {string|number} sigR - Signature r component
 * @param {string|number} sigS - Signature s component
 * @param {string|number} topicIdHash - Hashed topic ID
 * @returns {Promise<string>} Nullifier hash
 * @throws {Error} If required parameters are missing or invalid
 */
export async function computeNullifier(sigR, sigS, topicIdHash) {
    if (sigR === undefined || sigR === null || sigR === '') {
        throw new Error('Signature component r is required');
    }
    if (sigS === undefined || sigS === null || sigS === '') {
        throw new Error('Signature component s is required');
    }
    if (topicIdHash === undefined || topicIdHash === null || topicIdHash === '') {
        throw new Error('Topic ID hash is required');
    }

    try {
        return poseidonHashMany([
            BigInt(sigR),
            BigInt(sigS),
            BigInt(topicIdHash)
        ]);
    } catch (error) {
        throw new Error(`Invalid signature or topic ID hash: ${error.message}`);
    }
}
