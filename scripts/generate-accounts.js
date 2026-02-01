import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { FILE_PATHS } from '../utils/constants.js';

/**
 * Generate Ethereum accounts for testing the ZKP voting system
 * Creates 100 valid voters and 100 invalid voters
 */

const NUM_ACCOUNTS = 100;

function generateAccounts(count) {
    const accounts = [];

    for (let i = 0; i < count; i++) {
        // Generate random wallet
        const wallet = ethers.Wallet.createRandom();

        accounts.push({
            index: i,
            address: wallet.address,
            privateKey: wallet.privateKey
        });
    }

    return accounts;
}

async function main() {
    console.log('🔑 Generating Ethereum accounts...\n');

    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log(`Generating ${NUM_ACCOUNTS} valid voter accounts...`);
    const validVoters = generateAccounts(NUM_ACCOUNTS);
    const validVotersPath = path.join(process.cwd(), FILE_PATHS.data.validVoters);
    fs.writeFileSync(validVotersPath, JSON.stringify(validVoters, null, 2));
    console.log(`✅ Valid voters saved to: ${validVotersPath}`);
    console.log(`   First address: ${validVoters[0].address}`);
    console.log(`   Last address:  ${validVoters[NUM_ACCOUNTS - 1].address}\n`);

    console.log(`Generating ${NUM_ACCOUNTS} invalid voter accounts...`);
    const invalidVoters = generateAccounts(NUM_ACCOUNTS);
    const invalidVotersPath = path.join(process.cwd(), FILE_PATHS.data.invalidVoters);
    fs.writeFileSync(invalidVotersPath, JSON.stringify(invalidVoters, null, 2));
    console.log(`✅ Invalid voters saved to: ${invalidVotersPath}`);
    console.log(`   First address: ${invalidVoters[0].address}`);
    console.log(`   Last address:  ${invalidVoters[NUM_ACCOUNTS - 1].address}\n`);

    console.log('🎉 Account generation complete!');
    console.log(`   Total accounts generated: ${NUM_ACCOUNTS * 2}`);
}

main().catch(console.error);
