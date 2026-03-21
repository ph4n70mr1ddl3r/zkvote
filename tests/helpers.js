import path from 'path';
import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { signVoteMessage, signatureToFieldElements, validateTopicId } from '../utils/eip712.js';
import { getMerkleProof } from '../utils/merkle-helper.js';
import { addressToFieldElement } from '../utils/poseidon.js';
import { generateProofWithTimeout } from '../utils/proof-helper.js';
import { FILE_PATHS, MERKLE_PADDING_VALUE, TREE_DEPTH } from '../utils/constants.js';
import { readAndValidateJsonFile } from '../utils/json-helper.js';

export function loadTestFixtures() {
    const votersPath = path.join(process.cwd(), FILE_PATHS.data.validVoters);
    const voters = readAndValidateJsonFile(votersPath, { isArray: true });

    const invalidVotersPath = path.join(process.cwd(), FILE_PATHS.data.invalidVoters);
    const invalidVoters = readAndValidateJsonFile(invalidVotersPath, { isArray: true });

    const treePath = path.join(process.cwd(), FILE_PATHS.data.merkleTree);
    const treeData = readAndValidateJsonFile(treePath, {
        requiredFields: ['root', 'tree', 'leaves'],
    });

    const vkeyPath = path.join(process.cwd(), FILE_PATHS.build.verificationKey);
    const vkey = readAndValidateJsonFile(vkeyPath, {
        requiredFields: ['vk_alpha_1', 'vk_beta_2', 'vk_gamma_2', 'vk_delta_2', 'IC'],
    });

    return { voters, invalidVoters, treeData, vkey };
}

export function getWallet(voters, index) {
    if (!Array.isArray(voters) || voters.length === 0) {
        throw new Error('Voters array must be non-empty');
    }
    if (!Number.isInteger(index) || index < 0) {
        throw new Error(`Voter index must be a non-negative integer, got ${index}`);
    }
    if (index >= voters.length) {
        throw new Error(`Voter index ${index} out of bounds (0-${voters.length - 1})`);
    }
    return new ethers.Wallet(voters[index].privateKey);
}

export function createFakeMerkleProof() {
    return {
        siblings: Array(TREE_DEPTH).fill(MERKLE_PADDING_VALUE),
        pathIndices: Array(TREE_DEPTH).fill(0),
    };
}

export function validateCircuitInput(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('Circuit input must be a non-null object');
    }

    const requiredFields = [
        'merkleRoot',
        'topicId',
        'messageHash',
        'voterAddress',
        'pathElements',
        'pathIndices',
        'sigR',
        'sigS',
    ];

    for (const field of requiredFields) {
        if (!(field in input)) {
            throw new Error(`Missing required circuit input field: ${field}`);
        }
    }

    if (!Array.isArray(input.pathElements) || input.pathElements.length !== TREE_DEPTH) {
        throw new Error(`pathElements must be an array of length ${TREE_DEPTH}`);
    }

    if (!Array.isArray(input.pathIndices) || input.pathIndices.length !== TREE_DEPTH) {
        throw new Error(`pathIndices must be an array of length ${TREE_DEPTH}`);
    }

    for (let i = 0; i < TREE_DEPTH; i++) {
        if (typeof input.pathElements[i] !== 'string') {
            throw new Error(`pathElements[${i}] must be a string`);
        }
        if (input.pathIndices[i] !== 0 && input.pathIndices[i] !== 1) {
            throw new Error(`pathIndices[${i}] must be 0 or 1`);
        }
    }

    for (const field of ['merkleRoot', 'topicId', 'messageHash', 'voterAddress', 'sigR', 'sigS']) {
        if (typeof input[field] !== 'string') {
            throw new Error(`${field} must be a string`);
        }
        try {
            BigInt(input[field]);
        } catch {
            throw new Error(`${field} must be a valid numeric string`);
        }
    }
}

export async function buildCircuitInput(
    wallet,
    voterIndex,
    topicId,
    treeData,
    useFakeProof = false
) {
    if (!treeData || typeof treeData !== 'object') {
        throw new Error('Invalid treeData: must be an object');
    }
    if (!treeData.root || !treeData.tree || !treeData.leaves) {
        throw new Error('Invalid treeData: missing required properties (root, tree, leaves)');
    }
    if (!wallet || typeof wallet.address !== 'string') {
        throw new Error('Invalid wallet: must have address property');
    }

    validateTopicId(topicId);

    const sig = await signVoteMessage(wallet, topicId);
    const sigFields = signatureToFieldElements(sig);

    const merkleProof = useFakeProof
        ? createFakeMerkleProof()
        : getMerkleProof(treeData.tree, voterIndex);

    const voterAddress = wallet.address;

    return {
        input: {
            merkleRoot: treeData.root,
            topicId: BigInt(ethers.id(topicId)).toString(),
            messageHash: BigInt(sig.messageHash).toString(),
            voterAddress: addressToFieldElement(voterAddress),
            pathElements: merkleProof.siblings,
            pathIndices: merkleProof.pathIndices,
            sigR: sigFields.r,
            sigS: sigFields.s,
        },
        sigFields,
        messageHash: sig.messageHash,
    };
}

export async function generateAndVerifyProof(input, vkey) {
    validateCircuitInput(input);

    const wasmPath = path.join(process.cwd(), FILE_PATHS.build.wasm);
    const zkeyPath = path.join(process.cwd(), FILE_PATHS.build.zkey);

    const { proof, publicSignals } = await generateProofWithTimeout(input, wasmPath, zkeyPath);

    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    return { proof, publicSignals, isValid };
}
