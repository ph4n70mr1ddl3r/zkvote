import { buildPoseidon } from 'circomlibjs';

let poseidonInstance = null;

export async function getPoseidon() {
    if (!poseidonInstance) {
        poseidonInstance = await buildPoseidon();
    }
    return poseidonInstance;
}

export function resetPoseidonInstance() {
    poseidonInstance = null;
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
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error('Address must be a valid 20-byte Ethereum address');
    }
    const addressBigInt = BigInt(address);
    return addressBigInt.toString();
}
