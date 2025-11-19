import { poseidonHash2, addressToFieldElement } from './poseidon.js';

/**
 * Merkle tree helper functions for proof generation and verification
 */

const TREE_DEPTH = 7; // Support up to 128 leaves

/**
 * Build a Merkle tree from addresses
 */
export async function buildMerkleTree(addresses) {
    // Convert addresses to field elements
    const leaves = addresses.map(addr => addressToFieldElement(addr));

    // Pad to power of 2
    const paddedLeaves = [...leaves];
    const targetSize = 2 ** TREE_DEPTH;
    while (paddedLeaves.length < targetSize) {
        paddedLeaves.push('0');
    }

    // Build tree level by level
    const tree = [paddedLeaves];

    for (let level = 0; level < TREE_DEPTH; level++) {
        const currentLevel = tree[level];
        const nextLevel = [];

        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1];
            const parent = await poseidonHash2(left, right);
            nextLevel.push(parent);
        }

        tree.push(nextLevel);
    }

    return {
        root: tree[TREE_DEPTH][0],
        tree,
        leaves: paddedLeaves
    };
}

/**
 * Generate Merkle proof for a specific leaf index
 */
export function getMerkleProof(tree, leafIndex) {
    const siblings = [];
    const pathIndices = [];

    let index = leafIndex;

    for (let level = 0; level < TREE_DEPTH; level++) {
        const isRight = index % 2 === 1;
        const siblingIndex = isRight ? index - 1 : index + 1;

        siblings.push(tree[level][siblingIndex]);
        pathIndices.push(isRight ? 1 : 0);

        index = Math.floor(index / 2);
    }

    return {
        siblings,
        pathIndices
    };
}

/**
 * Verify a Merkle proof
 */
export async function verifyMerkleProof(leaf, proof, root) {
    let current = leaf;

    for (let i = 0; i < TREE_DEPTH; i++) {
        const sibling = proof.siblings[i];
        const isRight = proof.pathIndices[i] === 1;

        if (isRight) {
            current = await poseidonHash2(sibling, current);
        } else {
            current = await poseidonHash2(current, sibling);
        }
    }

    return current === root;
}

/**
 * Convert Merkle proof to circuit input format
 */
export function proofToCircuitInput(proof) {
    return {
        pathElements: proof.siblings,
        pathIndices: proof.pathIndices
    };
}

export { TREE_DEPTH };
