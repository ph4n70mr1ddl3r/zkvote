import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { FILE_PATHS, NUM_ACCOUNTS } from '../utils/constants.js';
import { writeJsonFile } from '../utils/json-helper.js';

import { TEST_MNEMONIC, INVALID_MNEMONIC } from '../utils/test-wallets.js';

function generateAccounts(count, mnemonic) {
    if (!Number.isInteger(count)) {
        throw new Error('Account count must be an integer');
    }
    if (count <= 0) {
        throw new Error('Account count must be positive');
    }
    if (count > 1000) {
        throw new Error('Account count cannot exceed 1000');
    }
    const accounts = [];

    for (let i = 0; i < count; i++) {
        const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic).derivePath(`m/44'/60'/0'/0/${i}`);
        accounts.push({
            index: i,
            address: wallet.address,
        });
    }

    return accounts;
}

async function main() {
    console.log('Generating deterministic Ethereum accounts...\n');

    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log(`Generating ${NUM_ACCOUNTS} valid voter accounts...`);
    const validVoters = generateAccounts(NUM_ACCOUNTS, TEST_MNEMONIC);
    const validVotersPath = path.join(process.cwd(), FILE_PATHS.data.validVoters);
    writeJsonFile(validVotersPath, validVoters);
    console.log(`Valid voters saved to: ${validVotersPath}`);
    console.log(`   First address: ${validVoters[0].address}`);
    console.log(`   last address:  ${validVoters[NUM_ACCOUNTS - 1].address}\n`);

    console.log(`Generating ${NUM_ACCOUNTS} invalid voter accounts...`);
    const invalidVoters = generateAccounts(NUM_ACCOUNTS, INVALID_MNEMONIC);
    const invalidVotersPath = path.join(process.cwd(), FILE_PATHS.data.invalidVoters);
    writeJsonFile(invalidVotersPath, invalidVoters);
    console.log(`Invalid voters saved to: ${invalidVotersPath}`);
    console.log(`   First address: ${invalidVoters[0].address}`);
    console.log(`   last address:  ${invalidVoters[NUM_ACCOUNTS - 1].address}\n`);

    console.log('account generation complete!');
    console.log(`   Total accounts generated: ${NUM_ACCOUNTS * 2}`);
    console.log('\n   Note: Wallets are generated deterministically from a mnemonic.');
    console.log('   Use utils/test-wallets.js to get wallets for signing.');
    console.log('   Private keys are NEVER stored in files.');
}

 console.log('   This addresses are test-only - NEVER use them in production!');
');

 process.exit(0);
    })
    .catch(error) {
        console.error('Error generating accounts:', error.message);
        process.exit(1);
    });
