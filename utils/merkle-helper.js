import { poseidonHash2, addressToFieldElement } from './poseidon.js';
import { TREE_DEPTH, MERKLE_PADDING_VALUE, ETHEREUM_ADDRESS_REGEX } from './constants.js';

/**
 * Merkle tree helper functions for proof generation and verification.
 * Uses Poseidon hash for SNARK-friendly Merkle tree construction.
 */

/**
 * Build a Merkle tree from a list of Ethereum addresses.
 * The tree uses Poseidon hash for SNARK compatibility.
 * @param {Array<string>} addresses - Array of Ethereum addresses (0x-prefixed)
 * @returns {Promise<Object>} Merkle tree object containing:
 *   - root: Merkle root as decimal string
 *   - tree: Array of arrays representing tree levels (bottom to top)
 *   - leaves: Padded leaf array with field element representations
 * @throws {TypeError} If addresses is not an array
 * @throws {Error} If addresses array is empty, contains invalid addresses, or has duplicates
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

    const normalizedAddresses = addresses.map(addr => {
        if (typeof addr !== 'string') {
            throw new TypeError(`Address must be a string, received ${typeof addr}`);
        }
        if (!ETHEREUM_ADDRESS_REGEX.test(addr)) {
            throw new Error(`Invalid Ethereum address format: ${addr}`);
        }
        return addr.toLowerCase();
    });
    const uniqueAddresses = new Set(normalizedAddresses);
    if (uniqueAddresses.size !== normalizedAddresses.length) {
        throw new Error('Duplicate addresses detected in voter list');
    }

    try {
        const leaves = normalizedAddresses.map(addr => addressToFieldElement(addr));

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
 * Generate a Merkle proof for a specific leaf index.
 * The proof consists of sibling nodes and path indices at each level.
 * @param {Array<Array<string>>} tree - Merkle tree structure from buildMerkleTree
 * @param {number} leafIndex - Index of the leaf to generate proof for (0-based)
 * @returns {Object} Merkle proof containing:
 *   - siblings: Array of sibling node values at each level
 *   - pathIndices: Array of 0 (left) or 1 (right) indicating position
 * @throws {Error} If tree structure is invalid or leafIndex is out of bounds
 */
export function getMerkleProof(tree, leafIndex) {
    if (!Array.isArray(tree) || tree.length === 0) {
        throw new Error('Invalid tree structure: must be a non-empty array');
    }
    if (!Array.isArray(tree[0]) || tree[0].length === 0) {
        throw new Error('Invalid tree structure: first level (leaves) must be a non-empty array');
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
 * Verify a Merkle proof by recomputing the root from leaf and proof.
 * Uses Poseidon hash to match the tree construction.
 * @param {string} leaf - Leaf value as decimal string
 * @param {Object} proof - Merkle proof object with siblings and pathIndices arrays
 * @param {string} root - Expected Merkle root as decimal string
 * @returns {Promise<boolean>} True if proof is valid (recomputed root matches expected)
 */
export async function verifyMerkleProof(leaf, proof, root) {
    if (!proof || typeof proof !== 'object') {
        throw new Error('Proof must be a non-null object');
    }
    if (!Array.isArray(proof.siblings) || !Array.isArray(proof.pathIndices)) {
        throw new Error('Proof must contain siblings and pathIndices arrays');
    }
    if (proof.siblings.length !== TREE_DEPTH) {
        throw new Error(
            `Proof siblings length (${proof.siblings.length}) must match TREE_DEPTH (${TREE_DEPTH})`
        );
    }
    if (proof.pathIndices.length !== TREE_DEPTH) {
        throw new Error(
            `Proof pathIndices length (${proof.pathIndices.length}) must match TREE_DEPTH (${TREE_DEPTH})`
        );
    }

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
 * Convert Merkle proof to circuit input format.
 * Renames siblings to pathElements for circuit compatibility.
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

/**
 * Get the leaf index for an address in the tree.
 * Useful for looking up a voter's position in the Merkle tree.
 * @param {Array<string>} leaves - Array of leaf values from tree
 * @param {string} address - Ethereum address to find
 * @returns {number} Index of the address in the leaves array, or -1 if not found
 */
export function getLeafIndex(leaves, address) {
    if (!Array.isArray(leaves)) {
        throw new Error('Leaves must be an array');
    }
    const addressField = addressToFieldElement(address);
    return leaves.findIndex(leaf => leaf === addressField);
}

/**
 * Check if an address is in the Merkle tree.
 * @param {Array<string>} leaves - Array of leaf values from tree
 * @param {string} address - Ethereum address to check
 * @returns {boolean} True if address is in the tree
 */
export function isAddressInTree(leaves, address) {
    return getLeafIndex(leaves, address) !== -1;
}

export { TREE_DEPTH };
