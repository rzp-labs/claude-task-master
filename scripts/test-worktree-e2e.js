#!/usr/bin/env node

/**
 * test-worktree-e2e.js
 * End-to-end test combining Tasks 2, 3, 4, and 5 functionality
 * Tests integration of worktree-manager, worktree-registry, git-utils, and feature toggles
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testWorktreeE2E() {
	console.log('=== WORKTREE END-TO-END INTEGRATION TEST ===\n');

	const projectRoot = process.cwd();
	const statePath = path.join(projectRoot, '.taskmaster', 'state.json');
	const configPath = path.join(projectRoot, '.taskmaster', 'config.json');
	const backupConfigPath = `${configPath}.e2e-backup`;

	let testFailed = false;

	try {
		// Import all modules
		console.log('1. Importing modules...');
		const worktreeManager = await import('./modules/utils/worktree-manager.js');
		const worktreeStateManager = await import(
			'./modules/utils/worktree-state-manager.js'
		);
		const gitUtils = await import('./modules/utils/git-utils.js');
		const configManager = await import('./modules/config-manager.js');
		console.log('✓ All modules imported successfully\n');

		// Cleanup any existing test artifacts
		if (fs.existsSync(statePath)) {
			// Reset state to clean state for testing
			const currentState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
			const cleanState = {
				...currentState,
				worktrees: {}
			};
			fs.writeFileSync(statePath, JSON.stringify(cleanState, null, 2));
		}
		if (fs.existsSync(path.join(projectRoot, 'worktrees'))) {
			// Remove any existing test worktrees
			try {
				await worktreeManager.removeWorktree(projectRoot, 'task-101');
			} catch (e) {
				// Ignore if doesn't exist
			}
			try {
				await worktreeManager.removeWorktree(projectRoot, 'task-102');
			} catch (e) {
				// Ignore if doesn't exist
			}
		}

		// Backup original config for feature toggle tests
		if (fs.existsSync(configPath)) {
			fs.copyFileSync(configPath, backupConfigPath);
		}

		// Test 1: Feature toggle disabled state (Task 5)
		console.log('2. Testing feature toggle disabled state...');

		// Ensure feature starts disabled for this test
		const originalConfig = configManager.getConfig(projectRoot);
		const disabledConfig = {
			...originalConfig,
			features: { worktrees: false }
		};
		configManager.writeConfig(disabledConfig, projectRoot);

		// Verify feature is now disabled
		if (configManager.isWorktreesEnabled(projectRoot)) {
			throw new Error('Failed to disable worktrees for testing');
		}

		// Test that worktree functions are blocked when disabled
		try {
			await worktreeManager.createWorktree(projectRoot, '101', 'main');
			throw new Error('createWorktree should be blocked when disabled');
		} catch (error) {
			if (!error.message.includes('Worktrees are disabled')) {
				throw new Error(`Unexpected error: ${error.message}`);
			}
		}

		try {
			await worktreeManager.listWorktrees(projectRoot);
			throw new Error('listWorktrees should be blocked when disabled');
		} catch (error) {
			if (!error.message.includes('Worktrees are disabled')) {
				throw new Error(`Unexpected error: ${error.message}`);
			}
		}

		console.log('✓ Feature toggle correctly blocks operations when disabled\n');

		// Test 2: Enable feature toggle for remaining tests (Task 5)
		console.log('3. Enabling worktree feature for integration tests...');

		const currentConfig = configManager.getConfig(projectRoot);
		const enabledConfig = {
			...currentConfig,
			features: { worktrees: true }
		};

		const writeSuccess = configManager.writeConfig(enabledConfig, projectRoot);
		if (!writeSuccess) {
			throw new Error('Failed to enable worktree feature');
		}

		// Verify feature is now enabled
		if (!configManager.isWorktreesEnabled(projectRoot)) {
			throw new Error('Feature should be enabled after config write');
		}

		console.log('✓ Worktree feature enabled for integration testing\n');

		// Test 3: Git version validation (Task 4)
		console.log('4. Testing Git version validation...');
		await gitUtils.validateGitVersion(projectRoot);
		console.log('✓ Git version is compatible with worktrees\n');

		// Test 4: Create first worktree (Task 2 + Task 3)
		console.log('5. Creating first worktree (task-101)...');
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

		// Test 5: Verify state integration (Task 3)
		console.log('✓ Testing state integration...');
		const worktreesData = worktreeStateManager.readWorktreeState(projectRoot);
		const worktree1Entry = worktreesData['task-101'];

		if (!worktree1Entry) {
			throw new Error('Worktree not found in state');
		}
		if (worktree1Entry.taskId !== '101') {
			throw new Error('State entry has incorrect taskId');
		}
		if (worktree1Entry.branchName !== 'task-101') {
			throw new Error('State entry has incorrect branchName');
		}
		console.log('✓ State integration working correctly');

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

		// Test 8: State find function (Task 3)
		console.log('✓ Testing state find function...');
		const currentWorktreesData =
			worktreeStateManager.readWorktreeState(projectRoot);
		const foundWorktree = currentWorktreesData['task-101'];
		if (!foundWorktree || foundWorktree.taskId !== '101') {
			throw new Error('State lookup not working correctly');
		}
		console.log('✓ State find function working correctly');

		// Test 9: Remove first worktree (Task 2 + Task 3)
		console.log('✓ Testing worktree removal...');
		const removeResult = await worktreeManager.removeWorktree(
			projectRoot,
			'task-101'
		);
		console.log('✓ First worktree removed successfully');

		// Verify filesystem removal
		if (fs.existsSync(worktree1Path)) {
			throw new Error('Worktree directory still exists after removal');
		}
		console.log('✓ Worktree directory removed from filesystem');

		// Verify state removal
		const updatedWorktrees =
			worktreeStateManager.readWorktreeState(projectRoot);
		if (updatedWorktrees['task-101']) {
			throw new Error('Worktree still exists in state after removal');
		}
		console.log('✓ Worktree removed from state');

		// Test 10: Verify second worktree still exists
		const finalWorktrees = worktreeStateManager.readWorktreeState(projectRoot);
		const remainingWorktree = finalWorktrees['task-102'];
		if (!remainingWorktree) {
			throw new Error('Second worktree incorrectly removed from state');
		}
		console.log('✓ Second worktree correctly preserved');

		// Test 11: CLI Command Integration (Task 6)
		console.log('✓ Testing CLI command integration...');
		const cliCmd = 'node scripts/dev.js';

		// Test CLI commands work with feature toggle enabled
		const { stdout: cliStatusOutput } = await execAsync(
			`${cliCmd} worktree-status`,
			{
				cwd: projectRoot
			}
		);
		if (!cliStatusOutput.includes('Not in a worktree')) {
			throw new Error('CLI worktree-status should detect main repo context');
		}

		const { stdout: cliListOutput } = await execAsync(
			`${cliCmd} worktree-list`,
			{
				cwd: projectRoot
			}
		);
		if (!cliListOutput.includes('task-102')) {
			throw new Error('CLI worktree-list should show existing worktree');
		}

		// Test CLI integrates with feature toggle disabled state
		const cliDisabledConfig = {
			...currentConfig,
			features: { worktrees: false }
		};
		configManager.writeConfig(cliDisabledConfig, projectRoot);

		try {
			await execAsync(`${cliCmd} worktree-create --task 103`, {
				cwd: projectRoot,
				timeout: 10000
			});
			throw new Error('CLI commands should be blocked when feature disabled');
		} catch (error) {
			if (
				!error.stderr?.includes('disabled') &&
				!error.stdout?.includes('disabled')
			) {
				throw new Error('CLI should show feature disabled error');
			}
		}

		// Re-enable for cleanup
		configManager.writeConfig(enabledConfig, projectRoot);
		console.log(
			'✓ CLI commands integrate correctly with feature toggles and core functions'
		);

		// Cleanup
		console.log('\n6. Cleaning up test artifacts...');
		await worktreeManager.removeWorktree(projectRoot, 'task-102');
		// Reset state back to clean state
		if (fs.existsSync(statePath)) {
			const currentState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
			const cleanState = {
				...currentState,
				worktrees: {}
			};
			fs.writeFileSync(statePath, JSON.stringify(cleanState, null, 2));
		}

		// Restore original config
		if (fs.existsSync(backupConfigPath)) {
			fs.copyFileSync(backupConfigPath, configPath);
			fs.unlinkSync(backupConfigPath);
		}

		console.log('✓ Cleanup completed\n');

		console.log('🎉 ALL END-TO-END TESTS PASSED!');
		console.log('✓ Task 2 (worktree-manager): create, remove, list functions');
		console.log('✓ Task 3 (worktree-state): State management and integration');
		console.log('✓ Task 4 (git-utils): worktree detection and info extraction');
		console.log(
			'✓ Task 5 (feature-toggle): disabled/enabled state enforcement'
		);
		console.log(
			'✓ Task 6 (CLI-commands): CLI integration with core functions and feature toggles'
		);
		console.log('✓ Integration: All components work together seamlessly');
	} catch (error) {
		testFailed = true;
		console.error('💥 E2E TEST FAILED:', error.message);
		console.error('📋 Full error:', error);

		// Leave artifacts for investigation
		console.error('\n📋 Test artifacts preserved for debugging:');
		console.error('- State file:', statePath);
		console.error(
			'- Worktrees directory:',
			path.join(projectRoot, 'worktrees')
		);
		console.error('- Config backup:', backupConfigPath);
		console.error('- Check filesystem state manually');

		// Restore original config on failure
		if (fs.existsSync(backupConfigPath)) {
			try {
				fs.copyFileSync(backupConfigPath, configPath);
				console.error('- Original config restored');
			} catch (restoreError) {
				console.error('- Failed to restore config:', restoreError.message);
			}
		}

		process.exit(1);
	}
}

testWorktreeE2E();
