import { ethers } from 'ethers';
import { DOMAIN_CONFIG, VOTE_TYPES, MAX_TOPIC_ID_LENGTH, TOPIC_ID_PATTERN } from './constants.js';

/**
 * EIP-712 utilities for deterministic signature generation
 * This allows hardware wallets to sign without exposing private keys
 */

/**
 * Create EIP-712 domain for the voting system
 * @param {string} topicId - Unique identifier for the voting topic
 * @returns {Object} EIP-712 domain object
 * @throws {Error} If topicId is invalid
 */

export function createDomain(topicId) {
    if (!topicId || typeof topicId !== 'string') {
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

    return {
        ...DOMAIN_CONFIG,
        salt: ethers.id(topicId),
    };
}

/**
 * Create EIP-712 types for vote message
 * @type {Object}
 */
export const voteTypes = VOTE_TYPES;

/**
 * Create vote message structure
 * @param {string} topicId - Unique identifier for the voting topic
 * @returns {Object} Vote message object
 * @throws {Error} If topicId is invalid
 */
export function createVoteMessage(topicId) {
    if (!topicId || typeof topicId !== 'string') {
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

    return {
        topic: topicId,
    };
}

/**
 * Sign a vote message using EIP-712
 * Returns deterministic signature components
 * @param {Object} wallet - Ethers wallet instance
 * @param {string} topicId - Unique identifier for the voting topic
 * @returns {Promise<Object>} Signature components including r, s, v, and messageHash
 * @throws {Error} If topicId is invalid
 */
export async function signVoteMessage(wallet, topicId) {
    if (!topicId || typeof topicId !== 'string' || topicId.trim().length === 0) {
        throw new Error('Topic ID must be a non-empty string');
    }
    if (topicId.length > MAX_TOPIC_ID_LENGTH) {
        throw new Error(`Topic ID exceeds maximum length of ${MAX_TOPIC_ID_LENGTH} characters`);
    }
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
 * Extract signature components as field elements for circuit input
 * @param {Object} sig - Signature object with r, s, and v properties
 * @returns {Object} Object with r, s, and v as string values
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
 * Recover signer address from signature (for verification)
 * @param {string} topicId - Unique identifier for the voting topic
 * @param {string} signature - Signature to verify
 * @returns {string} Recovered Ethereum address
 * @throws {Error} If parameters are invalid or signature is malformed
 */
export function recoverSigner(topicId, signature) {
    if (!topicId || typeof topicId !== 'string') {
        throw new Error('Topic ID must be a non-empty string');
    }
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
