import * as snarkjs from 'snarkjs';
import { PROOF_GENERATION_TIMEOUT_MS } from './constants.js';

/**
 * Proof generation and verification helper functions.
 * Provides timeout-protected proof generation for Groth16 proofs.
 */

/**
 * Generate a Groth16 ZK proof with timeout protection.
 * Prevents hanging on malformed inputs or circuit issues.
 * @param {Object} input - Circuit input signals (key-value pairs)
 * @param {string} wasmPath - Path to the circuit WASM file
 * @param {string} zkeyPath - Path to the proving key (.zkey) file
 * @param {number} [timeoutMs=PROOF_GENERATION_TIMEOUT_MS] - Timeout in milliseconds
 * @returns {Promise<Object>} Object containing:
 *   - proof: Groth16 proof object with pi_a, pi_b, pi_c, protocol
 *   - publicSignals: Array of public signal values as strings
 * @throws {Error} If inputs are invalid, proof generation fails, or timeout exceeded
 */
export async function generateProofWithTimeout(
    input,
    wasmPath,
    zkeyPath,
    timeoutMs = PROOF_GENERATION_TIMEOUT_MS
) {
    if (!input || typeof input !== 'object') {
        throw new Error('Circuit input must be a non-null object');
    }
    if (!wasmPath || typeof wasmPath !== 'string') {
        throw new TypeError('wasmPath must be a non-empty string');
    }
    if (!zkeyPath || typeof zkeyPath !== 'string') {
        throw new TypeError('zkeyPath must be a non-empty string');
    }

    const proofPromise = snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
            () => reject(new Error(`Proof generation timed out after ${timeoutMs / 1000}s`)),
            timeoutMs
        );
    });

    const { proof, publicSignals } = await Promise.race([proofPromise, timeoutPromise]);

    if (!proof || typeof proof !== 'object') {
        throw new Error('Invalid proof generated: proof is missing or not an object');
    }
    if (!publicSignals || !Array.isArray(publicSignals)) {
        throw new Error('Invalid proof generated: publicSignals is missing or not an array');
    }

    return { proof, publicSignals };
}

/**
 * Verify a Groth16 proof against a verification key.
 * @param {Object} vkey - Verification key object
 * @param {Array<string>} publicSignals - Array of public signal values
 * @param {Object} proof - Groth16 proof object
 * @returns {Promise<boolean>} True if proof is valid
 */
export async function verifyProof(vkey, publicSignals, proof) {
    if (!vkey || typeof vkey !== 'object') {
        throw new Error('Verification key must be a non-null object');
    }
    if (!Array.isArray(publicSignals)) {
        throw new Error('Public signals must be an array');
    }
    if (!proof || typeof proof !== 'object') {
        throw new Error('Proof must be a non-null object');
    }

    return snarkjs.groth16.verify(vkey, publicSignals, proof);
}
