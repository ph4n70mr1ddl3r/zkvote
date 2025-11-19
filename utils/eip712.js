import { ethers } from 'ethers';

/**
 * EIP-712 utilities for deterministic signature generation
 * This allows hardware wallets to sign without exposing private keys
 */

/**
 * Create EIP-712 domain for the voting system
 */
export function createDomain(topicId) {
    return {
        name: 'ZKVoting',
        version: '1',
        chainId: 1, // Ethereum mainnet
        verifyingContract: '0x0000000000000000000000000000000000000000', // Placeholder
        salt: ethers.id(topicId) // Topic-specific salt
    };
}

/**
 * Create EIP-712 types for vote message
 */
export const voteTypes = {
    Vote: [
        { name: 'topic', type: 'string' }
    ]
};

/**
 * Create vote message structure
 */
export function createVoteMessage(topicId, voteMessage, timestamp = null) {
    return {
        topic: topicId
    };
}

/**
 * Sign a vote message using EIP-712
 * Returns deterministic signature components
 */
export async function signVoteMessage(wallet, topicId, voteMessage) {
    const domain = createDomain(topicId);
    const message = createVoteMessage(topicId, voteMessage);

    // Sign using EIP-712
    const signature = await wallet.signTypedData(domain, voteTypes, message);

    // Split signature into r, s, v components
    const sig = ethers.Signature.from(signature);

    return {
        signature,
        r: sig.r,
        s: sig.s,
        v: sig.v,
        messageHash: ethers.TypedDataEncoder.hash(domain, voteTypes, message)
    };
}

/**
 * Extract signature components as field elements for circuit input
 */
export function signatureToFieldElements(sig) {
    return {
        r: BigInt(sig.r).toString(),
        s: BigInt(sig.s).toString(),
        v: sig.v.toString()
    };
}

/**
 * Recover signer address from signature (for verification)
 */
export function recoverSigner(topicId, voteMessage, signature) {
    const domain = createDomain(topicId);
    const message = createVoteMessage(topicId, voteMessage);

    return ethers.verifyTypedData(domain, voteTypes, message, signature);
}
