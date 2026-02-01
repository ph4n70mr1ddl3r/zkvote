import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { signVoteMessage, signatureToFieldElements } from '../utils/eip712.js';
import { getMerkleProof } from '../utils/merkle-helper.js';
import { addressToFieldElement, poseidonHashMany } from '../utils/poseidon.js';
import { FILE_PATHS, PUBLIC_SIGNAL, DISPLAY_WIDTH } from '../utils/constants.js';
import { readAndValidateJsonFile } from '../utils/json-helper.js';

async function testDoubleVoting() {
    console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
    console.log('TEST: Double Voting Prevention');
    console.log('='.repeat(DISPLAY_WIDTH.STANDARD) + '\n');

    try {
        const votersPath = path.join(process.cwd(), FILE_PATHS.data.validVoters);
        const voters = readAndValidateJsonFile(votersPath, {
            isArray: true
        });

        const treePath = path.join(process.cwd(), FILE_PATHS.data.merkleTree);
        const treeData = readAndValidateJsonFile(treePath, {
            requiredFields: ['root', 'tree', 'leaves']
        });

        const vkey = readAndValidateJsonFile(
            path.join(process.cwd(), FILE_PATHS.build.verificationKey),
            {
                requiredFields: ['vk_alpha_1', 'vk_beta_2', 'vk_gamma_2', 'vk_delta_2', 'IC']
            }
        );

        const voterIndex = 0;
        const voter = voters[voterIndex];
        const wallet = new ethers.Wallet(voter.privateKey);

        console.log(`Testing with voter: ${voter.address}\n`);

        // Simulate nullifier registry (tracks used nullifiers)
        const nullifierRegistry = new Set();

        const topicId = 'important-vote';
        const voteMessage1 = 'Vote for Option A';
        const voteMessage2 = 'Vote for Option B';

        // First vote
        console.log('📋 First Vote:');
        console.log(`   Message: "${voteMessage1}"`);
        console.log(`   Topic: ${topicId}`);
        console.log('   Generating proof...\n');

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
            sigS: sigFields1.s
        };

        const { proof: proof1, publicSignals: ps1 } = await snarkjs.groth16.fullProve(
            input1,
            path.join(process.cwd(), FILE_PATHS.build.wasm),
            path.join(process.cwd(), FILE_PATHS.build.zkey)
        );

        const isValid1 = await snarkjs.groth16.verify(vkey, ps1, proof1);

        if (!isValid1) {
            throw new Error('First proof verification failed!');
        }

        const nullifier1 = ps1[PUBLIC_SIGNAL.NULLIFIER];
        console.log(`   ✅ Proof verified`);
        console.log(`   Nullifier: ${nullifier1}`);

        // Check nullifier registry
        if (nullifierRegistry.has(nullifier1)) {
            throw new Error('Double vote detected on first vote (should not happen)');
        }

        nullifierRegistry.add(nullifier1);
        console.log(`   ✅ Nullifier registered\n`);

        // Second vote (attempt to vote again on same topic)
        console.log('📋 Second Vote (DOUBLE VOTE ATTEMPT):');
        console.log(`   Message: "${voteMessage2}" (different message)`);
        console.log(`   Topic: ${topicId} (SAME topic)`);
        console.log('   Generating proof...\n');

        const sig2 = await signVoteMessage(wallet, topicId);
        const sigFields2 = signatureToFieldElements(sig2);

        const input2 = {
            merkleRoot: treeData.root,
            topicId: BigInt(ethers.id(topicId)).toString(),
            messageHash: BigInt(sig2.messageHash).toString(),
            voterAddress: addressToFieldElement(voter.address),
            pathElements: merkleProof.siblings,
            pathIndices: merkleProof.pathIndices,
            sigR: sigFields2.r,
            sigS: sigFields2.s
        };

        const { proof: proof2, publicSignals: ps2 } = await snarkjs.groth16.fullProve(
            input2,
            path.join(process.cwd(), FILE_PATHS.build.wasm),
            path.join(process.cwd(), FILE_PATHS.build.zkey)
        );

        const isValid2 = await snarkjs.groth16.verify(vkey, ps2, proof2);

        if (!isValid2) {
            throw new Error('Second proof verification failed!');
        }

        const nullifier2 = ps2[0];
        console.log(`   ✅ Proof verified`);
        console.log(`   Nullifier: ${nullifier2}`);

        // Compare nullifiers
        console.log('\n📊 Nullifier Comparison:');
        console.log(`   First vote nullifier:  ${nullifier1}`);
        console.log(`   Second vote nullifier: ${nullifier2}`);
        console.log(`   Are they equal? ${nullifier1 === nullifier2 ? 'YES ✓' : 'NO ❌'}\n`);

        if (nullifier1 !== nullifier2) {
            throw new Error('Nullifiers should be identical for same voter + topic!');
        }

        // Check registry
        console.log('🔍 Checking nullifier registry...');
        if (nullifierRegistry.has(nullifier2)) {
            console.log('   ⚠️  DOUBLE VOTE DETECTED!');
            console.log('   This nullifier has already been used.');
            console.log('   ✅ Vote would be REJECTED by the system\n');
        } else {
            throw new Error('Registry should detect duplicate nullifier!');
        }

        console.log('✅ Double voting prevention test passed!');
        console.log('\nSummary:');
        console.log('  ✓ First vote generates valid proof and nullifier');
        console.log('  ✓ Second vote on same topic generates same nullifier');
        console.log('  ✓ Nullifier registry detects duplicate');
        console.log('  ✓ System prevents double voting');

        return true;
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run test
testDoubleVoting()
    .then((passed) => {
        console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
        process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    });
