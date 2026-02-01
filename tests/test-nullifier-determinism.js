import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { signVoteMessage, signatureToFieldElements } from '../utils/eip712.js';
import { poseidonHashMany } from '../utils/poseidon.js';
import { FILE_PATHS, DISPLAY_WIDTH } from '../utils/constants.js';
import { readAndValidateJsonFile } from '../utils/json-helper.js';

async function testNullifierDeterminism() {
    console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
    console.log('TEST: Nullifier Determinism');
    console.log('='.repeat(DISPLAY_WIDTH.STANDARD) + '\n');

    try {
        const votersPath = path.join(process.cwd(), FILE_PATHS.data.validVoters);
        const voters = readAndValidateJsonFile(votersPath, {
            isArray: true
        });

        const voter1 = voters[0];
        const voter2 = voters[1];
        const wallet1 = new ethers.Wallet(voter1.privateKey);
        const wallet2 = new ethers.Wallet(voter2.privateKey);

        console.log(`Voter 1: ${voter1.address}`);
        console.log(`Voter 2: ${voter2.address}\n`);

        // Test 1: Same voter, same topic → same nullifier
        console.log('Test 1: Same voter, same topic → same nullifier');
        console.log('-'.repeat(DISPLAY_WIDTH.STANDARD));

        const topic1 = 'topic-A';
        const message1 = 'Vote A';

        console.log(`  Generating two signatures for voter 1, topic "${topic1}"...`);

        const sig1a = await signVoteMessage(wallet1, topic1);
        const sig1b = await signVoteMessage(wallet1, topic1);

        const fields1a = signatureToFieldElements(sig1a);
        const fields1b = signatureToFieldElements(sig1b);

        const topicHash1 = BigInt(ethers.id(topic1));

        const nullifier1a = await poseidonHashMany([
            BigInt(fields1a.r),
            BigInt(fields1a.s),
            topicHash1
        ]);

        const nullifier1b = await poseidonHashMany([
            BigInt(fields1b.r),
            BigInt(fields1b.s),
            topicHash1
        ]);

        console.log(`  Nullifier 1a: ${nullifier1a}`);
        console.log(`  Nullifier 1b: ${nullifier1b}`);

        if (nullifier1a !== nullifier1b) {
            throw new Error('Test 1 failed: Nullifiers should be identical!');
        }

        console.log('  ✅ Nullifiers are identical\n');

        // Test 2: Same voter, different topic → different nullifier
        console.log('Test 2: Same voter, different topic → different nullifier');
        console.log('-'.repeat(DISPLAY_WIDTH.STANDARD));

        const topic2 = 'topic-B';

        console.log(`  Generating signature for voter 1, topic "${topic2}"...`);

        const sig2 = await signVoteMessage(wallet1, topic2);
        const fields2 = signatureToFieldElements(sig2);

        const topicHash2 = BigInt(ethers.id(topic2));

        const nullifier2 = await poseidonHashMany([
            BigInt(fields2.r),
            BigInt(fields2.s),
            topicHash2
        ]);

        console.log(`  Nullifier (topic A): ${nullifier1a}`);
        console.log(`  Nullifier (topic B): ${nullifier2}`);

        if (nullifier1a === nullifier2) {
            throw new Error('Test 2 failed: Nullifiers for different topics should differ!');
        }

        console.log('  ✅ Nullifiers are different\n');

        // Test 3: Different voter, same topic → different nullifier
        console.log('Test 3: Different voter, same topic → different nullifier');
        console.log('-'.repeat(DISPLAY_WIDTH.STANDARD));

        console.log(`  Generating signature for voter 2, topic "${topic1}"...`);

        const sig3 = await signVoteMessage(wallet2, topic1);
        const fields3 = signatureToFieldElements(sig3);

        const nullifier3 = await poseidonHashMany([
            BigInt(fields3.r),
            BigInt(fields3.s),
            topicHash1
        ]);

        console.log(`  Nullifier (voter 1): ${nullifier1a}`);
        console.log(`  Nullifier (voter 2): ${nullifier3}`);

        if (nullifier1a === nullifier3) {
            throw new Error('Test 3 failed: Nullifiers for different voters should differ!');
        }

        console.log('  ✅ Nullifiers are different\n');

        console.log('✅ All nullifier determinism tests passed!');
        console.log('\nSummary:');
        console.log('  ✓ Same voter + same topic = same nullifier (deterministic)');
        console.log('  ✓ Same voter + different topic = different nullifier');
        console.log('  ✓ Different voter + same topic = different nullifier');
        console.log('  ✓ Nullifiers provide double-vote prevention');

        return true;
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        return false;
    }
}

// Run test
testNullifierDeterminism()
    .then((passed) => {
        console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
        process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    });
