import path from 'path';
import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { signVoteMessage, signatureToFieldElements } from '../utils/eip712.js';
import { addressToFieldElement } from '../utils/poseidon.js';
import { FILE_PATHS, MERKLE_PADDING_VALUE, TREE_DEPTH, DISPLAY_WIDTH } from '../utils/constants.js';
import { readAndValidateJsonFile } from '../utils/json-helper.js';

async function testInvalidVoter() {
    console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
    console.log('TEST: Invalid Voter Proof Rejection');
    console.log('='.repeat(DISPLAY_WIDTH.STANDARD) + '\n');

    try {
        const invalidVotersPath = path.join(process.cwd(), FILE_PATHS.data.invalidVoters);
        const invalidVoters = readAndValidateJsonFile(invalidVotersPath, {
            isArray: true
        });

        const treePath = path.join(process.cwd(), FILE_PATHS.data.merkleTree);
        const treeData = readAndValidateJsonFile(treePath, {
            requiredFields: ['root', 'tree', 'leaves']
        });

        // Test with first invalid voter
        const voterIndex = 0;
        const voter = invalidVoters[voterIndex];
        const wallet = new ethers.Wallet(voter.privateKey);

        console.log(`✓ Testing with INVALID voter ${voterIndex}: ${voter.address}`);
        console.log('  (This address is NOT in the Merkle tree)\n');

        // Generate signature
        const topicId = 'test-topic';
        const voteMessage = 'Vote for Proposal B';

        console.log(`✓ Vote message: "${voteMessage}"`);
        console.log(`✓ Topic: ${topicId}\n`);

        console.log('⚙️  Attempting to generate proof...');
        const sig = await signVoteMessage(wallet, topicId);
        const sigFields = signatureToFieldElements(sig);

        const fakeMerkleProof = {
            siblings: Array(TREE_DEPTH).fill(MERKLE_PADDING_VALUE),
            pathIndices: Array(TREE_DEPTH).fill(0)
        };

        const input = {
            merkleRoot: treeData.root,
            topicId: BigInt(ethers.id(topicId)).toString(),
            messageHash: BigInt(sig.messageHash).toString(),
            voterAddress: addressToFieldElement(voter.address),
            pathElements: fakeMerkleProof.siblings,
            pathIndices: fakeMerkleProof.pathIndices,
            sigR: sigFields.r,
            sigS: sigFields.s
        };

        console.log('⚠️  Note: Using fake Merkle proof (voter not in tree)');
        console.log('   Expected: Proof generation will succeed but verification will fail\n');

        let proof, publicSignals;

        try {
            ({ proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                path.join(process.cwd(), 'build', 'vote_js', 'vote.wasm'),
                path.join(process.cwd(), 'build', 'vote.zkey')
            ));

            console.log('✓ Proof generated (but will not verify)\n');
        } catch (error) {
            console.log('✓ Proof generation failed as expected');
            console.log(`   Error: ${error.message}\n`);
            console.log('✅ Test passed: Invalid voter cannot generate proof');
            return true;
        }

        // Try to verify the proof
        console.log('⚙️  Attempting to verify proof...');
        const vkey = readAndValidateJsonFile(
            path.join(process.cwd(), 'build', 'vote_verification_key.json'),
            {
                requiredFields: ['vk_alpha_1', 'vk_beta_2', 'vk_gamma_2', 'vk_delta_2', 'IC']
            }
        );

        const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

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
    .then((passed) => {
        console.log('\n' + '='.repeat(DISPLAY_WIDTH.STANDARD));
        process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    });
