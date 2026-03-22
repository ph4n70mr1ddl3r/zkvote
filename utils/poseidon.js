import { buildPoseidon } from 'circomlibjs';
import { BN254_FIELD_ORDER, SECP256K1_N, SECP256K1_N_HALF } from './constants.js';

let poseidonPromise = null;

/**
 * Get or initialize the Poseidon hash function instance.
 * Uses singleton pattern to avoid rebuilding on every call.
 * @returns {Promise<Object>} Poseidon instance with hash function
 */
export async function getPoseidon() {
    if (!poseidonPromise) {
        poseidonPromise = buildPoseidon();
    }
    return poseidonPromise;
}

/**
 * Reset the cached Poseidon instance.
 * Useful for testing scenarios where you need to ensure a fresh instance.
 */
export function resetPoseidonInstance() {
    poseidonPromise = null;
}

/**
 * Hash a single value using Poseidon hash function.
 * @param {string|bigint|number} input - Value to hash
 * @returns {Promise<string>} Hash result as string
 */
export async function poseidonHash(input) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon([input]));
    return hash;
}

/**
 * Hash two values using Poseidon hash function.
 * @param {string|bigint|number} left - First value
 * @param {string|bigint|number} right - Second value
 * @returns {Promise<string>} Hash result as string
 */
export async function poseidonHash2(left, right) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon([left, right]));
    return hash;
}

/**
 * Hash multiple values using Poseidon hash function.
 * @param {Array<string|bigint|number>} inputs - Array of values to hash
 * @returns {Promise<string>} Hash result as string
 */
export async function poseidonHashMany(inputs) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon(inputs));
    return hash;
}

/**
 * Validate that a value is within the BN254 field element range [0, p).
 * @param {string|bigint|number} value - Value to validate
 * @param {string} name - Name for error messages
 * @returns {bigint} Validated value as BigInt
 * @throws {Error} If value is not a valid field element
 */
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

/**
 * Reduce a value to a field element by taking modulo BN254 field order.
 * @param {string|bigint|number} value - Value to reduce
 * @param {string} name - Name for error messages
 * @returns {bigint} Reduced value as BigInt
 * @throws {Error} If value cannot be converted to BigInt or is negative
 */
function reduceToFieldElement(value, name) {
    let bigIntValue;
    try {
        bigIntValue = BigInt(value);
    } catch (error) {
        throw new Error(`${name} is not a valid BigInt: ${value}`);
    }
    if (bigIntValue < 0n) {
        throw new Error(`${name} must be non-negative, got ${bigIntValue}`);
    }
    return bigIntValue % BN254_FIELD_ORDER;
}

/**
 * Validate that a value is a valid ECDSA scalar in range [1, secp256k1_order).
 * Also checks for low-s value (s <= n/2) for malleability protection.
 * @param {string|bigint|number} value - Value to validate
 * @param {string} name - Name for error messages
 * @param {Object} options - Validation options
 * @param {boolean} options.allowMalleable - If true, skip low-s check
 * @returns {bigint} Validated value as BigInt
 * @throws {Error} If value is not a valid ECDSA scalar
 */
export function validateEcdsaScalar(value, name, options = {}) {
    const { allowMalleable = false } = options;
    let bigIntValue;
    try {
        bigIntValue = BigInt(value);
    } catch (error) {
        throw new Error(`${name} is not a valid BigInt: ${value}`);
    }
    if (bigIntValue <= 0n) {
        throw new Error(`${name} must be positive, got ${bigIntValue}`);
    }
    if (bigIntValue >= SECP256K1_N) {
        throw new Error(`${name} must be less than secp256k1 curve order`);
    }
    if (!allowMalleable && bigIntValue > SECP256K1_N_HALF) {
        throw new Error(
            `${name} is a "high-s" value which causes signature malleability issues. ` +
                `Use low-s (s <= n/2) for EIP-2 compliance. Use toLowS() to convert.`
        );
    }
    return bigIntValue;
}

/**
 * Validate the recovery ID (v) component of an ECDSA signature.
 * For Ethereum, valid values are 27 or 28.
 * @param {string|number} v - Recovery ID to validate
 * @returns {number} Validated recovery ID
 * @throws {Error} If v is not 27 or 28
 */
export function validateSignatureV(v) {
    const vNum = Number(v);
    if (vNum !== 27 && vNum !== 28) {
        throw new Error(`Invalid signature v value: must be 27 or 28, got ${v}`);
    }
    return vNum;
}

/**
 * Convert an Ethereum address to a field element for circuit input.
 * Validates address format and ensures it fits within BN254 field.
 * @param {string} address - Ethereum address (0x-prefixed, 40 hex chars)
 * @returns {string} Address as decimal string for circuit input
 * @throws {TypeError} If address is not a string
 * @throws {Error} If address format is invalid or exceeds field bounds
 */
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
 * Compute a deterministic nullifier from signature components and topic.
 * The nullifier is used to prevent double-voting while maintaining voter privacy.
 * @param {string|bigint} sigR - ECDSA signature r component
 * @param {string|bigint} sigS - ECDSA signature s component
 * @param {string|bigint} topicIdHash - Hash of the voting topic ID
 * @param {string|bigint} messageHash - Hash of the signed message
 * @returns {Promise<string>} Nullifier as decimal string
 * @throws {Error} If any parameter is missing or invalid
 */
export async function computeNullifier(sigR, sigS, topicIdHash, messageHash) {
    if (sigR === undefined || sigR === null || sigR === '') {
        throw new Error('Signature component r is required');
    }
    if (sigS === undefined || sigS === null || sigS === '') {
        throw new Error('Signature component s is required');
    }
    if (topicIdHash === undefined || topicIdHash === null || topicIdHash === '') {
        throw new Error('Topic ID hash is required');
    }
    if (messageHash === undefined || messageHash === null || messageHash === '') {
        throw new Error('Message hash is required');
    }

    try {
        const rField = validateEcdsaScalar(sigR, 'Signature r');
        const sField = validateEcdsaScalar(sigS, 'Signature s');
        const topicField = reduceToFieldElement(topicIdHash, 'Topic ID hash');
        const messageField = reduceToFieldElement(messageHash, 'Message hash');
        return poseidonHashMany([rField, sField, topicField, messageField]);
    } catch (error) {
        throw new Error(`Failed to compute nullifier: ${error.message}`);
    }
}

/**
 * Check if an ECDSA signature s-value is in "low-s" form (s <= n/2).
 * Low-s values are required by EIP-2 for transaction validity on Ethereum.
 * @param {string|bigint} s - Signature s component
 * @returns {boolean} True if s is in low-s form
 */
export function isLowS(s) {
    const sBigInt = BigInt(s);
    return sBigInt <= SECP256K1_N_HALF;
}

/**
 * Convert a "high-s" value to "low-s" form by computing n - s.
 * This ensures signature malleability is prevented.
 * @param {string|bigint} s - Signature s component
 * @returns {bigint} Low-s form of the signature
 */
export function toLowS(s) {
    const sBigInt = BigInt(s);
    if (sBigInt > SECP256K1_N_HALF) {
        return SECP256K1_N - sBigInt;
    }
    return sBigInt;
}
