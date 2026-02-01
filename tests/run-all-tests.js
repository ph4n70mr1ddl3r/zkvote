import { exec } from 'child_process';
import { promisify } from 'util';
import { DISPLAY_WIDTH } from '../utils/constants.js';

const execAsync = promisify(exec);

/**
 * Master test runner - runs all test suites
 */

const tests = [
    {
        name: 'Valid Voter Test',
        file: 'tests/test-valid-voter.js',
        description: 'Valid voter can generate and verify proofs'
    },
    {
        name: 'Invalid Voter Test',
        file: 'tests/test-invalid-voter.js',
        description: 'Invalid voter proofs are rejected'
    },
    {
        name: 'Nullifier Determinism Test',
        file: 'tests/test-nullifier-determinism.js',
        description: 'Nullifiers are deterministic and unique'
    },
    {
        name: 'Double Voting Prevention Test',
        file: 'tests/test-double-voting.js',
        description: 'Duplicate votes are detected via nullifiers'
    }
];

async function runTest(test) {
    console.log(`\n${'='.repeat(DISPLAY_WIDTH.WIDE)}`);
    console.log(`Running: ${test.name}`);
    console.log(`Description: ${test.description}`);
    console.log('='.repeat(DISPLAY_WIDTH.WIDE));

    try {
        const { stdout, stderr } = await execAsync(`node ${test.file}`);

        if (stdout) {
            console.log(stdout);
        }
        if (stderr && !stderr.includes('ExperimentalWarning')) {
            console.log('Stderr:', stderr);
        }

        console.log(`\n✅ ${test.name} PASSED`);
        return { name: test.name, passed: true };
    } catch (error) {
        console.log(error.stdout || '');
        console.error(error.stderr || '');
        console.log(`\n❌ ${test.name} FAILED`);
        return { name: test.name, passed: false, error: error.message };
    }
}

async function runAllTests() {
    console.log('\n' + '█'.repeat(DISPLAY_WIDTH.WIDE));
    console.log('  ZKP VOTING SYSTEM - TEST SUITE');
    console.log('█'.repeat(DISPLAY_WIDTH.WIDE));

    const results = [];

    for (const test of tests) {
        const result = await runTest(test);
        results.push(result);
    }

    // Print summary
    console.log('\n' + '█'.repeat(DISPLAY_WIDTH.WIDE));
    console.log('  TEST SUMMARY');
    console.log('█'.repeat(DISPLAY_WIDTH.WIDE) + '\n');

    let passCount = 0;
    let failCount = 0;

    for (const result of results) {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status}  ${result.name}`);

        if (result.passed) {
            passCount++;
        } else {
            failCount++;
            if (result.error) {
                console.log(`       Error: ${result.error}`);
            }
        }
    }

    console.log('\n' + '-'.repeat(DISPLAY_WIDTH.WIDE));
    console.log(`Total: ${tests.length} tests`);
    console.log(`Passed: ${passCount}`);
    console.log(`Failed: ${failCount}`);
    console.log('-'.repeat(DISPLAY_WIDTH.WIDE));

    if (failCount === 0) {
        console.log('\n🎉 All tests passed! The ZKP voting system is working correctly.\n');
        process.exit(0);
    } else {
        console.log(`\n⚠️  ${failCount} test(s) failed. Please review the errors above.\n`);
        process.exit(1);
    }
}

runAllTests().catch((error) => {
    console.error('\n❌ Fatal error running tests:', error.message);
    process.exit(1);
});
