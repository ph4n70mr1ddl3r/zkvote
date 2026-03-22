import path from 'path';
import { ethers } from 'ethers';
import { signVoteMessage, signatureToFieldElements } from '../utils/eip712.js';
import { computeNullifier } from '../utils/poseidon.js';
import { FILE_PATHS, DISPLAY_WIDTH } from '../utils/constants.js';
import { readAndValidateJsonFile } from '../utils/json-helper.js';
import { getTestWallet, TEST_SEED } from '../utils/test-wallets.js';

async function testNullifierCollision() {
    console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
    console.log('TEST: Nullifier Collision Resistance');
    console.log('='.repeat(DISPLAY_WIDTH.STANDARD) + '\n');

    try {
        const votersPath = path.join(process.cwd(), FILE_PATHS.data.validVoters);
        const voters = readAndValidateJsonFile(votersPath, { isArray: true });

        const numVoters = Math.min(20, voters.length);
        const numTopics = 10;
        const topics = Array.from({ length: numTopics }, (_, i) => `topic-${i}`);

        console.log(
            `Testing ${numVoters} voters x ${numTopics} topics = ${numVoters * numTopics} nullifiers\n`
        );

        const nullifierSet = new Set();
        const collisions = [];
        let processed = 0;

        for (let v = 0; v < numVoters; v++) {
            const voter = voters[v];
            const wallet = getTestWallet(v, TEST_SEED);

            if (wallet.address.toLowerCase() !== voter.address.toLowerCase()) {
                throw new Error(`Wallet address mismatch at index ${v}`);
            }

            for (let t = 0; t < numTopics; t++) {
                const topic = topics[t];
                const sig = await signVoteMessage(wallet, topic);
                const fields = signatureToFieldElements(sig);
                const topicHash = ethers.id(topic);

                const nullifier = await computeNullifier(
                    fields.r,
                    fields.s,
                    topicHash,
                    sig.messageHash
                );

                if (nullifierSet.has(nullifier)) {
                    collisions.push({ voterIndex: v, topic, nullifier });
                } else {
                    nullifierSet.add(nullifier);
                }

                processed++;
            }
        }

        console.log(`Processed: ${processed} nullifiers`);
        console.log(`Unique nullifiers: ${nullifierSet.size}`);
        console.log(`Collisions: ${collisions.length}`);

        if (collisions.length > 0) {
            console.error('\n❌ Collision detected!');
            for (const c of collisions) {
                console.error(`  Voter ${c.voterIndex}, topic "${c.topic}": ${c.nullifier}`);
            }
            throw new Error(`Found ${collisions.length} nullifier collisions`);
        }

        console.log('\n✅ Nullifier collision resistance test passed!');
        console.log('\nSummary:');
        console.log(`  ✓ Tested ${numVoters} voters across ${numTopics} topics`);
        console.log(`  ✓ Generated ${processed} unique nullifiers`);
        console.log('  ✓ No collisions detected');

        return true;
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        return false;
    }
}

testNullifierCollision()
    .then(passed => {
        console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
        process.exit(passed ? 0 : 1);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    });
