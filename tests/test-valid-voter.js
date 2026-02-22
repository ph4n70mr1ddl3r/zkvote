import { ethers } from 'ethers';
import { computeNullifier } from '../utils/poseidon.js';
import { PUBLIC_SIGNAL, DISPLAY_WIDTH } from '../utils/constants.js';
import {
    loadTestFixtures,
    getWallet,
    buildCircuitInput,
    generateAndVerifyProof,
} from './helpers.js';

async function testValidVoter() {
    console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
    console.log('TEST: Valid Voter Proof Generation and Verification');
    console.log('='.repeat(DISPLAY_WIDTH.STANDARD) + '\n');

    try {
        const { voters, treeData, vkey } = loadTestFixtures();

        const voterIndex = 0;
        const wallet = getWallet(voters, voterIndex);

        console.log(`✓ Testing with voter ${voterIndex}: ${voters[voterIndex].address}`);

        const topicId = 'test-topic';

        console.log(`✓ Topic: ${topicId}\n`);

        console.log('⚙️  Generating first proof...');
        const {
            input: input1,
            sigFields: sigFields1,
            messageHash: msgHash1,
        } = await buildCircuitInput(wallet, voterIndex, topicId, treeData);

        const { publicSignals: ps1, isValid: isValid1 } = await generateAndVerifyProof(
            input1,
            vkey
        );

        if (!isValid1) {
            throw new Error('First proof verification failed!');
        }

        console.log('✓ First proof verified successfully\n');

        console.log('⚙️  Testing nullifier determinism...');
        console.log('   Generating second proof with same parameters...');

        const { sigFields: sigFields2, messageHash: msgHash2 } = await buildCircuitInput(
            wallet,
            voterIndex,
            topicId,
            treeData
        );

        const nullifier1 = await computeNullifier(
            sigFields1.r,
            sigFields1.s,
            ethers.id(topicId),
            msgHash1
        );

        const nullifier2 = await computeNullifier(
            sigFields2.r,
            sigFields2.s,
            ethers.id(topicId),
            msgHash2
        );

        console.log(`   Nullifier 1: ${nullifier1}`);
        console.log(`   Nullifier 2: ${nullifier2}`);

        if (nullifier1 !== nullifier2) {
            throw new Error('Nullifiers should be identical for same voter + topic!');
        }

        console.log('✓ Nullifiers are deterministic (identical)\n');

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
