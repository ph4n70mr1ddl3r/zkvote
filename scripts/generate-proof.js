import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { signVoteMessage, signatureToFieldElements } from '../utils/eip712.js';
import { getMerkleProof } from '../utils/merkle-helper.js';
import { addressToFieldElement, computeNullifier } from '../utils/poseidon.js';
import { DEFAULT_TOPIC_ID, FILE_PATHS, MAX_VOTE_MESSAGE_LENGTH, MERKLE_PADDING_VALUE, TREE_DEPTH, PUBLIC_SIGNAL } from '../utils/constants.js';
import { readAndValidateJsonFile } from '../utils/json-helper.js';

/**
 * Generate a ZK proof for a vote
 * Usage: node scripts/generate-proof.js <voter-index> <vote-message> [--invalid]
 */

function validateVoteMessage(message) {
    if (typeof message !== 'string') {
        throw new Error('Vote message must be a string');
    }
    if (message.length === 0) {
        throw new Error('Vote message cannot be empty');
    }
    if (message.length > MAX_VOTE_MESSAGE_LENGTH) {
        throw new Error(`Vote message exceeds maximum length of ${MAX_VOTE_MESSAGE_LENGTH} characters`);
    }
}

function validateVoterIndex(index, maxIndex) {
    if (!Number.isInteger(index) || index < 0) {
        throw new Error(`Voter index must be a non-negative integer`);
    }
    if (index > maxIndex) {
        throw new Error(`Voter index ${index} exceeds available voters (${maxIndex})`);
    }
}

async function generateProof(voterIndex, voteMessage, useInvalid = false) {
    console.log('🔐 Generating ZK proof for vote...\n');

    try {
        validateVoteMessage(voteMessage);

        const votersPath = path.join(process.cwd(), useInvalid ? FILE_PATHS.data.invalidVoters : FILE_PATHS.data.validVoters);

        if (!fs.existsSync(votersPath)) {
            throw new Error(`Voters file not found: ${votersPath}`);
        }

        const voters = readAndValidateJsonFile(votersPath, {
            isArray: true
        });

        validateVoterIndex(voterIndex, voters.length - 1);

    const voter = voters[voterIndex];
    console.log(`📋 Voter: ${voter.address} (index ${voterIndex})`);
    console.log(`📝 Vote message: "${voteMessage}"\n`);

    const treePath = path.join(process.cwd(), FILE_PATHS.data.merkleTree);
    if (!fs.existsSync(treePath)) {
        throw new Error('Merkle tree not found. Run: npm run build-tree');
    }

    const treeData = readAndValidateJsonFile(treePath, {
        requiredFields: ['root', 'tree', 'leaves']
    });
    console.log(`🌳 Merkle root: ${treeData.root}`);

    const wallet = new ethers.Wallet(voter.privateKey);

    const topicId = DEFAULT_TOPIC_ID;

    // Sign the vote message using EIP-712
    console.log('✍️  Signing vote message...');
    const sig = await signVoteMessage(wallet, topicId);
    const sigFields = signatureToFieldElements(sig);

    console.log(`   Signature r: ${sigFields.r.substring(0, 20)}...`);
    console.log(`   Signature s: ${sigFields.s.substring(0, 20)}...`);
    console.log(`   Message hash: ${sig.messageHash}\n`);

    let merkleProof;
    if (useInvalid) {
        console.log('⚠️  Using invalid voter - proof will fail!');
        merkleProof = {
            siblings: Array(TREE_DEPTH).fill(MERKLE_PADDING_VALUE),
            pathIndices: Array(TREE_DEPTH).fill(0)
        };
    } else {
        merkleProof = getMerkleProof(treeData.tree, voterIndex);
        console.log('🔍 Generated Merkle proof');
    }

    // Prepare circuit inputs
    const voterAddressField = addressToFieldElement(voter.address);
    const topicIdHash = BigInt(ethers.id(topicId)).toString();
    const messageHashField = BigInt(sig.messageHash).toString();

    const input = {
        merkleRoot: treeData.root,
        topicId: topicIdHash,
        messageHash: messageHashField,
        voterAddress: voterAddressField,
        pathElements: merkleProof.siblings,
        pathIndices: merkleProof.pathIndices,
        sigR: sigFields.r,
        sigS: sigFields.s
    };

    const inputPath = path.join(process.cwd(), FILE_PATHS.build.proofInput);
    fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));
    console.log(`💾 Circuit input saved to: ${inputPath}\n`);

    console.log('⚙️  Generating ZK proof (this may take a moment)...');
    const wasmPath = path.join(process.cwd(), FILE_PATHS.build.wasm);
    const zkeyPath = path.join(process.cwd(), FILE_PATHS.build.zkey);

    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
        throw new Error('Circuit not compiled. Run: npm run compile-circuits');
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmPath,
        zkeyPath
    );

    console.log('✅ Proof generated successfully!\n');

    // Compute nullifier from signature
    const nullifier = await computeNullifier(sigFields.r, sigFields.s, topicIdHash);

    console.log('📊 Proof details:');
    console.log(`   Nullifier: ${publicSignals[PUBLIC_SIGNAL.NULLIFIER]}`);
    console.log(`   Merkle root: ${publicSignals[PUBLIC_SIGNAL.MERKLE_ROOT]}`);
    console.log(`   Topic ID: ${publicSignals[PUBLIC_SIGNAL.TOPIC_ID]}`);
    console.log(`   Message hash: ${publicSignals[PUBLIC_SIGNAL.MESSAGE_HASH]}`);
    console.log(`   Computed nullifier: ${nullifier}\n`);

    const proofData = {
        proof,
        publicSignals,
        metadata: {
            voterIndex: useInvalid ? null : voterIndex,
            voterAddress: voter.address,
            topicId,
            voteMessage,
            timestamp: new Date().toISOString(),
            isInvalidVoter: useInvalid,
            nullifier
        }
    };

        const proofPath = path.join(process.cwd(), FILE_PATHS.build.latestProof);
        fs.writeFileSync(proofPath, JSON.stringify(proofData, null, 2));

        console.log(`💾 Proof saved to: ${proofPath}`);

        return proofData;
    } catch (error) {
        console.error('❌ Error generating proof:', error.message);
        throw error;
    }
}

// CLI interface
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('Usage: node generate-proof.js <voter-index> <vote-message> [--invalid]');
    console.error('Example: node generate-proof.js 0 "Vote for Proposal A"');
    console.error('Example: node generate-proof.js --invalid 0 "Vote for Proposal B"');
    process.exit(1);
}

let voterIndex, voteMessage, useInvalid = false;

if (args[0] === '--invalid') {
    useInvalid = true;
    voterIndex = parseInt(args[1]);
    voteMessage = args.slice(2).join(' ');
} else {
    voterIndex = parseInt(args[0]);
    voteMessage = args.slice(1).join(' ');
}

generateProof(voterIndex, voteMessage, useInvalid)
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error generating proof:');
        console.error(error.message);
        process.exit(1);
    });
