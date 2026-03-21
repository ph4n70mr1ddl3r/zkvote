import * as snarkjs from 'snarkjs';
import { PROOF_GENERATION_TIMEOUT_MS } from './constants.js';

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
