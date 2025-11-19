import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { signVoteMessage, signatureToFieldElements } from '../utils/eip712.js';
import { getMerkleProof, proofToCircuitInput } from '../utils/merkle-helper.js';
import { addressToFieldElement, poseidonHashMany } from '../utils/poseidon.js';

/**
 * Generate a ZK proof for a vote
 * Usage: node scripts/generate-proof.js <voter-index> <vote-message> [--invalid]
 */

async function generateProof(voterIndex, voteMessage, useInvalid = false) {
    console.log('🔐 Generating ZK proof for vote...\n');

    // Load voters
    const voterType = useInvalid ? 'invalid-voters' : 'valid-voters';
    const votersPath = path.join(process.cwd(), 'data', `${voterType}.json`);

    if (!fs.existsSync(votersPath)) {
        throw new Error(`Voters file not found: ${votersPath}`);
    }

    const voters = JSON.parse(fs.readFileSync(votersPath, 'utf8'));

    if (voterIndex < 0 || voterIndex >= voters.length) {
        throw new Error(`Invalid voter index: ${voterIndex}`);
    }

    const voter = voters[voterIndex];
    console.log(`📋 Voter: ${voter.address} (index ${voterIndex})`);
    console.log(`📝 Vote message: "${voteMessage}"\n`);

    // Load Merkle tree
    const treePath = path.join(process.cwd(), 'data', 'merkle-tree.json');
    if (!fs.existsSync(treePath)) {
        throw new Error('Merkle tree not found. Run: npm run build-tree');
    }

    const treeData = JSON.parse(fs.readFileSync(treePath, 'utf8'));
    console.log(`🌳 Merkle root: ${treeData.root}`);

    // Create wallet from voter's private key
    const wallet = new ethers.Wallet(voter.privateKey);

    // Define topic ID (same topic for all votes in this demo)
    const topicId = 'vote-topic-2024';

    // Sign the vote message using EIP-712
    console.log('✍️  Signing vote message...');
    const sig = await signVoteMessage(wallet, topicId, voteMessage);
    const sigFields = signatureToFieldElements(sig);

    console.log(`   Signature r: ${sigFields.r.substring(0, 20)}...`);
    console.log(`   Signature s: ${sigFields.s.substring(0, 20)}...`);
    console.log(`   Message hash: ${sig.messageHash}\n`);

    // Generate Merkle proof
    let merkleProof;
    if (useInvalid) {
        console.log('⚠️  Using invalid voter - proof will fail!');
        // Use a fake proof (all zeros) for invalid voter
        merkleProof = {
            siblings: Array(7).fill('0'),
            pathIndices: Array(7).fill(0)
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

    // Save input for debugging
    const inputPath = path.join(process.cwd(), 'build', 'proof_input.json');
    fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));
    console.log(`💾 Circuit input saved to: ${inputPath}\n`);

    // Generate proof
    console.log('⚙️  Generating ZK proof (this may take a moment)...');
    const wasmPath = path.join(process.cwd(), 'build', 'vote_js', 'vote.wasm');
    const zkeyPath = path.join(process.cwd(), 'build', 'vote.zkey');

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

    // Save proof and public signals
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

    const proofPath = path.join(process.cwd(), 'build', 'latest_proof.json');
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
