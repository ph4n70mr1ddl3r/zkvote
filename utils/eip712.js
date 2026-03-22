import { ethers } from 'ethers';
import { DOMAIN_CONFIG, VOTE_TYPES, MAX_TOPIC_ID_LENGTH, TOPIC_ID_PATTERN } from './constants.js';

/**
 * EIP-712 utilities for deterministic signature generation
 * This allows hardware wallets to sign without exposing private keys
 */

/**
 * Validate a topic ID string for format and length.
 * @param {string} topicId - Topic ID to validate
 * @throws {Error} If topicId is empty, too long, or contains invalid characters
 */
function validateTopicId(topicId) {
    if (!topicId || typeof topicId !== 'string' || topicId.trim().length === 0) {
        throw new Error('Topic ID must be a non-empty string');
    }
    if (topicId.length > MAX_TOPIC_ID_LENGTH) {
        throw new Error(`Topic ID exceeds maximum length of ${MAX_TOPIC_ID_LENGTH} characters`);
    }
    if (!TOPIC_ID_PATTERN.test(topicId)) {
        throw new Error(
            'Topic ID contains invalid characters (only alphanumeric, hyphen, and underscore allowed)'
        );
    }
}

export { validateTopicId };

/**
 * Create EIP-712 domain separator for the voting system.
 * The domain ensures signatures are only valid within this specific voting context.
 * @param {string} topicId - Unique identifier for the voting topic
 * @returns {Object} EIP-712 domain object with name, version, chainId, verifyingContract, and salt
 * @throws {Error} If topicId is invalid
 */
export function createDomain(topicId) {
    validateTopicId(topicId);
    return {
        ...DOMAIN_CONFIG,
        salt: ethers.id(topicId),
    };
}

/**
 * EIP-712 type definitions for vote message structure.
 * Defines the schema for typed data signing.
 * @type {Object}
 */
export const voteTypes = VOTE_TYPES;

/**
 * Create a vote message structure for EIP-712 signing.
 * @param {string} topicId - Unique identifier for the voting topic
 * @returns {Object} Vote message object with topic field
 * @throws {Error} If topicId is invalid
 */
export function createVoteMessage(topicId) {
    validateTopicId(topicId);
    return {
        topic: topicId,
    };
}

/**
 * Sign a vote message using EIP-712 typed data signing.
 * Produces a deterministic signature that can be used for nullifier generation.
 * @param {Object} wallet - Ethers wallet instance with signTypedData method
 * @param {string} topicId - Unique identifier for the voting topic
 * @returns {Promise<Object>} Signature object containing:
 *   - signature: Full hex-encoded signature (65 bytes)
 *   - r: Signature r component as BigInt string
 *   - s: Signature s component as BigInt string
 *   - v: Recovery ID (27 or 28)
 *   - messageHash: Keccak256 hash of the typed data
 * @throws {Error} If wallet is invalid or topicId is invalid
 */
export async function signVoteMessage(wallet, topicId) {
    validateTopicId(topicId);
    if (!wallet || typeof wallet.signTypedData !== 'function') {
        throw new Error('Invalid wallet instance provided');
    }

    const domain = createDomain(topicId);
    const message = createVoteMessage(topicId);

    try {
        const signature = await wallet.signTypedData(domain, voteTypes, message);

        const sig = ethers.Signature.from(signature);

        return {
            signature,
            r: sig.r,
            s: sig.s,
            v: sig.v,
            messageHash: ethers.TypedDataEncoder.hash(domain, voteTypes, message),
        };
    } catch (error) {
        throw new Error(`Failed to sign vote message: ${error.message}`);
    }
}

/**
 * Extract signature components as field elements suitable for circuit input.
 * Converts r, s, v to string representations compatible with circom.
 * @param {Object} sig - Signature object with r, s, and v properties
 * @returns {Object} Object with r, s, and v as string values
 * @throws {Error} If sig is invalid or missing required properties
 */
export function signatureToFieldElements(sig) {
    if (!sig || typeof sig !== 'object') {
        throw new Error('Invalid signature object provided');
    }
    if (!sig.r || !sig.s || sig.v === undefined) {
        throw new Error('Signature object must contain r, s, and v properties');
    }

    try {
        return {
            r: BigInt(sig.r).toString(),
            s: BigInt(sig.s).toString(),
            v: sig.v.toString(),
        };
    } catch (error) {
        throw new Error(`Failed to convert signature to field elements: ${error.message}`);
    }
}

/**
 * Recover the signer address from an EIP-712 signature.
 * Used for verifying that a signature was created by the expected voter.
 * @param {string} topicId - Unique identifier for the voting topic
 * @param {string} signature - Hex-encoded signature (65 bytes)
 * @returns {string} Recovered Ethereum address (checksummed)
 * @throws {Error} If parameters are invalid or signature is malformed
 */
export function recoverSigner(topicId, signature) {
    validateTopicId(topicId);
    if (!signature || typeof signature !== 'string') {
        throw new Error('Signature must be a non-empty string');
    }

    const domain = createDomain(topicId);
    const message = createVoteMessage(topicId);

    try {
        return ethers.verifyTypedData(domain, voteTypes, message, signature);
    } catch (error) {
        throw new Error(`Failed to recover signer: ${error.message}`);
    }
}

/**
 * Verify that a signature was created by a specific address.
 * @param {string} expectedAddress - The address that should have signed
 * @param {string} topicId - Unique identifier for the voting topic
 * @param {string} signature - Hex-encoded signature
 * @returns {boolean} True if the signature matches the expected address
 * @throws {Error} If parameters are invalid
 */
export function verifySignature(expectedAddress, topicId, signature) {
    const recovered = recoverSigner(topicId, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
}
