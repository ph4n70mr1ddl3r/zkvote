import fs from 'fs';
import path from 'path';
import { buildMerkleTree } from '../utils/merkle-helper.js';
import { FILE_PATHS } from '../utils/constants.js';

async function main() {
    console.log('🌳 Building Merkle tree from valid voters...\n');

    const validVotersPath = path.join(process.cwd(), FILE_PATHS.data.validVoters);

    if (!fs.existsSync(validVotersPath)) {
        console.error('❌ Error: valid-voters.json not found!');
        console.error('   Please run: npm run generate-accounts');
        process.exit(1);
    }

    let validVoters;
    try {
        validVoters = JSON.parse(fs.readFileSync(validVotersPath, 'utf8'));
    } catch (error) {
        console.error('❌ Error: Failed to parse valid-voters.json!');
        console.error(`   ${error.message}`);
        process.exit(1);
    }
    console.log(`📋 Loaded ${validVoters.length} valid voter addresses`);

    // Extract addresses
    const addresses = validVoters.map(v => v.address);

    // Build tree
    console.log('🔨 Building Merkle tree...');
    const merkleTree = await buildMerkleTree(addresses);

    const treePath = path.join(process.cwd(), FILE_PATHS.data.merkleTree);
    const treeData = {
        root: merkleTree.root,
        depth: 7,
        leafCount: validVoters.length,
        tree: merkleTree.tree,
        leaves: merkleTree.leaves
    };

    fs.writeFileSync(treePath, JSON.stringify(treeData, null, 2));

    console.log('\n✅ Merkle tree built successfully!');
    console.log(`   Tree depth: 7`);
    console.log(`   Leaf count: ${validVoters.length}`);
    console.log(`   Total nodes: ${merkleTree.tree.reduce((sum, level) => sum + level.length, 0)}`);
    console.log(`   Merkle root: ${merkleTree.root}`);
    console.log(`   Saved to: ${treePath}\n`);

    // Display tree structure summary
    console.log('📊 Tree structure:');
    for (let i = merkleTree.tree.length - 1; i >= 0; i--) {
        const level = merkleTree.tree.length - 1 - i;
        const nodeCount = merkleTree.tree[i].length;
        console.log(`   Level ${level}: ${nodeCount} nodes`);
    }
}

main().catch(console.error);
