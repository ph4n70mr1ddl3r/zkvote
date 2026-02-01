import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { CIRCUIT_CONFIG, PTAU_MIN_FILE_SIZE } from '../utils/constants.js';

const execAsync = promisify(exec);

/**
 * Compile Circom circuits and generate proving/verification keys
 */

async function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(filepath, () => {});
                reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                const stats = fs.statSync(filepath);
                if (stats.size < PTAU_MIN_FILE_SIZE) {
                    fs.unlinkSync(filepath);
                    reject(new Error('Downloaded file is too small, likely an error response'));
                } else {
                    resolve();
                }
            });
        }).on('error', (err) => {
            file.close();
            fs.unlink(filepath, (unlinkErr) => {
                if (unlinkErr) {
                    reject(new Error(`${err.message} (also failed to cleanup: ${unlinkErr.message})`));
                } else {
                    reject(err);
                }
            });
        });
    });
}

async function runCommand(command, description) {
    console.log(`\n🔨 ${description}...`);
    try {
        const { stdout, stderr } = await execAsync(command);
        if (stdout) {
            console.log(stdout);
        }
        if (stderr && !stderr.includes('Warning')) {
            console.error(stderr);
        }
        console.log(`✅ ${description} complete`);
    } catch (error) {
        console.error(`❌ Error in ${description}:`);
        console.error(error.message);
        if (error.stderr) {
            console.error('Error output:', error.stderr);
        }
        throw error;
    }
}

async function main() {
    console.log('⚙️  Compiling ZKP circuits...\n');

    // Create build directory
    const buildDir = path.join(process.cwd(), 'build');
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, { recursive: true });
    }

    const circuitPath = path.join(process.cwd(), 'circuits', `${CIRCUIT_CONFIG.CIRCUIT_NAME}.circom`);
    const buildPath = path.join(buildDir, CIRCUIT_CONFIG.CIRCUIT_NAME);

    // Check if circom is installed
    try {
        await execAsync('circom --version');
    } catch (error) {
        console.error('❌ Circom not found!');
        console.error('Please install Circom: https://docs.circom.io/getting-started/installation/');
        console.error('\nQuick install:');
        console.error('  git clone https://github.com/iden3/circom.git');
        console.error('  cd circom');
        console.error('  cargo build --release');
        console.error('  cargo install --path circom');
        process.exit(1);
    }

    // 1. Compile circuit
    await runCommand(
        `circom ${circuitPath} --r1cs --wasm --sym -o ${buildDir}`,
        'Compiling circuit'
    );

    const ptauPath = path.join(buildDir, `powersOfTau28_hez_final_${CIRCUIT_CONFIG.PTAU_SIZE}.ptau`);
    if (!fs.existsSync(ptauPath)) {
        console.log(`\n📥 Downloading powers of tau (size ${CIRCUIT_CONFIG.PTAU_SIZE})...`);
        const ptauUrl = `https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_${CIRCUIT_CONFIG.PTAU_SIZE}.ptau`;
        await downloadFile(ptauUrl, ptauPath);
        console.log('✅ Powers of tau downloaded');
    } else {
        console.log(`\n✓ Powers of tau already exists`);
    }

    const zkeyPath = path.join(buildDir, `${CIRCUIT_CONFIG.CIRCUIT_NAME}.zkey`);
    await runCommand(
        `snarkjs groth16 setup ${buildPath}.r1cs ${ptauPath} ${zkeyPath}`,
        'Generating proving key'
    );

    const vkeyPath = path.join(buildDir, `${CIRCUIT_CONFIG.CIRCUIT_NAME}_verification_key.json`);
    await runCommand(
        `snarkjs zkey export verificationkey ${zkeyPath} ${vkeyPath}`,
        'Exporting verification key'
    );

    const verifierPath = path.join(buildDir, `${CIRCUIT_CONFIG.CIRCUIT_NAME}_verifier.sol`);
    await runCommand(
        `snarkjs zkey export solidityverifier ${zkeyPath} ${verifierPath}`,
        'Generating Solidity verifier'
    );

    console.log('\n🎉 Circuit compilation complete!');
    console.log(`   Circuit: ${CIRCUIT_CONFIG.CIRCUIT_NAME}.circom`);
    console.log(`   R1CS: ${buildPath}.r1cs`);
    console.log(`   WASM: ${buildPath}_js/${CIRCUIT_CONFIG.CIRCUIT_NAME}.wasm`);
    console.log(`   Proving key: ${zkeyPath}`);
    console.log(`   Verification key: ${vkeyPath}`);
    console.log(`   Solidity verifier: ${verifierPath}`);

    // Display circuit info
    console.log('\n📊 Getting circuit info...');
    try {
        const { stdout } = await execAsync(`snarkjs r1cs info ${buildPath}.r1cs`);
        console.log(stdout);
    } catch (error) {
        console.warn('  Could not retrieve circuit info');
    }
}

main().catch((error) => {
    console.error('\n❌ Compilation failed:', error.message);
    process.exit(1);
});
