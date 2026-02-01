import fs from 'fs';
import path from 'path';
import { buildMerkleTree } from '../utils/merkle-helper.js';
import { FILE_PATHS, TREE_DEPTH } from '../utils/constants.js';
import { readAndValidateJsonFile } from '../utils/json-helper.js';

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

        if (validVoters.length === 0) {
            throw new Error('No valid voters found. Please run: npm run generate-accounts');
        }

        console.log(`📋 Loaded ${validVoters.length} valid voter addresses`);

        // Extract addresses
        const addresses = validVoters.map(v => v.address);

        console.log('🔨 Building Merkle tree...');
        const merkleTree = await buildMerkleTree(addresses);

        if (!merkleTree.root || merkleTree.root === '0') {
            throw new Error('Invalid Merkle root generated');
        }

        const treePath = path.join(process.cwd(), FILE_PATHS.data.merkleTree);
        const treeData = {
            root: merkleTree.root,
            depth: TREE_DEPTH,
            leafCount: validVoters.length,
            tree: merkleTree.tree,
            leaves: merkleTree.leaves,
        };

        fs.writeFileSync(treePath, JSON.stringify(treeData, null, 2));

        console.log('\n✅ Merkle tree built successfully!');
        console.log(`   Tree depth: ${TREE_DEPTH}`);
        console.log(`   Leaf count: ${validVoters.length}`);
        console.log(
            `   Total nodes: ${merkleTree.tree.reduce((sum, level) => sum + level.length, 0)}`
        );
        console.log(`   Merkle root: ${merkleTree.root}`);
        console.log(`   Saved to: ${treePath}\n`);

        // Display tree structure summary
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
