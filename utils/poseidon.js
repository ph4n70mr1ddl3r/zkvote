import { buildPoseidon } from 'circomlibjs';

let poseidonInstance = null;

/**
 * Get or create a singleton Poseidon hash instance
 * @returns {Promise<Object>} Poseidon instance
 */
export async function getPoseidon() {
    if (!poseidonInstance) {
        poseidonInstance = buildPoseidon();
    }
    return poseidonInstance;
}

/**
 * Reset the singleton Poseidon instance (useful for testing)
 */
export function resetPoseidonInstance() {
    poseidonInstance = null;
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
const BN254_FIELD_ORDER = BigInt(
    '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

function validateFieldElement(value, name) {
    let bigIntValue;
    try {
        bigIntValue = BigInt(value);
    } catch (error) {
        throw new Error(`${name} is not a valid BigInt: ${value}`);
    }
    if (bigIntValue < 0n) {
        throw new Error(`${name} must be non-negative, got ${bigIntValue}`);
    }
    if (bigIntValue >= BN254_FIELD_ORDER) {
        throw new Error(`${name} exceeds BN254 field order`);
    }
    return bigIntValue;
}

export function addressToFieldElement(address) {
    if (typeof address !== 'string') {
        throw new TypeError(`Address must be a string, received ${typeof address}`);
    }
    if (!address.startsWith('0x')) {
        throw new Error(`Address must start with 0x prefix, received: ${address}`);
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error(`Address must be a valid 20-byte Ethereum address, received: ${address}`);
    }
    try {
        const addressBigInt = validateFieldElement(address, 'Address');
        return addressBigInt.toString();
    } catch (error) {
        throw new Error(`Failed to convert address to field element: ${error.message}`);
    }
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
        const rField = validateFieldElement(sigR, 'Signature r');
        const sField = validateFieldElement(sigS, 'Signature s');
        const topicField = validateFieldElement(topicIdHash, 'Topic ID hash');
        return poseidonHashMany([rField, sField, topicField]);
    } catch (error) {
        throw new Error(`Failed to compute nullifier: ${error.message}`);
    }
}
