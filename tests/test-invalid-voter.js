import { DISPLAY_WIDTH } from '../utils/constants.js';
import {
    loadTestFixtures,
    getWallet,
    buildCircuitInput,
    generateAndVerifyProof,
} from './helpers.js';

async function testInvalidVoter() {
    console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
    console.log('TEST: Invalid Voter Proof Rejection');
    console.log('='.repeat(DISPLAY_WIDTH.STANDARD) + '\n');

    try {
        const { invalidVoters, treeData, vkey } = loadTestFixtures();

        const voterIndex = 0;
        const wallet = getWallet(invalidVoters, voterIndex);

        console.log(
            `✓ Testing with INVALID voter ${voterIndex}: ${invalidVoters[voterIndex].address}`
        );
        console.log('  (This address is NOT in the Merkle tree)\n');

        const topicId = 'test-topic';

        console.log(`✓ Topic: ${topicId}\n`);

        console.log('⚙️  Attempting to generate proof...');
        const { input } = await buildCircuitInput(wallet, voterIndex, topicId, treeData, true);

        console.log('⚠️  Note: Using fake Merkle proof (voter not in tree)');
        console.log('   Expected: Proof generation will succeed but verification will fail\n');

        let isValid;

        try {
            const result = await generateAndVerifyProof(input, vkey);
            isValid = result.isValid;

            console.log('✓ Proof generated (but will not verify)\n');
        } catch (error) {
            console.log('✓ Proof generation failed as expected');
            console.log(`   Error: ${error.message}\n`);
            console.log('✅ Test passed: Invalid voter cannot generate proof');
            return true;
        }

        console.log('⚙️  Verifying proof...');
        console.log(`   Verification result: ${isValid ? 'VALID ❌' : 'INVALID ✓'}\n`);

        if (isValid) {
            throw new Error('Invalid voter proof should NOT verify!');
        }

        console.log('✅ Test passed!');
        console.log('\nSummary:');
        console.log('  ✓ Invalid voter is not in Merkle tree');
        console.log('  ✓ Proof with fake Merkle path does not verify');
        console.log('  ✓ System correctly rejects invalid voters');

        return true;
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        return false;
    }
}

// Run test
testInvalidVoter()
    .then(passed => {
        console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
        process.exit(passed ? 0 : 1);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    });
