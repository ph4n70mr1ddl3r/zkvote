import fs from 'fs';
import path from 'path';
import * as snarkjs from 'snarkjs';
import { FILE_PATHS, PUBLIC_SIGNAL, EXPECTED_PUBLIC_SIGNALS_COUNT } from '../utils/constants.js';
import { readAndValidateJsonFile } from '../utils/json-helper.js';

const MAX_PROOF_FILE_SIZE_BYTES = 10 * 1024 * 1024;
let cachedVkey = null;
let cachedVkeyMtime = null;

function validatePathSafety(proofPath) {
    if (typeof proofPath !== 'string' || proofPath.length === 0) {
        throw new Error('Invalid path: must be a non-empty string');
    }

    if (proofPath.length > 4096) {
        throw new Error('Path exceeds maximum length');
    }

    if (!/^[a-zA-Z0-9_\-/.]+$/.test(proofPath)) {
        throw new Error('Invalid path: contains forbidden characters');
    }

    const resolvedPath = path.resolve(proofPath);
    const cwd = process.cwd();

    if (!resolvedPath.startsWith(cwd)) {
        throw new Error('Path traversal detected: proof path must be within project directory');
    }

    let realPath;
    try {
        realPath = fs.realpathSync(resolvedPath);
    } catch (error) {
        throw new Error(`Cannot resolve real path: ${error.message}`);
    }
    if (!realPath.startsWith(cwd)) {
        throw new Error('Path traversal detected via symlink');
    }

    return realPath;
}

async function verifyProof(proofPath) {
    console.log('🔍 Verifying ZK proof...\n');

    if (!proofPath || typeof proofPath !== 'string') {
        throw new TypeError('Invalid proof path provided');
    }

    try {
        const resolvedPath = validatePathSafety(proofPath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Proof file not found: ${resolvedPath}`);
        }

        const stats = fs.statSync(resolvedPath);
        if (!stats.isFile()) {
            throw new Error(`Proof path is not a file: ${resolvedPath}`);
        }

        if (stats.size > MAX_PROOF_FILE_SIZE_BYTES) {
            throw new Error(
                `Proof file exceeds maximum size of ${MAX_PROOF_FILE_SIZE_BYTES / 1024 / 1024}MB`
            );
        }
        if (stats.size === 0) {
            throw new Error('Proof file is empty');
        }

        const proofData = readAndValidateJsonFile(resolvedPath, {
            requiredFields: ['proof', 'publicSignals', 'metadata'],
        });

        if (!proofData.proof || !proofData.publicSignals) {
            throw new Error('Invalid proof structure: missing proof or publicSignals');
        }

        if (!Array.isArray(proofData.publicSignals)) {
            throw new Error('Invalid proof structure: publicSignals must be an array');
        }
        if (proofData.publicSignals.length !== EXPECTED_PUBLIC_SIGNALS_COUNT) {
            throw new Error(
                `Invalid proof structure: expected ${EXPECTED_PUBLIC_SIGNALS_COUNT} public signals, got ${proofData.publicSignals.length}`
            );
        }

        console.log('📋 Proof metadata:');
        console.log(`   Voter: ${proofData.metadata.voterAddress}`);
        console.log(`   Topic: ${proofData.metadata.topicId}`);
        console.log(`   Message: "${proofData.metadata.voteMessage}"`);
        console.log(`   Timestamp: ${proofData.metadata.timestamp}`);
        console.log(`   Invalid voter: ${proofData.metadata.isInvalidVoter ? 'Yes ⚠️' : 'No'}\n`);

        const vkeyPath = path.join(process.cwd(), FILE_PATHS.build.verificationKey);

        if (!fs.existsSync(vkeyPath)) {
            throw new Error('Verification key not found. Run: npm run compile-circuits');
        }

        const currentMtime = fs.statSync(vkeyPath).mtime.getTime();

        if (!cachedVkey || cachedVkeyMtime !== currentMtime) {
            cachedVkey = readAndValidateJsonFile(vkeyPath, {
                requiredFields: ['vk_alpha_1', 'vk_beta_2', 'vk_gamma_2', 'vk_delta_2', 'IC'],
            });
            cachedVkeyMtime = currentMtime;
        }

        console.log('⚙️  Verifying proof...');

        const isValid = await snarkjs.groth16.verify(
            cachedVkey,
            proofData.publicSignals,
            proofData.proof
        );

        console.log('\n' + '='.repeat(60));

        if (isValid) {
            console.log('✅ PROOF IS VALID!');
            console.log('='.repeat(60));
            console.log('\n📊 Public signals:');
            console.log(`   Nullifier: ${proofData.publicSignals[PUBLIC_SIGNAL.NULLIFIER]}`);
            console.log(`   Merkle root: ${proofData.publicSignals[PUBLIC_SIGNAL.MERKLE_ROOT]}`);
            console.log(`   Topic ID: ${proofData.publicSignals[PUBLIC_SIGNAL.TOPIC_ID]}`);
            console.log(`   Message hash: ${proofData.publicSignals[PUBLIC_SIGNAL.MESSAGE_HASH]}`);
            console.log(`   Computed nullifier: ${proofData.metadata.nullifier}`);

            console.log('\n✨ This proves that:');
            console.log('   1. The voter is in the valid voter set (Merkle tree)');
            console.log('   2. The vote is for the specified topic');
            console.log('   3. The nullifier prevents double voting');
            console.log("   4. The voter's identity remains anonymous\n");

            if (proofData.metadata.isInvalidVoter) {
                console.log('⚠️  WARNING: This proof was generated with an invalid voter!');
                console.log('   This should not have succeeded. There may be an issue.');
            }
        } else {
            console.log('❌ PROOF IS INVALID!');
            console.log('='.repeat(60));
            console.log('\n⚠️  This proof does not verify. Possible reasons:');
            console.log('   1. Voter is not in the valid voter set');
            console.log('   2. Proof has been tampered with');
            console.log("   3. Public signals don't match the proof");
            console.log('   4. Wrong verification key\n');

            if (proofData.metadata.isInvalidVoter) {
                console.log('ℹ️  This is expected - proof was generated with an invalid voter.');
            }
        }

        console.log('='.repeat(60) + '\n');

        return isValid;
    } catch (error) {
        console.error('❌ Error verifying proof:', error.message);
        throw error;
    }
}

// CLI interface
const args = process.argv.slice(2);

const proofPath =
    args.length === 0 ? path.join(process.cwd(), FILE_PATHS.build.latestProof) : args[0].trim();

if (!proofPath || proofPath.length === 0) {
    console.error('Error: Proof path cannot be empty');
    process.exit(1);
}

verifyProof(proofPath)
    .then(isValid => {
        process.exit(isValid ? 0 : 1);
    })
    .catch(error => {
        console.error('\n❌ Error verifying proof:');
        console.error(error.message);
        process.exit(1);
    });
