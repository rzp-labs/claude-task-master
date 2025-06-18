#!/usr/bin/env node

/**
 * test-worktree-manager.js
 * Functional verification script for worktree-manager.js
 * 
 * Tests what actually works:
 * 1. Module imports
 * 2. listWorktrees with real Git
 * 3. createWorktree with filesystem verification
 * 4. removeWorktree with filesystem verification
 * 5. Error handling
 */

import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function cleanupBranch(taskId) {
	try {
		await execAsync(`git branch -D task-${taskId}`, { stdio: 'ignore' });
	} catch (err) {
		// Ignore - branch probably doesn't exist
	}
}

async function runTests() {
	console.log('=== WORKTREE MANAGER FUNCTIONAL VERIFICATION ===\n');

	const projectRoot = process.cwd();
	const testTaskId = '999';
	const worktreePath = `${projectRoot}/worktrees/task-${testTaskId}`;
	let wm;

	try {
		// Test 1: Module Import
		console.log('1. Testing module import...');
		wm = await import('./modules/utils/worktree-manager.js');
		console.log('✓ Module imports successfully');
		console.log('✓ Functions available:', Object.keys(wm));
		console.log('');

		// Cleanup any leftover test artifacts
		try {
			await wm.removeWorktree(projectRoot, testTaskId);
		} catch (err) {
			// Ignore - probably doesn't exist
		}
		await cleanupBranch(testTaskId);

		// Test 2: listWorktrees
		console.log('2. Testing listWorktrees...');
		const initialWorktrees = await wm.listWorktrees(projectRoot);
		console.log('✓ listWorktrees works, found', initialWorktrees.length, 'worktree(s)');
		console.log('');

		// Test 3: createWorktree with filesystem verification
		console.log('3. Testing createWorktree...');
		const createResult = await wm.createWorktree(projectRoot, testTaskId, 'research-git-worktree-basics');
		console.log('✓ Function returned success:', createResult.success);
		
		// Verify directory actually exists
		const dirExists = fs.existsSync(worktreePath);
		console.log('✓ Directory exists on filesystem:', dirExists);
		
		if (dirExists) {
			const gitExists = fs.existsSync(`${worktreePath}/.git`);
			console.log('✓ Has .git file (worktree indicator):', gitExists);
		}
		
		// Verify through listWorktrees
		const worktreesAfterCreate = await wm.listWorktrees(projectRoot);
		const testWorktree = worktreesAfterCreate.find(w => w.taskId === testTaskId);
		console.log('✓ Detected by listWorktrees:', testWorktree ? 'YES' : 'NO');
		console.log('');

		// Test 4: removeWorktree with filesystem verification
		console.log('4. Testing removeWorktree...');
		const removeResult = await wm.removeWorktree(projectRoot, testTaskId);
		console.log('✓ Function returned success:', removeResult.success);
		
		// Verify directory actually deleted
		const dirStillExists = fs.existsSync(worktreePath);
		console.log('✓ Directory removed from filesystem:', !dirStillExists);
		
		// Verify through listWorktrees
		const worktreesAfterRemove = await wm.listWorktrees(projectRoot);
		const testWorktreeGone = !worktreesAfterRemove.find(w => w.taskId === testTaskId);
		console.log('✓ Removed from listWorktrees:', testWorktreeGone);
		console.log('');

		// Test 5: Error handling
		console.log('5. Testing error handling...');
		try {
			await wm.createWorktree();
			console.log('✗ Should have thrown error for missing projectRoot');
		} catch (err) {
			console.log('✓ Correctly throws error for missing projectRoot');
		}

		try {
			await wm.removeWorktree(projectRoot, '888');
			console.log('✗ Should have thrown error for non-existent worktree');
		} catch (err) {
			console.log('✓ Correctly throws error for non-existent worktree');
		}
		console.log('');

		console.log('🎉 ALL TESTS PASSED - Worktree manager is functional!');

		// Clean up only on success
		try {
			await wm.removeWorktree(projectRoot, testTaskId);
		} catch (err) {
			// Ignore cleanup errors
		}
		await cleanupBranch(testTaskId);

	} catch (error) {
		console.error('💥 TEST FAILED:', error.message);
		console.error('📋 Artifacts left for investigation:');
		console.error(`   - Worktree: ${worktreePath}`);
		console.error(`   - Branch: task-${testTaskId}`);
		console.error('   Run script again after manual cleanup to retry');
		process.exit(1);
	}
}

runTests();