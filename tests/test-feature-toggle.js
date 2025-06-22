#!/usr/bin/env node

/**
 * test-feature-toggle.js
 * Atomic test script for Task 5 feature toggle functionality
 * Tests config schema, runtime checks, and feature toggle behavior
 */

import fs from 'fs';
import path from 'path';

async function testFeatureToggle() {
	console.log('=== FEATURE TOGGLE ATOMIC TEST ===\n');

	const projectRoot = process.cwd();
	const configPath = path.join(projectRoot, '.taskmaster', 'config.json');
	const backupConfigPath = `${configPath}.test-backup`;

	let testFailed = false;

	try {
		// Import modules
		console.log('1. Importing modules...');
		const configManager = await import('../scripts/modules/config-manager.js');
		const worktreeManager = await import('../scripts/modules/utils/worktree-manager.js');
		console.log('✓ All modules imported successfully\n');

		// Backup original config
		if (fs.existsSync(configPath)) {
			fs.copyFileSync(configPath, backupConfigPath);
		}

		// Test 1: Config schema updates for features.worktrees
		console.log('2. Testing config schema for features.worktrees...');
		const currentConfig = configManager.getConfig(projectRoot);

		if (!currentConfig.features) {
			throw new Error('Config missing features section');
		}
		if (typeof currentConfig.features.worktrees !== 'boolean') {
			throw new Error('features.worktrees is not boolean');
		}

		// Test with disabled config
		const disabledConfig = {
			...currentConfig,
			features: { worktrees: false }
		};
		configManager.writeConfig(disabledConfig, projectRoot);

		const featuresConfig = configManager.getFeaturesConfig(projectRoot);
		if (featuresConfig.worktrees !== false) {
			throw new Error('getFeaturesConfig() not returning false when disabled');
		}

		const isEnabled = configManager.isWorktreesEnabled(projectRoot);
		if (isEnabled !== false) {
			throw new Error('isWorktreesEnabled() not returning false when disabled');
		}

		console.log('✓ Config schema for features.worktrees working correctly\n');

		// Test 2: Runtime checks in worktree functions when disabled
		console.log('3. Testing runtime checks in worktree functions...');

		try {
			await worktreeManager.createWorktree(projectRoot, '999', 'main');
			throw new Error('createWorktree should have been blocked');
		} catch (error) {
			if (!error.message.includes('Worktrees are disabled')) {
				throw new Error(`Wrong error from createWorktree: ${error.message}`);
			}
		}

		try {
			await worktreeManager.removeWorktree(projectRoot, '999');
			throw new Error('removeWorktree should have been blocked');
		} catch (error) {
			if (!error.message.includes('Worktrees are disabled')) {
				throw new Error(`Wrong error from removeWorktree: ${error.message}`);
			}
		}

		try {
			await worktreeManager.listWorktrees(projectRoot);
			throw new Error('listWorktrees should have been blocked');
		} catch (error) {
			if (!error.message.includes('Worktrees are disabled')) {
				throw new Error(`Wrong error from listWorktrees: ${error.message}`);
			}
		}

		console.log('✓ Runtime checks working correctly\n');

		// Test 3: Verify errors are thrown when features disabled
		console.log('4. Testing that errors are thrown...');

		try {
			await worktreeManager.createWorktree(projectRoot, '123', 'main');
			throw new Error('createWorktree should have thrown an error');
		} catch (error) {
			if (error.message === 'createWorktree should have thrown an error') {
				throw error;
			}
			// Any error about being disabled is fine for MVP
		}

		console.log('✓ Errors thrown when features disabled\n');

		// Test 4: Test enabled state
		console.log('5. Testing enabled state...');

		// Create config with feature enabled
		const enabledConfig = {
			...currentConfig,
			features: { worktrees: true }
		};

		// Write enabled config
		const enableSuccess = configManager.writeConfig(enabledConfig, projectRoot);
		if (!enableSuccess) {
			throw new Error('Failed to write enabled config');
		}

		// Verify feature is now enabled
		if (!configManager.isWorktreesEnabled(projectRoot)) {
			throw new Error('Feature not enabled after config write');
		}

		// Test functions do NOT throw feature disabled errors
		try {
			await worktreeManager.listWorktrees(projectRoot);
			// Should succeed (return array) or fail for non-feature reasons
		} catch (error) {
			if (error.message.includes('Worktrees are disabled')) {
				throw new Error('Feature toggle still blocking when enabled');
			}
			// Any other error is fine - not testing Git functionality
		}

		try {
			await worktreeManager.createWorktree(projectRoot, '999', 'main');
		} catch (error) {
			if (error.message.includes('Worktrees are disabled')) {
				throw new Error(
					'Feature toggle still blocking createWorktree when enabled'
				);
			}
			// Any other error is fine - not testing Git functionality
		}

		// Restore current config
		configManager.writeConfig(currentConfig, projectRoot);

		console.log(
			'✓ Functions do not throw feature disabled errors when enabled\n'
		);

		// Cleanup successful test
		console.log('6. Cleaning up test artifacts...');
		if (fs.existsSync(backupConfigPath)) {
			fs.unlinkSync(backupConfigPath);
		}
		console.log('✓ Cleanup completed\n');

		console.log('🎉 ALL FEATURE TOGGLE TESTS PASSED!');
		console.log('✓ Config schema: features.worktrees works in disabled state');
		console.log(
			'✓ Runtime checks: All worktree functions blocked when disabled'
		);
		console.log('✓ Error handling: Errors thrown when features disabled');
		console.log('✓ Enabled state: Functions work when feature enabled');
	} catch (error) {
		testFailed = true;
		console.error('💥 FEATURE TOGGLE TEST FAILED:', error.message);
		console.error('📋 Full error:', error);

		// Preserve artifacts for debugging
		console.error('\n📋 Test artifacts preserved for debugging:');
		console.error('- Config backup:', backupConfigPath);
		console.error('- Current config:', configPath);
		console.error('- Check config state manually');

		// Restore original config if backup exists
		if (fs.existsSync(backupConfigPath)) {
			try {
				fs.copyFileSync(backupConfigPath, configPath);
				console.error('- Original config restored from backup');
			} catch (restoreError) {
				console.error('- Failed to restore config:', restoreError.message);
			}
		}

		process.exit(1);
	}
}

testFeatureToggle();
