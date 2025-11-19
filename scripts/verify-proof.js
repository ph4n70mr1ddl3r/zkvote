import fs from 'fs';
import path from 'path';
import * as snarkjs from 'snarkjs';

/**
 * Verify a ZK proof
 * Usage: node scripts/verify-proof.js [proof-file]
 */

async function verifyProof(proofPath) {
    console.log('🔍 Verifying ZK proof...\n');

    // Load proof
    if (!fs.existsSync(proofPath)) {
        throw new Error(`Proof file not found: ${proofPath}`);
    }

    const proofData = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    console.log('📋 Proof metadata:');
    console.log(`   Voter: ${proofData.metadata.voterAddress}`);
    console.log(`   Topic: ${proofData.metadata.topicId}`);
    console.log(`   Message: "${proofData.metadata.voteMessage}"`);
    console.log(`   Timestamp: ${proofData.metadata.timestamp}`);
    console.log(`   Invalid voter: ${proofData.metadata.isInvalidVoter ? 'Yes ⚠️' : 'No'}\n`);

    // Load verification key
    const vkeyPath = path.join(process.cwd(), 'build', 'vote_verification_key.json');

    if (!fs.existsSync(vkeyPath)) {
        throw new Error('Verification key not found. Run: npm run compile-circuits');
    }

    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

    console.log('⚙️  Verifying proof...');

    // Verify the proof
    const isValid = await snarkjs.groth16.verify(
        vkey,
        proofData.publicSignals,
        proofData.proof
    );

    console.log('\n' + '='.repeat(60));

    if (isValid) {
        console.log('✅ PROOF IS VALID!');
        console.log('='.repeat(60));
        console.log('\n📊 Public signals:');
        console.log(`   Nullifier: ${proofData.publicSignals[0]}`);
        console.log(`   Merkle root: ${proofData.publicSignals[1]}`);
        console.log(`   Topic ID: ${proofData.publicSignals[2]}`);
        console.log(`   Message hash: ${proofData.publicSignals[3]}`);
        console.log(`   Computed nullifier: ${proofData.metadata.nullifier}`);

        console.log('\n✨ This proves that:');
        console.log('   1. The voter is in the valid voter set (Merkle tree)');
        console.log('   2. The vote is for the specified topic');
        console.log('   3. The nullifier prevents double voting');
        console.log('   4. The voter\'s identity remains anonymous\n');

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
        console.log('   3. Public signals don\'t match the proof');
        console.log('   4. Wrong verification key\n');

        if (proofData.metadata.isInvalidVoter) {
            console.log('ℹ️  This is expected - proof was generated with an invalid voter.');
        }
    }

    console.log('='.repeat(60) + '\n');

    return isValid;
}

// CLI interface
const args = process.argv.slice(2);

let proofPath;

if (args.length === 0) {
    // Use default latest proof
    proofPath = path.join(process.cwd(), 'build', 'latest_proof.json');
} else {
    proofPath = args[0];
}

verifyProof(proofPath)
    .then((isValid) => {
        process.exit(isValid ? 0 : 1);
    })
    .catch((error) => {
        console.error('\n❌ Error verifying proof:');
        console.error(error.message);
        process.exit(1);
    });
