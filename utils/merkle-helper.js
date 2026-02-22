import { poseidonHash2, addressToFieldElement } from './poseidon.js';
import { TREE_DEPTH, MERKLE_PADDING_VALUE } from './constants.js';

/**
 * Merkle tree helper functions for proof generation and verification
 */

/**
 * Build a Merkle tree from addresses
 * @param {Array<string>} addresses - Array of Ethereum addresses
 * @returns {Promise<Object>} Merkle tree object with root, tree structure, and leaves
 * @throws {Error} If addresses array is empty or contains invalid addresses
 */
export async function buildMerkleTree(addresses) {
    if (!Array.isArray(addresses)) {
        throw new TypeError(`Addresses must be an array, received ${typeof addresses}`);
    }
    if (addresses.length === 0) {
        throw new Error('Cannot build Merkle tree from empty array');
    }
    if (addresses.length > 2 ** TREE_DEPTH) {
        throw new Error(
            `Too many addresses (${addresses.length}) for tree depth ${TREE_DEPTH}, maximum is ${2 ** TREE_DEPTH}`
        );
    }

    const normalizedAddresses = addresses.map(addr => addr.toLowerCase());
    const uniqueAddresses = new Set(normalizedAddresses);
    if (uniqueAddresses.size !== normalizedAddresses.length) {
        throw new Error('Duplicate addresses detected in voter list');
    }

    try {
        const leaves = addresses.map(addr => addressToFieldElement(addr));

        const paddedLeaves = [...leaves];
        const targetSize = 2 ** TREE_DEPTH;
        while (paddedLeaves.length < targetSize) {
            paddedLeaves.push(MERKLE_PADDING_VALUE);
        }

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
            leaves: paddedLeaves,
        };
    } catch (error) {
        throw new Error(`Failed to build Merkle tree: ${error.message}`);
    }
}

/**
 * Generate Merkle proof for a specific leaf index
 * @param {Array<Array<string>>} tree - Merkle tree structure
 * @param {number} leafIndex - Index of the leaf to generate proof for
 * @returns {Object} Merkle proof with siblings and path indices
 * @throws {Error} If tree structure is invalid or leafIndex is out of bounds
 */
export function getMerkleProof(tree, leafIndex) {
    if (!Array.isArray(tree) || tree.length === 0) {
        throw new Error('Invalid tree structure: must be a non-empty array');
    }
    if (!Number.isInteger(leafIndex) || leafIndex < 0) {
        throw new Error(`Invalid leaf index: ${leafIndex}`);
    }
    if (leafIndex >= tree[0].length) {
        throw new Error(`Leaf index ${leafIndex} out of bounds (0-${tree[0].length - 1})`);
    }

    const siblings = [];
    const pathIndices = [];

    let index = leafIndex;

    for (let level = 0; level < TREE_DEPTH; level++) {
        const isRight = index % 2 === 1;
        const siblingIndex = isRight ? index - 1 : index + 1;

        if (siblingIndex < 0 || siblingIndex >= tree[level].length) {
            throw new Error(`Invalid sibling index at level ${level}`);
        }

        siblings.push(tree[level][siblingIndex]);
        pathIndices.push(isRight ? 1 : 0);

        index = Math.floor(index / 2);
    }

    return {
        siblings,
        pathIndices,
    };
}

/**
 * Verify a Merkle proof
 * Recomputes the Merkle root from leaf and proof path, compares to expected root
 * @param {string} leaf - Leaf value to verify
 * @param {Object} proof - Merkle proof with siblings and pathIndices arrays
 * @param {string} root - Expected Merkle root
 * @returns {Promise<boolean>} True if proof is valid
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
 * @param {Object} proof - Merkle proof object with siblings and pathIndices
 * @returns {Object} Circuit input format with pathElements and pathIndices
 * @throws {Error} If proof structure is invalid
 */
export function proofToCircuitInput(proof) {
    if (!proof || typeof proof !== 'object') {
        throw new Error('Invalid proof: must be an object');
    }
    if (!Array.isArray(proof.siblings) || !Array.isArray(proof.pathIndices)) {
        throw new Error('Invalid proof: missing siblings or pathIndices arrays');
    }

    return {
        pathElements: proof.siblings,
        pathIndices: proof.pathIndices,
    };
}

export { TREE_DEPTH };
