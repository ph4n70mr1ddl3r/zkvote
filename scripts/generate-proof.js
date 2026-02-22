import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { signVoteMessage, signatureToFieldElements } from '../utils/eip712.js';
import { getMerkleProof } from '../utils/merkle-helper.js';
import {
    addressToFieldElement,
    computeNullifier,
    validateEcdsaScalar,
    validateSignatureV,
} from '../utils/poseidon.js';
import {
    ALLOWED_VOTE_MESSAGE_PATTERN,
    DEFAULT_TOPIC_ID,
    FILE_PATHS,
    MAX_VOTE_MESSAGE_LENGTH,
    MAX_TOPIC_ID_LENGTH,
    TOPIC_ID_PATTERN,
    MERKLE_PADDING_VALUE,
    TREE_DEPTH,
    PUBLIC_SIGNAL,
} from '../utils/constants.js';
import { readAndValidateJsonFile } from '../utils/json-helper.js';

/**
 * Generate a ZK proof for a vote
 * Usage: node scripts/generate-proof.js <voter-index> <vote-message> [--invalid]
 */

function validateVoteMessage(message) {
    if (typeof message !== 'string') {
        throw new TypeError(`Vote message must be a string, received ${typeof message}`);
    }
    if (message.length === 0) {
        throw new Error('Vote message cannot be empty');
    }
    if (message.length > MAX_VOTE_MESSAGE_LENGTH) {
        throw new Error(
            `Vote message exceeds maximum length of ${MAX_VOTE_MESSAGE_LENGTH} characters (received ${message.length})`
        );
    }
    if (!ALLOWED_VOTE_MESSAGE_PATTERN.test(message)) {
        throw new Error(
            'Vote message contains invalid characters (ASCII printable characters only)'
        );
    }
}

function validateTopicId(topicId) {
    if (typeof topicId !== 'string') {
        throw new TypeError(`Topic ID must be a string, received ${typeof topicId}`);
    }
    if (topicId.length === 0) {
        throw new Error('Topic ID cannot be empty');
    }
    if (topicId.length > MAX_TOPIC_ID_LENGTH) {
        throw new Error(
            `Topic ID exceeds maximum length of ${MAX_TOPIC_ID_LENGTH} characters (received ${topicId.length})`
        );
    }
    if (!TOPIC_ID_PATTERN.test(topicId)) {
        throw new Error(
            'Topic ID contains invalid characters (alphanumeric, underscore, dash only)'
        );
    }
}

function validateVoterIndex(index, maxIndex) {
    if (!Number.isInteger(index)) {
        throw new TypeError(`Voter index must be an integer, got ${typeof index}`);
    }
    if (index < 0) {
        throw new Error(`Voter index must be non-negative, got ${index}`);
    }
    if (index > maxIndex) {
        throw new Error(`Voter index ${index} exceeds available voters (0-${maxIndex})`);
    }
}

