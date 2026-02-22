import path from 'path';
import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { signVoteMessage, signatureToFieldElements } from '../utils/eip712.js';
import { getMerkleProof } from '../utils/merkle-helper.js';
import { addressToFieldElement } from '../utils/poseidon.js';
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
    return new ethers.Wallet(voters[index].privateKey);
}

export function createFakeMerkleProof() {
    return {
        siblings: Array(TREE_DEPTH).fill(MERKLE_PADDING_VALUE),
        pathIndices: Array(TREE_DEPTH).fill(0),
    };
}

export async function buildCircuitInput(
    wallet,
    voterIndex,
    topicId,
    treeData,
    useFakeProof = false
) {
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
            sigV: sigFields.v,
        },
        sigFields,
        messageHash: sig.messageHash,
    };
}

export async function generateAndVerifyProof(input, vkey) {
    const wasmPath = path.join(process.cwd(), FILE_PATHS.build.wasm);
    const zkeyPath = path.join(process.cwd(), FILE_PATHS.build.zkey);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

    if (!proof || typeof proof !== 'object') {
        throw new Error('Invalid proof generated: proof is missing or not an object');
    }
    if (!publicSignals || !Array.isArray(publicSignals)) {
        throw new Error('Invalid proof generated: publicSignals is missing or not an array');
    }

    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    return { proof, publicSignals, isValid };
}

export function validateProofStructure(proof, publicSignals) {
    if (!proof || typeof proof !== 'object') {
        throw new Error('Invalid proof generated: proof is missing or not an object');
    }
    if (!publicSignals || !Array.isArray(publicSignals)) {
        throw new Error('Invalid proof generated: publicSignals is missing or not an array');
    }
}
