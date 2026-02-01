import { buildPoseidon } from 'circomlibjs';

let poseidonInstance = null;

/**
 * Get or initialize the Poseidon hash function
 * Poseidon is a ZK-friendly hash function optimized for use in circuits
 */
export async function getPoseidon() {
    if (!poseidonInstance) {
        poseidonInstance = await buildPoseidon();
    }
    return poseidonInstance;
}

/**
 * Hash a single value using Poseidon
 */
export async function poseidonHash(input) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon([input]));
    return hash;
}

/**
 * Hash two values using Poseidon (used for Merkle tree)
 */
export async function poseidonHash2(left, right) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon([left, right]));
    return hash;
}

/**
 * Hash multiple values using Poseidon
 */
export async function poseidonHashMany(inputs) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon(inputs));
    return hash;
}

/**
 * Convert Ethereum address to field element
 */
export function addressToFieldElement(address) {
    if (typeof address !== 'string') {
        throw new Error('Address must be a string');
    }
    if (!address.startsWith('0x')) {
        throw new Error('Address must start with 0x prefix');
    }
    const addressBigInt = BigInt(address);
    return addressBigInt.toString();
}
