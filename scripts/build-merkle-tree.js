import fs from 'fs';
import path from 'path';
import { buildMerkleTree, getMerkleProof, verifyMerkleProof } from '../utils/merkle-helper.js';
import { addressToFieldElement } from '../utils/poseidon.js';
import { FILE_PATHS, TREE_DEPTH } from '../utils/constants.js';
import { readAndValidateJsonFile, writeJsonFile } from '../utils/json-helper.js';

async function main() {
    console.log('🌳 Building Merkle tree from valid voters...\n');

    try {
        const validVotersPath = path.join(process.cwd(), FILE_PATHS.data.validVoters);

        if (!fs.existsSync(validVotersPath)) {
            console.error('❌ Error: valid-voters.json not found!');
            console.error('   Please run: npm run generate-accounts');
            process.exit(1);
        }

        const validVoters = readAndValidateJsonFile(validVotersPath, {
            isArray: true,
            nonEmpty: true,
        });

        console.log(`📋 Loaded ${validVoters.length} valid voter addresses`);

        const addresses = validVoters.map(v => v.address);

        for (let i = 0; i < addresses.length; i++) {
            if (!addresses[i] || typeof addresses[i] !== 'string') {
                throw new Error(`Invalid address at index ${i}: ${addresses[i]}`);
            }
        }

        console.log('🔨 Building Merkle tree...');
        const merkleTree = await buildMerkleTree(addresses);

        if (!merkleTree.root || merkleTree.root === '0') {
            throw new Error('Invalid Merkle root generated');
        }

        console.log('🔍 Verifying tree integrity...');
        const testProof = getMerkleProof(merkleTree.tree, 0);
        const testLeaf = addressToFieldElement(addresses[0]);
        const proofValid = await verifyMerkleProof(testLeaf, testProof, merkleTree.root);
        if (!proofValid) {
            throw new Error('Merkle tree verification failed: proof for first leaf is invalid');
        }

        const lastLeafIndex = addresses.length - 1;
        const lastProof = getMerkleProof(merkleTree.tree, lastLeafIndex);
        const lastLeaf = addressToFieldElement(addresses[lastLeafIndex]);
        const lastProofValid = await verifyMerkleProof(lastLeaf, lastProof, merkleTree.root);
        if (!lastProofValid) {
            throw new Error('Merkle tree verification failed: proof for last leaf is invalid');
        }
        console.log('   ✓ First leaf proof verified');
        console.log('   ✓ Last leaf proof verified');

        const treePath = path.join(process.cwd(), FILE_PATHS.data.merkleTree);
        const treeData = {
            root: merkleTree.root,
            depth: TREE_DEPTH,
            leafCount: validVoters.length,
            tree: merkleTree.tree,
            leaves: merkleTree.leaves,
        };

        writeJsonFile(treePath, treeData);

        console.log('\n✅ Merkle tree built successfully!');
        console.log(`   Tree depth: ${TREE_DEPTH}`);
        console.log(`   Leaf count: ${validVoters.length}`);
        console.log(
            `   Total nodes: ${merkleTree.tree.reduce((sum, level) => sum + level.length, 0)}`
        );
        console.log(`   Merkle root: ${merkleTree.root}`);
        console.log(`   Saved to: ${treePath}\n`);

        console.log('📊 Tree structure:');
        for (let i = merkleTree.tree.length - 1; i >= 0; i--) {
            const level = merkleTree.tree.length - 1 - i;
            const nodeCount = merkleTree.tree[i].length;
            console.log(`   Level ${level}: ${nodeCount} nodes`);
        }
    } catch (error) {
        console.error('❌ Error building Merkle tree:', error.message);
        process.exit(1);
    }
}

main();
