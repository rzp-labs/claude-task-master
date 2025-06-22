#!/usr/bin/env node

/**
 * test-registry-entry-management.js
 * Test registry entry management with filesystem verification
 */

import fs from 'fs';
import path from 'path';

async function testEntryManagement() {
	console.log('=== REGISTRY ENTRY MANAGEMENT TESTS ===\n');

	const projectRoot = process.cwd();
	const registryPath = path.join(
		projectRoot,
		'.taskmaster',
		'worktree-registry.json'
	);

	try {
		// Import registry module
		const registry = await import('./modules/utils/worktree-registry.js');

		// Clean start
		if (fs.existsSync(registryPath)) {
			fs.unlinkSync(registryPath);
		}

		// Test 1: Add entry to registry
		console.log('1. Testing addToRegistry...');
		const entry1 = {
			worktreeId: 'task-100',
			taskId: '100',
			branch: 'task-100',
			path: './worktrees/task-100'
		};

		registry.addToRegistry(projectRoot, entry1);
		console.log('✓ addToRegistry completed');

		// Verify file was created and contains entry
		const fileExists = fs.existsSync(registryPath);
		console.log('✓ Registry file created:', fileExists);

		const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
		console.log('✓ Entry added to file:', !!data.worktrees['task-100']);
		console.log(
			'✓ Task ID correct:',
			data.worktrees['task-100'].taskId === '100'
		);
		console.log(
			'✓ Auto-generated timestamp:',
			!!data.worktrees['task-100'].createdAt
		);
		console.log('');

		// Test 2: Add second entry
		console.log('2. Testing multiple entries...');
		const entry2 = {
			worktreeId: 'task-101',
			taskId: '101',
			branch: 'task-101',
			path: './worktrees/task-101',
			createdAt: '2025-01-01T00:00:00.000Z'
		};

		registry.addToRegistry(projectRoot, entry2);
		console.log('✓ Second entry added');

		// Verify both entries exist
		const updatedData = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
		console.log(
			'✓ First entry still exists:',
			!!updatedData.worktrees['task-100']
		);
		console.log('✓ Second entry exists:', !!updatedData.worktrees['task-101']);
		console.log(
			'✓ Custom timestamp preserved:',
			updatedData.worktrees['task-101'].createdAt === '2025-01-01T00:00:00.000Z'
		);
		console.log('');

		// Test 3: findByTaskId
		console.log('3. Testing findByTaskId...');
		const found100 = registry.findByTaskId(projectRoot, '100');
		console.log('✓ Found task 100:', !!found100);
		console.log('✓ Correct worktree ID:', found100.worktreeId === 'task-100');
		console.log('✓ Correct path:', found100.path === './worktrees/task-100');

		const found101 = registry.findByTaskId(projectRoot, '101');
		console.log('✓ Found task 101:', !!found101);

		const foundNonexistent = registry.findByTaskId(projectRoot, '999');
		console.log('✓ Returns null for nonexistent:', foundNonexistent === null);
		console.log('');

		// Test 4: removeFromRegistry
		console.log('4. Testing removeFromRegistry...');
		registry.removeFromRegistry(projectRoot, 'task-100');
		console.log('✓ removeFromRegistry completed');

		// Verify removal
		const afterRemoval = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
		console.log(
			'✓ Entry removed from file:',
			!afterRemoval.worktrees['task-100']
		);
		console.log(
			'✓ Other entry still exists:',
			!!afterRemoval.worktrees['task-101']
		);

		// Verify through findByTaskId
		const notFound = registry.findByTaskId(projectRoot, '100');
		console.log(
			'✓ findByTaskId returns null after removal:',
			notFound === null
		);
		console.log('');

		// Test 5: Error handling
		console.log('5. Testing error handling...');

		// Missing parameters
		try {
			registry.addToRegistry();
			console.log('✗ Should have thrown error');
		} catch (err) {
			console.log('✓ Throws error for missing projectRoot');
		}

		try {
			registry.addToRegistry(projectRoot, { taskId: '200' });
			console.log('✗ Should have thrown error');
		} catch (err) {
			console.log('✓ Throws error for incomplete entry');
		}

		// Remove non-existent
		try {
			registry.removeFromRegistry(projectRoot, 'task-999');
			console.log('✗ Should have thrown error');
		} catch (err) {
			console.log('✓ Throws error for non-existent worktree');
		}

		// Missing taskId for find
		try {
			registry.findByTaskId(projectRoot);
			console.log('✗ Should have thrown error');
		} catch (err) {
			console.log('✓ Throws error for missing taskId');
		}
		console.log('');

		console.log('🎉 ALL ENTRY MANAGEMENT TESTS PASSED!');

		// Clean up on success
		if (fs.existsSync(registryPath)) {
			fs.unlinkSync(registryPath);
		}
	} catch (error) {
		console.error('💥 TEST FAILED:', error.message);
		console.error('📋 Full error:', error);

		// Leave artifacts for debugging
		console.error('📋 Registry file left for investigation');
		process.exit(1);
	}
}

testEntryManagement();
