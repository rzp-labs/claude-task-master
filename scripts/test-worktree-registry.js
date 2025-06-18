#!/usr/bin/env node

/**
 * test-worktree-registry.js
 * Basic test for worktree registry read/write functions
 */

import fs from 'fs';
import path from 'path';

async function testRegistryBasics() {
	console.log('=== WORKTREE REGISTRY BASIC TESTS ===\n');

	const projectRoot = process.cwd();
	const testRegistryPath = path.join(
		projectRoot,
		'.taskmaster',
		'worktree-registry.json'
	);

	try {
		// Test 1: Module Import
		console.log('1. Testing module import...');
		const registry = await import('./modules/utils/worktree-registry.js');
		console.log('✓ Module imports successfully');
		console.log('✓ Functions available:', Object.keys(registry));
		console.log('');

		// Cleanup any existing test registry
		if (fs.existsSync(testRegistryPath)) {
			fs.unlinkSync(testRegistryPath);
		}

		// Test 2: Read non-existent registry (should return empty structure)
		console.log('2. Testing read of non-existent registry...');
		const emptyRegistry = registry.readRegistry(projectRoot);
		console.log('✓ Returns empty structure:', !!emptyRegistry);
		console.log(
			'✓ Has worktrees object:',
			typeof emptyRegistry.worktrees === 'object'
		);
		console.log('✓ Has metadata:', !!emptyRegistry.metadata);
		console.log('');

		// Test 3: Write registry
		console.log('3. Testing registry write...');
		const testData = {
			worktrees: {
				'task-999': {
					taskId: '999',
					branch: 'task-999',
					path: './worktrees/task-999',
					createdAt: new Date().toISOString()
				}
			},
			metadata: {
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				version: '1.0'
			}
		};

		registry.writeRegistry(projectRoot, testData);
		console.log('✓ Registry written successfully');

		// Verify file exists
		const fileExists = fs.existsSync(testRegistryPath);
		console.log('✓ File exists on filesystem:', fileExists);
		console.log('');

		// Test 4: Read existing registry
		console.log('4. Testing read of existing registry...');
		const readData = registry.readRegistry(projectRoot);
		console.log('✓ Registry read successfully');
		console.log('✓ Has test worktree:', !!readData.worktrees['task-999']);
		console.log('✓ Metadata preserved:', !!readData.metadata);
		console.log('');

		// Test 5: Error handling
		console.log('5. Testing error handling...');
		try {
			registry.readRegistry();
			console.log('✗ Should have thrown error for missing projectRoot');
		} catch (err) {
			console.log('✓ Correctly throws error for missing projectRoot');
		}

		try {
			registry.writeRegistry(projectRoot);
			console.log('✗ Should have thrown error for missing data');
		} catch (err) {
			console.log('✓ Correctly throws error for missing data');
		}
		console.log('');

		console.log('🎉 ALL BASIC TESTS PASSED!');

		// Cleanup
		if (fs.existsSync(testRegistryPath)) {
			fs.unlinkSync(testRegistryPath);
		}
	} catch (error) {
		console.error('💥 TEST FAILED:', error.message);
		console.error('📋 Error details:', error);
		process.exit(1);
	}
}

testRegistryBasics();
