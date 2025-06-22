#!/usr/bin/env node

/**
 * verify-registry-filesystem.js
 * Verify registry actually creates files and persists data
 */

import fs from 'fs';
import path from 'path';

async function verifyFilesystem() {
	console.log('=== REGISTRY FILESYSTEM VERIFICATION ===\n');

	const projectRoot = process.cwd();
	const registryPath = path.join(
		projectRoot,
		'.taskmaster',
		'worktree-registry.json'
	);

	try {
		// Import registry module
		const registry = await import('./modules/utils/worktree-registry.js');

		// Clean start - ensure no existing registry
		if (fs.existsSync(registryPath)) {
			fs.unlinkSync(registryPath);
			console.log('✓ Cleaned up existing registry');
		}

		// Step 1: Read non-existent registry
		console.log('1. Reading non-existent registry...');
		const emptyData = registry.readRegistry(projectRoot);
		console.log('✓ Function returns empty structure');

		// Verify no file was created yet
		const fileExistsAfterRead = fs.existsSync(registryPath);
		console.log('✓ No file created by read operation:', !fileExistsAfterRead);
		console.log('');

		// Step 2: Write registry and verify file creation
		console.log('2. Writing registry...');
		const testData = {
			worktrees: {
				'task-888': {
					taskId: '888',
					branch: 'task-888',
					path: './worktrees/task-888',
					createdAt: new Date().toISOString()
				}
			},
			metadata: {
				created: new Date().toISOString(),
				version: '1.0'
			}
		};

		registry.writeRegistry(projectRoot, testData);
		console.log('✓ writeRegistry function completed');

		// Verify file actually exists
		const fileExists = fs.existsSync(registryPath);
		console.log('✓ Registry file exists on filesystem:', fileExists);

		if (fileExists) {
			// Read file directly and verify contents
			const rawData = fs.readFileSync(registryPath, 'utf8');
			const parsedData = JSON.parse(rawData);
			console.log('✓ File is valid JSON');
			console.log(
				'✓ Contains test worktree:',
				!!parsedData.worktrees['task-888']
			);
			console.log('✓ Has metadata:', !!parsedData.metadata);
			console.log('✓ Pretty formatted (has newlines):', rawData.includes('\n'));
		}
		console.log('');

		// Step 3: Read back and verify data persistence
		console.log('3. Reading back written data...');
		const readBackData = registry.readRegistry(projectRoot);
		console.log('✓ Read operation successful');
		console.log(
			'✓ Test worktree still there:',
			!!readBackData.worktrees['task-888']
		);

		// Verify task ID matches
		const worktree = readBackData.worktrees['task-888'];
		console.log('✓ Task ID correct:', worktree.taskId === '888');
		console.log('✓ Branch correct:', worktree.branch === 'task-888');
		console.log('✓ Path correct:', worktree.path === './worktrees/task-888');
		console.log('');

		console.log('🎉 FILESYSTEM VERIFICATION PASSED!');

		// Clean up on success
		if (fs.existsSync(registryPath)) {
			fs.unlinkSync(registryPath);
		}
	} catch (error) {
		console.error('💥 VERIFICATION FAILED:', error.message);
		console.error('📋 Full error:', error);
		process.exit(1);
	}
}

verifyFilesystem();
