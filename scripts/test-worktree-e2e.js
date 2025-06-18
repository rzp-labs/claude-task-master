#!/usr/bin/env node

/**
 * test-worktree-e2e.js
 * End-to-end test combining Tasks 2, 3, and 4 functionality
 * Tests integration of worktree-manager, worktree-registry, and git-utils
 */

import fs from 'fs';
import path from 'path';

async function testWorktreeE2E() {
	console.log('=== WORKTREE END-TO-END INTEGRATION TEST ===\n');

	const projectRoot = process.cwd();
	const registryPath = path.join(
		projectRoot,
		'.taskmaster',
		'worktree-registry.json'
	);

	let testFailed = false;

	try {
		// Import all modules
		console.log('1. Importing modules...');
		const worktreeManager = await import('./modules/utils/worktree-manager.js');
		const worktreeRegistry = await import(
			'./modules/utils/worktree-registry.js'
		);
		const gitUtils = await import('./modules/utils/git-utils.js');
		console.log('✓ All modules imported successfully\n');

		// Cleanup any existing test artifacts
		if (fs.existsSync(registryPath)) {
			fs.unlinkSync(registryPath);
		}
		if (fs.existsSync(path.join(projectRoot, 'worktrees'))) {
			// Remove any existing test worktrees
			try {
				await worktreeManager.removeWorktree(projectRoot, '101');
			} catch (e) {
				// Ignore if doesn't exist
			}
			try {
				await worktreeManager.removeWorktree(projectRoot, '102');
			} catch (e) {
				// Ignore if doesn't exist
			}
		}

		// Test 1: Git version validation (Task 4)
		console.log('2. Testing Git version validation...');
		await gitUtils.validateGitVersion(projectRoot);
		console.log('✓ Git version is compatible with worktrees\n');

		// Test 2: Create first worktree (Task 2 + Task 3)
		console.log('3. Creating first worktree (task-101)...');
		const worktree1 = await worktreeManager.createWorktree(
			projectRoot,
			'101',
			'main'
		);
		console.log('✓ Worktree created:', worktree1.worktreePath);

		// Verify filesystem creation
		const worktree1Path = path.join(projectRoot, 'worktrees', 'task-101');
		if (!fs.existsSync(worktree1Path)) {
			throw new Error('Worktree directory not created on filesystem');
		}
		console.log('✓ Worktree directory exists on filesystem');

		// Test 3: Verify worktree detection (Task 4)
		console.log('✓ Testing worktree detection...');
		const isMainWorktree = await gitUtils.isWorktree(projectRoot);
		const isWorktree1 = await gitUtils.isWorktree(worktree1Path);

		if (isMainWorktree !== false) {
			throw new Error('Main repo incorrectly detected as worktree');
		}
		if (isWorktree1 !== true) {
			throw new Error('Worktree not detected correctly');
		}
		console.log('✓ Worktree detection working correctly');

		// Test 4: Get worktree info (Task 4)
		const worktreeInfo = await gitUtils.getWorktreeInfo(worktree1Path);
		if (!worktreeInfo) {
			throw new Error('getWorktreeInfo returned null for valid worktree');
		}
		if (worktreeInfo.branch !== 'task-101') {
			throw new Error(
				`Expected branch 'task-101', got '${worktreeInfo.branch}'`
			);
		}
		if (worktreeInfo.mainWorktreePath !== projectRoot) {
			throw new Error('Main worktree path incorrect');
		}
		console.log('✓ Worktree info extraction working correctly');

		// Test 5: Verify registry integration (Task 3)
		console.log('✓ Testing registry integration...');
		const registryData = worktreeRegistry.readRegistry(projectRoot);
		const worktree1Entry = registryData.worktrees['task-101'];

		if (!worktree1Entry) {
			throw new Error('Worktree not found in registry');
		}
		if (worktree1Entry.taskId !== '101') {
			throw new Error('Registry entry has incorrect taskId');
		}
		if (worktree1Entry.branch !== 'task-101') {
			throw new Error('Registry entry has incorrect branch');
		}
		console.log('✓ Registry integration working correctly');

		// Test 6: Create second worktree to test multiple entries
		console.log('✓ Creating second worktree (task-102)...');
		const worktree2 = await worktreeManager.createWorktree(
			projectRoot,
			'102',
			'main'
		);
		console.log('✓ Second worktree created:', worktree2.worktreePath);

		// Test 7: List worktrees (Task 2)
		console.log('✓ Testing worktree listing...');
		const worktreeList = await worktreeManager.listWorktrees(projectRoot);

		if (!Array.isArray(worktreeList)) {
			throw new Error('listWorktrees did not return array');
		}

		const taskMasterWorktrees = worktreeList.filter(
			(wt) => wt.isTaskMasterWorktree
		);
		if (taskMasterWorktrees.length !== 2) {
			throw new Error(
				`Expected 2 Task Master worktrees, found ${taskMasterWorktrees.length}`
			);
		}
		console.log('✓ Worktree listing working correctly');

		// Test 8: Registry find function (Task 3)
		console.log('✓ Testing registry find function...');
		const foundWorktree = worktreeRegistry.findByTaskId(projectRoot, '101');
		if (!foundWorktree || foundWorktree.taskId !== '101') {
			throw new Error('findByTaskId not working correctly');
		}
		console.log('✓ Registry find function working correctly');

		// Test 9: Remove first worktree (Task 2 + Task 3)
		console.log('✓ Testing worktree removal...');
		const removeResult = await worktreeManager.removeWorktree(
			projectRoot,
			'101'
		);
		console.log('✓ First worktree removed successfully');

		// Verify filesystem removal
		if (fs.existsSync(worktree1Path)) {
			throw new Error('Worktree directory still exists after removal');
		}
		console.log('✓ Worktree directory removed from filesystem');

		// Verify registry removal
		const updatedRegistry = worktreeRegistry.readRegistry(projectRoot);
		if (updatedRegistry.worktrees['task-101']) {
			throw new Error('Worktree still exists in registry after removal');
		}
		console.log('✓ Worktree removed from registry');

		// Test 10: Verify second worktree still exists
		const remainingWorktree = worktreeRegistry.findByTaskId(projectRoot, '102');
		if (!remainingWorktree) {
			throw new Error('Second worktree incorrectly removed from registry');
		}
		console.log('✓ Second worktree correctly preserved');

		// Cleanup
		console.log('\n4. Cleaning up test artifacts...');
		await worktreeManager.removeWorktree(projectRoot, '102');
		if (fs.existsSync(registryPath)) {
			fs.unlinkSync(registryPath);
		}
		console.log('✓ Cleanup completed\n');

		console.log('🎉 ALL END-TO-END TESTS PASSED!');
		console.log('✓ Task 2 (worktree-manager): create, remove, list functions');
		console.log(
			'✓ Task 3 (worktree-registry): CRUD operations and integration'
		);
		console.log('✓ Task 4 (git-utils): worktree detection and info extraction');
		console.log('✓ Integration: All components work together seamlessly');
	} catch (error) {
		testFailed = true;
		console.error('💥 E2E TEST FAILED:', error.message);
		console.error('📋 Full error:', error);

		// Leave artifacts for investigation
		console.error('\n📋 Test artifacts preserved for debugging:');
		console.error('- Registry file:', registryPath);
		console.error(
			'- Worktrees directory:',
			path.join(projectRoot, 'worktrees')
		);
		console.error('- Check filesystem state manually');

		process.exit(1);
	}
}

testWorktreeE2E();
