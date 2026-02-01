import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { signVoteMessage, signatureToFieldElements } from '../utils/eip712.js';
import { getMerkleProof, proofToCircuitInput } from '../utils/merkle-helper.js';
import { addressToFieldElement, poseidonHashMany } from '../utils/poseidon.js';
import { DEFAULT_TOPIC_ID, FILE_PATHS, MAX_VOTE_MESSAGE_LENGTH, MERKLE_PADDING_VALUE, TREE_DEPTH } from '../utils/constants.js';

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

    validateVoteMessage(voteMessage);

    const voterType = useInvalid ? 'invalid-voters' : 'valid-voters';
    const votersPath = path.join(process.cwd(), FILE_PATHS.data[voterType === 'valid-voters' ? 'validVoters' : 'invalidVoters']);

    if (!fs.existsSync(votersPath)) {
        throw new Error(`Voters file not found: ${votersPath}`);
    }

    let voters;
    try {
        voters = JSON.parse(fs.readFileSync(votersPath, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to parse voters file: ${error.message}`);
    }

    validateVoterIndex(voterIndex, voters.length - 1);

    const voter = voters[voterIndex];
    console.log(`📋 Voter: ${voter.address} (index ${voterIndex})`);
    console.log(`📝 Vote message: "${voteMessage}"\n`);

    const treePath = path.join(process.cwd(), FILE_PATHS.data.merkleTree);
    if (!fs.existsSync(treePath)) {
        throw new Error('Merkle tree not found. Run: npm run build-tree');
    }

    let treeData;
    try {
        treeData = JSON.parse(fs.readFileSync(treePath, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to parse Merkle tree file: ${error.message}`);
    }
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
    const nullifierInputs = [
        BigInt(sigFields.r),
        BigInt(sigFields.s),
        BigInt(topicIdHash)
    ];
    const nullifier = await poseidonHashMany(nullifierInputs);

    console.log('📊 Proof details:');
    console.log(`   Nullifier: ${publicSignals[0]}`);
    console.log(`   Merkle root: ${publicSignals[1]}`);
    console.log(`   Topic ID: ${publicSignals[2]}`);
    console.log(`   Message hash: ${publicSignals[3]}`);
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
