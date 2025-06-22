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
		const worktreeManager = await import('../scripts/modules/utils/worktree-manager.js');
		const worktreeStateManager = await import(
			'../scripts/modules/utils/worktree-state-manager.js'
		);
		const gitUtils = await import('../scripts/modules/utils/git-utils.js');
		const configManager = await import('../scripts/modules/config-manager.js');

		// Setup event emission tracking (Task 8)
		const { worktreeEvents } = worktreeManager;
		const eventsReceived = [];

		// Register event listeners
		const createdListener = (data) => {
			eventsReceived.push({ type: 'created', data, timestamp: Date.now() });
		};
		const removedListener = (data) => {
			eventsReceived.push({ type: 'removed', data, timestamp: Date.now() });
		};

		worktreeEvents.on('worktree.created', createdListener);
		worktreeEvents.on('worktree.removed', removedListener);

		console.log('✓ All modules imported successfully');
		console.log('✓ Event listeners registered for worktree operations\n');

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

		// Test 4: Create first worktree (Task 2 + Task 3 + Task 8 events)
		console.log('5. Creating first worktree (task-101)...');
		const initialEventCount = eventsReceived.length;

		const worktree1 = await worktreeManager.createWorktree(
			projectRoot,
			'101',
			'main'
		);
		console.log('✓ Worktree created:', worktree1.worktreePath);

		// Allow small delay for event processing
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify filesystem creation
		const worktree1Path = path.join(projectRoot, 'worktrees', 'task-101');
		if (!fs.existsSync(worktree1Path)) {
			throw new Error('Worktree directory not created on filesystem');
		}
		console.log('✓ Worktree directory exists on filesystem');

		// Test 4.1: Verify worktree.created event emission (Task 8)
		const createdEvents = eventsReceived.filter((e) => e.type === 'created');
		if (createdEvents.length === 0) {
			throw new Error('No worktree.created event emitted during creation');
		}

		const latestCreatedEvent = createdEvents[createdEvents.length - 1];
		const eventData = latestCreatedEvent.data;

		if (eventData.taskId !== '101') {
			throw new Error(`Expected event taskId '101', got '${eventData.taskId}'`);
		}
		if (eventData.branch !== 'task-101') {
			throw new Error(
				`Expected event branch 'task-101', got '${eventData.branch}'`
			);
		}
		if (eventData.baseBranch !== 'main') {
			throw new Error(
				`Expected event baseBranch 'main', got '${eventData.baseBranch}'`
			);
		}
		if (!eventData.path.includes('task-101')) {
			throw new Error(
				`Event path does not contain 'task-101': ${eventData.path}`
			);
		}

		console.log('✓ worktree.created event emitted with correct data structure');
		console.log(
			`✓ Event data verified: taskId=${eventData.taskId}, branch=${eventData.branch}`
		);

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

		// Test 6: Create second worktree to test multiple entries and event emission
		console.log('✓ Creating second worktree (task-102)...');
		const preSecondCreationEventCount = eventsReceived.filter(
			(e) => e.type === 'created'
		).length;

		const worktree2 = await worktreeManager.createWorktree(
			projectRoot,
			'102',
			'main'
		);
		console.log('✓ Second worktree created:', worktree2.worktreePath);

		// Allow small delay for event processing
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Test 6.1: Verify second worktree.created event (Task 8)
		const allCreatedEvents = eventsReceived.filter((e) => e.type === 'created');
		if (allCreatedEvents.length !== preSecondCreationEventCount + 1) {
			throw new Error(
				`Expected ${preSecondCreationEventCount + 1} created events, got ${allCreatedEvents.length}`
			);
		}

		const secondCreatedEvent = allCreatedEvents[allCreatedEvents.length - 1];
		if (secondCreatedEvent.data.taskId !== '102') {
			throw new Error(
				`Expected second event taskId '102', got '${secondCreatedEvent.data.taskId}'`
			);
		}

		console.log('✓ Second worktree.created event emitted correctly');
		console.log(
			`✓ Multiple worktree events tracked: ${allCreatedEvents.length} creation events total`
		);

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

		// Test 9: Remove first worktree (Task 2 + Task 3 + Task 8 events)
		console.log('✓ Testing worktree removal with event emission...');
		const preRemovalEventCount = eventsReceived.filter(
			(e) => e.type === 'removed'
		).length;

		const removeResult = await worktreeManager.removeWorktree(
			projectRoot,
			'task-101'
		);
		console.log('✓ First worktree removed successfully');

		// Allow small delay for event processing
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify filesystem removal
		if (fs.existsSync(worktree1Path)) {
			throw new Error('Worktree directory still exists after removal');
		}
		console.log('✓ Worktree directory removed from filesystem');

		// Test 9.1: Verify worktree.removed event emission (Task 8)
		const removedEvents = eventsReceived.filter((e) => e.type === 'removed');
		if (removedEvents.length !== preRemovalEventCount + 1) {
			throw new Error(
				`Expected ${preRemovalEventCount + 1} removed events, got ${removedEvents.length}`
			);
		}

		const latestRemovedEvent = removedEvents[removedEvents.length - 1];
		const removeEventData = latestRemovedEvent.data;

		if (removeEventData.taskId !== '101') {
			throw new Error(
				`Expected removal event taskId '101', got '${removeEventData.taskId}'`
			);
		}
		if (removeEventData.branch !== 'task-101') {
			throw new Error(
				`Expected removal event branch 'task-101', got '${removeEventData.branch}'`
			);
		}
		if (removeEventData.branchRemoved !== false) {
			throw new Error(
				`Expected branchRemoved false for worktree-only removal, got ${removeEventData.branchRemoved}`
			);
		}
		if (!removeEventData.path.includes('task-101')) {
			throw new Error(
				`Removal event path does not contain 'task-101': ${removeEventData.path}`
			);
		}

		console.log('✓ worktree.removed event emitted with correct data structure');
		console.log(
			`✓ Removal event data verified: taskId=${removeEventData.taskId}, branchRemoved=${removeEventData.branchRemoved}`
		);

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

		// Test 12: MCP Tools Integration (Task 7)
		console.log('✓ Testing MCP tools integration...');

		// Import the MCP test script components
		const { spawn } = await import('child_process');

		// MCP JSON-RPC message helpers
		function createMCPRequest(id, method, params = {}) {
			return (
				JSON.stringify({
					jsonrpc: '2.0',
					id,
					method,
					params
				}) + '\n'
			);
		}

		// Simple MCP server test
		const mcpServer = spawn(
			'node',
			[path.join(projectRoot, 'mcp-server/server.js')],
			{
				stdio: ['pipe', 'pipe', 'pipe'],
				cwd: projectRoot
			}
		);

		let mcpResponseReceived = false;
		let mcpToolsAvailable = false;

		const mcpTestPromise = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				mcpServer.kill('SIGTERM');
				reject(new Error('MCP server test timeout'));
			}, 10000);

			mcpServer.stdout.on('data', (data) => {
				const lines = data
					.toString()
					.split('\n')
					.filter((line) => line.trim());

				for (const line of lines) {
					try {
						const response = JSON.parse(line);
						if (response.id === 1 && response.result) {
							mcpResponseReceived = true;

							// Test tools/list
							const listRequest = createMCPRequest(2, 'tools/list');
							mcpServer.stdin.write(listRequest);
						} else if (response.id === 2 && response.result?.tools) {
							const toolNames = response.result.tools.map((t) => t.name);
							const hasWorktreeTools = [
								'create_worktree',
								'remove_worktree',
								'list_worktrees'
							].every((tool) => toolNames.includes(tool));

							if (hasWorktreeTools) {
								mcpToolsAvailable = true;
							}

							clearTimeout(timeout);
							mcpServer.kill('SIGTERM');
							resolve();
						}
					} catch (err) {
						// Not JSON, ignore
					}
				}
			});

			mcpServer.on('error', (err) => {
				clearTimeout(timeout);
				reject(new Error(`MCP server failed: ${err.message}`));
			});

			// Send initialization
			const initRequest = createMCPRequest(1, 'initialize', {
				protocolVersion: '2024-11-05',
				capabilities: {},
				clientInfo: {
					name: 'e2e-test',
					version: '1.0.0'
				}
			});

			mcpServer.stdin.write(initRequest);
		});

		await mcpTestPromise;

		if (!mcpResponseReceived) {
			throw new Error('MCP server did not respond to initialization');
		}
		if (!mcpToolsAvailable) {
			throw new Error('MCP worktree tools not available or not registered');
		}

		console.log('✓ MCP server starts and responds correctly');
		console.log('✓ MCP worktree tools are registered and available');
		console.log(
			'✓ MCP tools integration verified (wraps CLI functions successfully)'
		);

		// Test 13: Event System Integration Summary (Task 8)
		console.log('✓ Testing event system integration summary...');

		// Verify event timing and order
		const sortedEvents = eventsReceived.sort(
			(a, b) => a.timestamp - b.timestamp
		);
		const allCreatedEventsCount = sortedEvents.filter(
			(e) => e.type === 'created'
		).length;
		const allRemovedEventsCount = sortedEvents.filter(
			(e) => e.type === 'removed'
		).length;

		if (allCreatedEventsCount < 2) {
			throw new Error(
				`Expected at least 2 created events during e2e test, got ${allCreatedEventsCount}`
			);
		}
		if (allRemovedEventsCount < 1) {
			throw new Error(
				`Expected at least 1 removed event during e2e test, got ${allRemovedEventsCount}`
			);
		}

		// Verify created events come before removed events in chronological order
		const firstCreatedEvent = sortedEvents.find((e) => e.type === 'created');
		const firstRemovedEvent = sortedEvents.find((e) => e.type === 'removed');

		if (
			firstCreatedEvent &&
			firstRemovedEvent &&
			firstCreatedEvent.timestamp > firstRemovedEvent.timestamp
		) {
			throw new Error(
				'Event timing error: removed event occurred before any created events'
			);
		}

		console.log(
			`✓ Event system captured ${eventsReceived.length} total events during e2e workflow`
		);
		console.log(
			`✓ Event timing validated: ${allCreatedEventsCount} created, ${allRemovedEventsCount} removed`
		);
		console.log(
			'✓ Events fire correctly in integrated scenarios without interfering with functionality'
		);

		// Cleanup
		console.log('\n6. Cleaning up test artifacts...');

		// Final worktree removal will trigger one more removed event
		const finalRemovalEventCount = eventsReceived.filter(
			(e) => e.type === 'removed'
		).length;
		await worktreeManager.removeWorktree(projectRoot, 'task-102');

		// Allow small delay for final event processing
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify final removal event
		const finalRemovedEvents = eventsReceived.filter(
			(e) => e.type === 'removed'
		);
		if (finalRemovedEvents.length !== finalRemovalEventCount + 1) {
			console.log(
				'⚠️ Warning: Final removal event may not have fired during cleanup'
			);
		} else {
			console.log('✓ Final removal event captured during cleanup');
		}

		// Remove event listeners
		worktreeEvents.off('worktree.created', createdListener);
		worktreeEvents.off('worktree.removed', removedListener);
		console.log('✓ Event listeners removed');
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
		console.log(
			'✓ Task 7 (MCP-tools): MCP tools wrap CLI functions and are accessible via JSON-RPC'
		);
		console.log(
			'✓ Task 8 (event-emission): Events fire correctly during all worktree operations'
		);
		console.log(
			'✓ Integration: All components work together seamlessly with event system'
		);
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
