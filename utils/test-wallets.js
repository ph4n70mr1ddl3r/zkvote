import { ethers } from 'ethers';

const TEST_MNEMONIC =
    'abandon ability able about above absent absorb abstract absurd abuse access accident';

const INVALID_MNEMONIC =
    'abandon ability able about above absent absorb abstract absurd abuse access accident accident';

export function getTestWallet(index, mnemonic = TEST_MNEMONIC) {
    if (!Number.isInteger(index) || index < 0) {
        throw new Error(`Index must be a non-negative integer, got ${index}`);
    }
    const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic).derivePath(`m/44'/60'/0'/0/${index}`);
    return wallet;
}

export function getTestWalletAddress(index, mnemonic = TEST_MNEMONIC) {
    return getTestWallet(index, mnemonic).address;
}

export { TEST_MNEMONIC, INVALID_MNEMONIC };