async function generateProof(
    voterIndex,
    voteMessage,
    useInvalid = false,
    topicId = DEFAULT_TOPIC_ID,
    verbose = true
) {
    console.log('🔐 Generating ZK proof for vote...\n');

    const PROOF_GENERATION_TIMEOUT_MS = 120000;

    try {
        validateVoteMessage(voteMessage);
        validateTopicId(topicId);

        const votersPath = path.join(
            process.cwd(),
            useInvalid ? FILE_PATHS.data.invalidVoters : FILE_PATHS.data.validVoters
        );

        if (!fs.existsSync(votersPath)) {
            throw new Error(`Voters file not found: ${votersPath}`);
        }

        const voters = readAndValidateJsonFile(votersPath, {
            isArray: true,
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
            requiredFields: ['root', 'tree', 'leaves'],
        });
        console.log(`🌳 Merkle root: ${treeData.root}`);

        const wallet = new ethers.Wallet(voter.privateKey);

        console.log('✍️  Signing vote message...');
        const sig = await signVoteMessage(wallet, topicId);
        const sigFields = signatureToFieldElements(sig);

        if (verbose) {
            console.log(`   Signature r: ${sigFields.r.substring(0, 20)}...`);
            console.log(`   Signature s: ${sigFields.s.substring(0, 20)}...`);
            console.log(`   Message hash: ${sig.messageHash}\n`);
        } else {
            console.log('   Signature generated.\n');
        }

        let merkleProof;
        if (useInvalid) {
            console.log('⚠️  Using invalid voter - proof will fail!');
            merkleProof = {
                siblings: Array(TREE_DEPTH).fill(MERKLE_PADDING_VALUE),
                pathIndices: Array(TREE_DEPTH).fill(0),
            };
        } else {
            merkleProof = getMerkleProof(treeData.tree, voterIndex);
            console.log('🔍 Generated Merkle proof');
        }

        const voterAddressField = addressToFieldElement(voter.address);

        const topicIdHash = BigInt(ethers.id(topicId));
        const messageHashField =
            typeof sig.messageHash === 'bigint'
                ? sig.messageHash.toString()
                : BigInt(sig.messageHash).toString();

        validateEcdsaScalar(sigFields.r, 'Signature r');
        validateEcdsaScalar(sigFields.s, 'Signature s');
        validateSignatureV(sigFields.v);

        if (merkleProof.siblings.length !== TREE_DEPTH) {
            throw new Error(
                `Invalid Merkle proof: siblings has ${merkleProof.siblings.length} elements, expected ${TREE_DEPTH}`
            );
        }
        if (merkleProof.pathIndices.length !== TREE_DEPTH) {
            throw new Error(
                `Invalid Merkle proof: pathIndices has ${merkleProof.pathIndices.length} elements, expected ${TREE_DEPTH}`
            );
        }

        const input = {
            merkleRoot: treeData.root,
            topicId: topicIdHash,
            messageHash: messageHashField,
            voterAddress: voterAddressField,
            pathElements: merkleProof.siblings,
            pathIndices: merkleProof.pathIndices,
            sigR: sigFields.r,
            sigS: sigFields.s,
            sigV: sigFields.v,
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

        const proofPromise = snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
                () =>
                    reject(
                        new Error(
                            `Proof generation timed out after ${PROOF_GENERATION_TIMEOUT_MS / 1000}s`
                        )
                    ),
                PROOF_GENERATION_TIMEOUT_MS
            );
        });

        const { proof, publicSignals } = await Promise.race([proofPromise, timeoutPromise]);

        if (!proof || typeof proof !== 'object') {
            throw new Error('Invalid proof generated: proof is missing or not an object');
        }
        if (!publicSignals || !Array.isArray(publicSignals)) {
            throw new Error('Invalid proof generated: publicSignals is missing or not an array');
        }

        console.log('✅ Proof generated successfully!\n');

        const nullifier = await computeNullifier(
            sigFields.r,
            sigFields.s,
            topicIdHash,
            messageHashField
        );

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
                nullifier,
            },
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
    console.error(
        'Usage: node generate-proof.js <voter-index> <vote-message> [--invalid] [--topic <id>] [--quiet]'
    );
    console.error('Example: node generate-proof.js 0 "Vote for Proposal A"');
    console.error('Example: node generate-proof.js --invalid 0 "Vote for Proposal B"');
    console.error(
        'Example: node generate-proof.js 0 "Vote for Proposal A" --topic custom-topic-2024'
    );
    process.exit(1);
}

let voterIndex;
let voteMessage;
let useInvalid = false;
let topicId = DEFAULT_TOPIC_ID;
let verbose = true;

const parsedArgs = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--invalid') {
        useInvalid = true;
    } else if (args[i] === '--topic' && i + 1 < args.length) {
        topicId = args[++i];
    } else if (args[i] === '--quiet') {
        verbose = false;
    } else {
        parsedArgs.push(args[i]);
    }
}

if (parsedArgs.length >= 2) {
    voterIndex = parseInt(parsedArgs[0], 10);
    voteMessage = parsedArgs.slice(1).join(' ').trim();
} else if (parsedArgs.length === 1 && useInvalid) {
    voterIndex = parseInt(parsedArgs[0], 10);
    voteMessage = parsedArgs.slice(1).join(' ').trim();
} else {
    voterIndex = parseInt(args[0], 10);
    voteMessage = args.slice(1).join(' ').trim();
}

if (!Number.isInteger(voterIndex) || voterIndex < 0) {
    console.error('Error: Voter index must be a valid non-negative integer');
    process.exit(1);
}

if (!voteMessage || voteMessage.length === 0) {
    console.error('Error: Vote message cannot be empty');
    process.exit(1);
}

generateProof(voterIndex, voteMessage, useInvalid, topicId, verbose)
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Error generating proof:');
        console.error(error.message);
        process.exit(1);
    });
