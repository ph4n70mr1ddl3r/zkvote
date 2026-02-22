import { buildPoseidon } from 'circomlibjs';

let poseidonPromise = null;

export async function getPoseidon() {
    if (!poseidonPromise) {
        poseidonPromise = buildPoseidon();
    }
    return poseidonPromise;
}

export function resetPoseidonInstance() {
    poseidonPromise = null;
}

export async function poseidonHash(input) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon([input]));
    return hash;
}

export async function poseidonHash2(left, right) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon([left, right]));
    return hash;
}

export async function poseidonHashMany(inputs) {
    const poseidon = await getPoseidon();
    const hash = poseidon.F.toString(poseidon(inputs));
    return hash;
}

const BN254_FIELD_ORDER = BigInt(
    '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

const SECP256K1_N = BigInt(
    '115792089237316195423570985008687907852837564279074904382605163141518161494337'
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

export function validateEcdsaScalar(value, name) {
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
    return bigIntValue;
}

export function validateSignatureV(v) {
    const vNum = Number(v);
    if (vNum !== 27 && vNum !== 28) {
        throw new Error(`Invalid signature v value: must be 27 or 28, got ${v}`);
    }
    return vNum;
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
        const topicField = validateFieldElement(topicIdHash, 'Topic ID hash');
        const messageField = validateFieldElement(messageHash, 'Message hash');
        return poseidonHashMany([rField, sField, topicField, messageField]);
    } catch (error) {
        throw new Error(`Failed to compute nullifier: ${error.message}`);
    }
}

export { SECP256K1_N };
