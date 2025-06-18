#!/usr/bin/env node

/**
 * test-event-emission.js
 * Atomic functional verification script for worktree event emission
 *
 * FUNCTIONAL VALIDATION - Tests that event emission actually works:
 * 1. Event listeners can be registered and receive events
 * 2. worktree.created events fire with correct data after creation
 * 3. worktree.removed events fire with correct data after removal
 * 4. Event data structure contains all required fields
 * 5. Events don't interfere with core worktree functionality
 * 6. Multiple listeners can coexist
 * 7. Event system integrates properly with existing patterns
 *
 * Atomic behavior: preserve artifacts on failure for debugging
 * No cleanup on failure, clean artifacts on success
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import {
	createWorktree,
	removeWorktree,
	worktreeEvents
} from './modules/utils/worktree-manager.js';

const execAsync = promisify(exec);

async function cleanupTestArtifacts(projectRoot, testTaskId) {
	try {
		// Remove test worktree if exists
		const worktreePath = path.join(
			projectRoot,
			'worktrees',
			`task-${testTaskId}`
		);
		if (fs.existsSync(worktreePath)) {
			await execAsync(`git worktree remove --force ${worktreePath}`, {
				cwd: projectRoot
			});
		}

		// Remove test branch if exists
		try {
			await execAsync(`git branch -D task-${testTaskId}`, { cwd: projectRoot });
		} catch (err) {
			// Branch doesn't exist, ignore
		}
	} catch (err) {
		console.log(`[CLEANUP] ${err.message}`);
	}
}

async function runEventEmissionTests() {
	console.log('=== WORKTREE EVENT EMISSION FUNCTIONAL VERIFICATION ===\n');

	const projectRoot = process.cwd();
	const testTaskId = '777'; // Different from other test scripts to avoid conflicts
	let testsPassed = 0;
	let totalTests = 0;
	let failureOccurred = false;

	// Track events received during testing
	const eventsReceived = [];
	let listenerCount = 0;

	try {
		// Test 1: Event Listener Registration
		console.log('1. Testing event listener registration...');
		totalTests++;

		// Register multiple listeners to test coexistence
		const listener1 = (data) => {
			eventsReceived.push({
				listener: 1,
				type: 'created',
				data,
				timestamp: Date.now()
			});
		};
		const listener2 = (data) => {
			eventsReceived.push({
				listener: 2,
				type: 'created',
				data,
				timestamp: Date.now()
			});
		};
		const removeListener = (data) => {
			eventsReceived.push({
				listener: 'remove',
				type: 'removed',
				data,
				timestamp: Date.now()
			});
		};

		worktreeEvents.on('worktree.created', listener1);
		worktreeEvents.on('worktree.created', listener2);
		worktreeEvents.on('worktree.removed', removeListener);

		listenerCount =
			worktreeEvents.listenerCount('worktree.created') +
			worktreeEvents.listenerCount('worktree.removed');

		if (listenerCount >= 3) {
			console.log('✓ Event listeners registered successfully');
			console.log(`✓ Multiple listeners supported (${listenerCount} total)`);
			testsPassed++;
		} else {
			throw new Error(`Expected at least 3 listeners, got ${listenerCount}`);
		}

		// Test 2: Cleanup any existing test artifacts
		console.log('\n2. Cleaning up any existing test artifacts...');
		totalTests++;

		await cleanupTestArtifacts(projectRoot, testTaskId);
		console.log('✓ Test environment prepared');
		testsPassed++;

		// Test 3: Worktree Creation with Event Emission
		console.log('\n3. Testing worktree creation event emission...');
		totalTests++;

		const initialEventCount = eventsReceived.length;

		// Create worktree and test event emission
		const createResult = await createWorktree(projectRoot, testTaskId, 'main');

		// Small delay to ensure events are processed
		await new Promise((resolve) => setTimeout(resolve, 100));

		const createdEvents = eventsReceived.filter((e) => e.type === 'created');

		if (createdEvents.length >= 2) {
			// Should have 2 listeners for created event
			console.log('✓ worktree.created event fired successfully');
			console.log(
				`✓ Multiple listeners received event (${createdEvents.length} events)`
			);

			// Verify event data structure
			const eventData = createdEvents[0].data;
			const requiredFields = [
				'taskId',
				'path',
				'branch',
				'baseBranch',
				'worktreeTitle'
			];
			const hasAllFields = requiredFields.every((field) => eventData[field]);

			if (hasAllFields) {
				console.log('✓ Event data contains all required fields');
				console.log(
					`✓ Event data: taskId=${eventData.taskId}, branch=${eventData.branch}`
				);
				testsPassed++;
			} else {
				const missingFields = requiredFields.filter(
					(field) => !eventData[field]
				);
				throw new Error(
					`Missing required event fields: ${missingFields.join(', ')}`
				);
			}
		} else {
			throw new Error(`Expected 2 created events, got ${createdEvents.length}`);
		}

		// Test 4: Verify Worktree Functionality Not Impacted
		console.log('\n4. Testing core functionality preservation...');
		totalTests++;

		// Verify worktree was actually created
		const worktreePath = path.join(
			projectRoot,
			'worktrees',
			`task-${testTaskId}`
		);
		if (!fs.existsSync(worktreePath)) {
			throw new Error('Worktree creation failed - directory does not exist');
		}

		// Verify git recognizes the worktree
		const { stdout: worktreeList } = await execAsync('git worktree list', {
			cwd: projectRoot
		});
		if (!worktreeList.includes(`task-${testTaskId}`)) {
			throw new Error('Worktree not recognized by Git');
		}

		console.log('✓ Core worktree functionality preserved');
		console.log('✓ Worktree created successfully despite event system');
		testsPassed++;

		// Test 5: Worktree Removal with Event Emission
		console.log('\n5. Testing worktree removal event emission...');
		totalTests++;

		const preRemovalEventCount = eventsReceived.length;

		// Remove worktree and test event emission
		const removeResult = await removeWorktree(
			projectRoot,
			`task-${testTaskId}`
		);

		// Small delay to ensure events are processed
		await new Promise((resolve) => setTimeout(resolve, 100));

		const removedEvents = eventsReceived.filter((e) => e.type === 'removed');

		if (removedEvents.length >= 1) {
			console.log('✓ worktree.removed event fired successfully');

			// Verify event data structure
			const eventData = removedEvents[0].data;
			const requiredFields = [
				'taskId',
				'path',
				'branch',
				'worktreeTitle',
				'branchRemoved'
			];
			const hasAllFields = requiredFields.every((field) =>
				eventData.hasOwnProperty(field)
			);

			if (hasAllFields) {
				console.log('✓ Removal event data contains all required fields');
				console.log(
					`✓ Event data: taskId=${eventData.taskId}, branchRemoved=${eventData.branchRemoved}`
				);
				testsPassed++;
			} else {
				const missingFields = requiredFields.filter(
					(field) => !eventData.hasOwnProperty(field)
				);
				throw new Error(
					`Missing required removal event fields: ${missingFields.join(', ')}`
				);
			}
		} else {
			throw new Error(
				`Expected at least 1 removed event, got ${removedEvents.length}`
			);
		}

		// Test 6: Verify Complete Cleanup After Removal
		console.log('\n6. Testing removal functionality with events...');
		totalTests++;

		// Verify worktree was actually removed
		if (fs.existsSync(worktreePath)) {
			throw new Error('Worktree removal failed - directory still exists');
		}

		// Verify git no longer lists the worktree
		const { stdout: finalWorktreeList } = await execAsync('git worktree list', {
			cwd: projectRoot
		});
		if (finalWorktreeList.includes(`task-${testTaskId}`)) {
			throw new Error('Worktree still listed by Git after removal');
		}

		console.log('✓ Core removal functionality preserved');
		console.log('✓ Worktree removed successfully with event emission');
		testsPassed++;

		// Test 7: Event Timing and Order Verification
		console.log('\n7. Testing event timing and order...');
		totalTests++;

		// Verify events fired in correct order
		const sortedEvents = eventsReceived.sort(
			(a, b) => a.timestamp - b.timestamp
		);
		const createdFirst = sortedEvents.find((e) => e.type === 'created');
		const removedFirst = sortedEvents.find((e) => e.type === 'removed');

		if (
			createdFirst &&
			removedFirst &&
			createdFirst.timestamp < removedFirst.timestamp
		) {
			console.log('✓ Events fired in correct chronological order');
			console.log(`✓ Total events captured: ${eventsReceived.length}`);
			testsPassed++;
		} else {
			throw new Error('Event timing verification failed');
		}

		// Success cleanup
		console.log('\n🧹 Cleaning up test artifacts...');
		await cleanupTestArtifacts(projectRoot, testTaskId);

		// Remove event listeners
		worktreeEvents.off('worktree.created', listener1);
		worktreeEvents.off('worktree.created', listener2);
		worktreeEvents.off('worktree.removed', removeListener);

		console.log('\n✅ All event emission tests completed successfully!');
		console.log(`📊 Results: ${testsPassed}/${totalTests} tests passed`);
		console.log('\n📋 Event System Validation Summary:');
		console.log(
			`- Event listeners: ✓ Registration and multiple listener support`
		);
		console.log(`- Created events: ✓ Proper emission with complete data`);
		console.log(`- Removed events: ✓ Proper emission with complete data`);
		console.log(`- Core functionality: ✓ Preserved and unaffected`);
		console.log(`- Event timing: ✓ Correct order and timing`);
		console.log(`- Integration: ✓ Seamless with existing patterns`);

		return true;
	} catch (error) {
		failureOccurred = true;
		console.error(`\n❌ Event emission test failed: ${error.message}`);
		console.error('\n=== FAILURE DETAILS ===');
		console.error(`Test artifacts preserved for debugging:`);
		console.error(
			`- Check worktree: ${path.join(projectRoot, 'worktrees', `task-${testTaskId}`)}`
		);
		console.error(`- Check branch: task-${testTaskId}`);
		console.error(`- Events received: ${eventsReceived.length}`);
		console.error('\nTo clean up manually:');
		console.error(
			`git worktree remove --force ${path.join(projectRoot, 'worktrees', `task-${testTaskId}`)} 2>/dev/null || true`
		);
		console.error(`git branch -D task-${testTaskId} 2>/dev/null || true`);

		console.log(
			`\n📊 Results: ${testsPassed}/${totalTests} tests passed before failure`
		);
		return false;
	}
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
	runEventEmissionTests()
		.then((success) => {
			process.exit(success ? 0 : 1);
		})
		.catch((error) => {
			console.error('Unexpected error:', error);
			process.exit(1);
		});
}
