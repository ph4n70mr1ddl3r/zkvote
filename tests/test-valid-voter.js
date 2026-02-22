import path from 'path';
import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { signVoteMessage, signatureToFieldElements } from '../utils/eip712.js';
import { getMerkleProof } from '../utils/merkle-helper.js';
import { addressToFieldElement, computeNullifier } from '../utils/poseidon.js';
import { FILE_PATHS, PUBLIC_SIGNAL, DISPLAY_WIDTH } from '../utils/constants.js';
import { readAndValidateJsonFile } from '../utils/json-helper.js';

async function testValidVoter() {
    console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
    console.log('TEST: Valid Voter Proof Generation and Verification');
    console.log('='.repeat(DISPLAY_WIDTH.STANDARD) + '\n');

    try {
        const votersPath = path.join(process.cwd(), FILE_PATHS.data.validVoters);
        const voters = readAndValidateJsonFile(votersPath, {
            isArray: true,
        });

        const treePath = path.join(process.cwd(), FILE_PATHS.data.merkleTree);
        const treeData = readAndValidateJsonFile(treePath, {
            requiredFields: ['root', 'tree', 'leaves'],
        });

        const voterIndex = 0;
        const voter = voters[voterIndex];
        const wallet = new ethers.Wallet(voter.privateKey);

        console.log(`✓ Testing with voter ${voterIndex}: ${voter.address}`);

        const topicId = 'test-topic';

        console.log(`✓ Topic: ${topicId}\n`);

        console.log('⚙️  Generating first proof...');
        const sig1 = await signVoteMessage(wallet, topicId);
        const sigFields1 = signatureToFieldElements(sig1);

        const merkleProof = getMerkleProof(treeData.tree, voterIndex);

        const input1 = {
            merkleRoot: treeData.root,
            topicId: BigInt(ethers.id(topicId)).toString(),
            messageHash: BigInt(sig1.messageHash).toString(),
            voterAddress: addressToFieldElement(voter.address),
            pathElements: merkleProof.siblings,
            pathIndices: merkleProof.pathIndices,
            sigR: sigFields1.r,
            sigS: sigFields1.s,
            sigV: sigFields1.v,
        };

        const { proof: proof1, publicSignals: ps1 } = await snarkjs.groth16.fullProve(
            input1,
            path.join(process.cwd(), FILE_PATHS.build.wasm),
            path.join(process.cwd(), FILE_PATHS.build.zkey)
        );

        if (!proof1 || typeof proof1 !== 'object') {
            throw new Error('Invalid proof generated: proof is missing or not an object');
        }
        if (!ps1 || !Array.isArray(ps1)) {
            throw new Error('Invalid proof generated: publicSignals is missing or not an array');
        }

        console.log('✓ First proof generated');

        const vkey = readAndValidateJsonFile(
            path.join(process.cwd(), FILE_PATHS.build.verificationKey),
            {
                requiredFields: ['vk_alpha_1', 'vk_beta_2', 'vk_gamma_2', 'vk_delta_2', 'IC'],
            }
        );

        const isValid1 = await snarkjs.groth16.verify(vkey, ps1, proof1);

        if (!isValid1) {
            throw new Error('First proof verification failed!');
        }

        console.log('✓ First proof verified successfully\n');

        // Test nullifier determinism
        console.log('⚙️  Testing nullifier determinism...');
        console.log('   Generating second proof with same parameters...');

        const sig2 = await signVoteMessage(wallet, topicId);
        const sigFields2 = signatureToFieldElements(sig2);

        // Compute nullifiers
        const nullifier1 = await computeNullifier(
            sigFields1.r,
            sigFields1.s,
            ethers.id(topicId),
            sig1.messageHash
        );

        const nullifier2 = await computeNullifier(
            sigFields2.r,
            sigFields2.s,
            ethers.id(topicId),
            sig2.messageHash
        );

        console.log(`   Nullifier 1: ${nullifier1}`);
        console.log(`   Nullifier 2: ${nullifier2}`);

        if (nullifier1 !== nullifier2) {
            throw new Error('Nullifiers should be identical for same voter + topic!');
        }

        console.log('✓ Nullifiers are deterministic (identical)\n');

        // Test Merkle root validation
        console.log('⚙️  Validating Merkle root in proof...');
        console.log(`   Expected root: ${treeData.root}`);
        console.log(`   Proof root:    ${ps1[PUBLIC_SIGNAL.MERKLE_ROOT]}`);

        if (ps1[PUBLIC_SIGNAL.MERKLE_ROOT] !== treeData.root) {
            throw new Error('Merkle root mismatch!');
        }

        console.log('✓ Merkle root matches\n');

        console.log('✅ All tests passed!');
        console.log('\nSummary:');
        console.log('  ✓ Valid voter can generate proofs');
        console.log('  ✓ Proofs verify correctly');
        console.log('  ✓ Nullifiers are deterministic');
        console.log('  ✓ Merkle root validation works');

        return true;
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        return false;
    }
}

// Run test
testValidVoter()
    .then(passed => {
        console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
        process.exit(passed ? 0 : 1);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    });
