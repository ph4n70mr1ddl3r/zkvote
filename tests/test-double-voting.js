import { DISPLAY_WIDTH, PUBLIC_SIGNAL } from '../utils/constants.js';
import {
    loadTestFixtures,
    getWallet,
    buildCircuitInput,
    generateAndVerifyProof,
} from './helpers.js';

async function testDoubleVoting() {
    console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
    console.log('TEST: Double Voting Prevention');
    console.log('='.repeat(DISPLAY_WIDTH.STANDARD) + '\n');

    try {
        const { voters, treeData, vkey } = loadTestFixtures();

        const voterIndex = 0;
        const wallet = getWallet(voters, voterIndex);

        console.log(`Testing with voter: ${voters[voterIndex].address}\n`);

        const nullifierRegistry = new Set();

        const topicId = 'important-vote';

        console.log('📋 First Vote:');
        console.log(`   Topic: ${topicId}`);
        console.log('   Generating proof...\n');

        const { input: input1 } = await buildCircuitInput(wallet, voterIndex, topicId, treeData);

        const { publicSignals: ps1, isValid: isValid1 } = await generateAndVerifyProof(
            input1,
            vkey
        );

        if (!isValid1) {
            throw new Error('First proof verification failed!');
        }

        const nullifier1 = ps1[PUBLIC_SIGNAL.NULLIFIER];
        console.log(`   ✅ Proof verified`);
        console.log(`   Nullifier: ${nullifier1}`);

        if (nullifierRegistry.has(nullifier1)) {
            throw new Error('Double vote detected on first vote (should not happen)');
        }

        nullifierRegistry.add(nullifier1);
        console.log(`   ✅ Nullifier registered\n`);

        console.log('📋 Second Vote (DOUBLE VOTE ATTEMPT):');
        console.log(`   Topic: ${topicId} (SAME topic)`);
        console.log('   Generating proof...\n');

        const { input: input2 } = await buildCircuitInput(wallet, voterIndex, topicId, treeData);

        const { publicSignals: ps2, isValid: isValid2 } = await generateAndVerifyProof(
            input2,
            vkey
        );

        if (!isValid2) {
            throw new Error('Second proof verification failed!');
        }

        const nullifier2 = ps2[PUBLIC_SIGNAL.NULLIFIER];
        console.log(`   ✅ Proof verified`);
        console.log(`   Nullifier: ${nullifier2}`);

        console.log('\n📊 Nullifier Comparison:');
        console.log(`   First vote nullifier:  ${nullifier1}`);
        console.log(`   Second vote nullifier: ${nullifier2}`);
        console.log(`   Are they equal? ${nullifier1 === nullifier2 ? 'YES ✓' : 'NO ❌'}\n`);

        if (nullifier1 !== nullifier2) {
            throw new Error('Nullifiers should be identical for same voter + topic!');
        }

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
        return false;
    }
}

// Run test
testDoubleVoting()
    .then(passed => {
        console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
        process.exit(passed ? 0 : 1);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    });
