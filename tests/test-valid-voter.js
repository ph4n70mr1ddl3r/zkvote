import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { signVoteMessage, signatureToFieldElements } from '../utils/eip712.js';
import { getMerkleProof } from '../utils/merkle-helper.js';
import { addressToFieldElement, poseidonHashMany } from '../utils/poseidon.js';
import { FILE_PATHS } from '../utils/constants.js';

async function testValidVoter() {
    console.log('\n' + '='.repeat(70));
    console.log('TEST: Valid Voter Proof Generation and Verification');
    console.log('='.repeat(70) + '\n');

    try {
        const votersPath = path.join(process.cwd(), FILE_PATHS.data.validVoters);
        let voters;
        try {
            voters = JSON.parse(fs.readFileSync(votersPath, 'utf8'));
        } catch (error) {
            throw new Error(`Failed to parse voters file: ${error.message}`);
        }

        const treePath = path.join(process.cwd(), FILE_PATHS.data.merkleTree);
        let treeData;
        try {
            treeData = JSON.parse(fs.readFileSync(treePath, 'utf8'));
        } catch (error) {
            throw new Error(`Failed to parse Merkle tree file: ${error.message}`);
        }

        // Test with first voter
        const voterIndex = 0;
        const voter = voters[voterIndex];
        const wallet = new ethers.Wallet(voter.privateKey);

        console.log(`✓ Testing with voter ${voterIndex}: ${voter.address}`);

        // Generate first proof
        const topicId = 'test-topic';
        const voteMessage = 'Vote for Proposal A';

        console.log(`✓ Vote message: "${voteMessage}"`);
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
            sigS: sigFields1.s
        };

        const { proof: proof1, publicSignals: ps1 } = await snarkjs.groth16.fullProve(
            input1,
            path.join(process.cwd(), FILE_PATHS.build.wasm),
            path.join(process.cwd(), FILE_PATHS.build.zkey)
        );

        console.log('✓ First proof generated');

        const vkey = JSON.parse(fs.readFileSync(
            path.join(process.cwd(), FILE_PATHS.build.verificationKey),
            'utf8'
        ));

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
        const nullifier1 = await poseidonHashMany([
            BigInt(sigFields1.r),
            BigInt(sigFields1.s),
            BigInt(ethers.id(topicId))
        ]);

        const nullifier2 = await poseidonHashMany([
            BigInt(sigFields2.r),
            BigInt(sigFields2.s),
            BigInt(ethers.id(topicId))
        ]);

        console.log(`   Nullifier 1: ${nullifier1}`);
        console.log(`   Nullifier 2: ${nullifier2}`);

        if (nullifier1 !== nullifier2) {
            throw new Error('Nullifiers should be identical for same voter + topic!');
        }

        console.log('✓ Nullifiers are deterministic (identical)\n');

        // Test Merkle root validation
        console.log('⚙️  Validating Merkle root in proof...');
        console.log(`   Expected root: ${treeData.root}`);
        console.log(`   Proof root:    ${ps1[1]}`);

        if (ps1[1] !== treeData.root) {
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
    .then((passed) => {
        console.log('\n' + '='.repeat(70));
        process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    });
