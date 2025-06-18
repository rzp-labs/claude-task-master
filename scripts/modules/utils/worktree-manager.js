/**
 * worktree-manager.js
 * Git worktree management utilities for Task Master
 * Uses raw git commands for worktree operations
 * MCP-friendly: All functions require projectRoot parameter
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import {
	WORKTREES_DIR,
	WORKTREE_PREFIX
} from '../../../src/constants/paths.js';
import { isWorktreesEnabled } from '../config-manager.js';
import { findMainProjectRoot } from '../utils.js';
import {
	addToRegistry,
	removeFromRegistry,
	syncWorktreeRegistry
} from './worktree-registry.js';

const execAsync = promisify(exec);

/**
 * Generate worktree title from task ID
 * @param {string} taskId - The task ID
 * @returns {string} The worktree title
 */
function getWorktreeTitle(taskId) {
	return `${WORKTREE_PREFIX}${taskId}`;
}

/**
 * Create a new Git worktree for a task
 * @param {string} projectRoot - Project root directory (required)
 * @param {string} taskId - Task ID for the worktree
 * @param {string} [baseBranch='main'] - Base branch to create task branch from
 * @param {Object} [options] - Options for the operation
 * @param {Function} [options.mcpLog] - MCP logger object (optional)
 * @returns {Promise<Object>} Worktree creation result
 */
async function createWorktree(
	projectRoot,
	taskId,
	baseBranch = 'main',
	options = {}
) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for createWorktree');
	}
	if (!taskId) {
		throw new Error('taskId is required for createWorktree');
	}

	// Check if worktrees feature is enabled
	if (!isWorktreesEnabled(projectRoot)) {
		throw new Error(
			'Worktrees are disabled. Enable in config with features.worktrees: true'
		);
	}

	const { mcpLog } = options;
	const worktreeTitle = getWorktreeTitle(taskId);
	const worktreePath = path.resolve(
		path.join(projectRoot, WORKTREES_DIR, worktreeTitle)
	);
	const branchName = worktreeTitle;

	// Logger helper
	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	try {
		// Create worktrees directory if it doesn't exist
		const worktreesDir = path.join(projectRoot, WORKTREES_DIR);
		if (!fs.existsSync(worktreesDir)) {
			fs.mkdirSync(worktreesDir, { recursive: true });
			report('info', `Created worktrees directory: ${worktreesDir}`);
		}

		report(
			'info',
			`Creating worktree for task ${taskId} on branch ${branchName}`
		);

		// Check if branch already exists
		let branchExists = false;
		try {
			await execAsync(
				`git show-ref --verify --quiet refs/heads/${branchName}`,
				{ cwd: projectRoot }
			);
			branchExists = true;
		} catch (error) {
			// Branch doesn't exist, which is fine
			branchExists = false;
		}

		// Create worktree - use different command based on branch existence
		let createCommand;
		if (branchExists) {
			// Branch exists, create worktree from existing branch
			createCommand = `git worktree add ${worktreePath} ${branchName}`;
			report('info', `Using existing branch ${branchName}`);
		} else {
			// Branch doesn't exist, create new branch and worktree
			createCommand = `git worktree add -b ${branchName} ${worktreePath} ${baseBranch}`;
			report('info', `Creating new branch ${branchName} from ${baseBranch}`);
		}

		const result = await execAsync(createCommand, { cwd: projectRoot });
		const stdout = result.stdout;

		report('info', `Successfully created worktree at ${worktreePath}`);

		// Add to registry after successful Git operation
		try {
			addToRegistry(projectRoot, {
				worktreeId: worktreeTitle,
				taskId,
				branch: branchName,
				path: worktreePath
			});
			report('info', `Added worktree to registry: ${worktreeTitle}`);
		} catch (registryError) {
			// Log registry error but don't fail the operation
			report(
				'warn',
				`Failed to add worktree to registry: ${registryError.message}`
			);
		}

		return {
			success: true,
			taskId,
			worktreePath,
			branchName,
			baseBranch,
			output: stdout
		};
	} catch (error) {
		report(
			'error',
			`Failed to create worktree for task ${taskId}: ${error.message}`
		);
		// Extract just the Git error output, skip Node.js "Command failed" wrapper
		const gitError = error.stderr || error.stdout || error.message;
		const cleanError = gitError.replace(/^Command failed:.*?\n/, '');
		throw new Error(`Error creating worktree: ${cleanError}`);
	}
}

/**
 * Remove a Git worktree for a task (handles messy cases with force options)
 * @param {string} projectRoot - Project root directory (required)
 * @param {string} worktreeTitle - Worktree title (e.g., 'task-6')
 * @param {Object} [options] - Options for the operation
 * @param {Function} [options.mcpLog] - MCP logger object (optional)
 * @param {boolean} [options.force] - Force removal even with uncommitted changes
 * @param {Function} [options.confirm] - Confirmation callback for destructive operations
 * @param {boolean} [options.removeBranch] - Also remove the branch after removing worktree
 * @returns {Promise<Object>} Worktree removal result
 */
async function removeWorktree(projectRoot, worktreeTitle, options = {}) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for removeWorktree');
	}
	if (!worktreeTitle) {
		throw new Error('worktreeTitle is required for removeWorktree');
	}

	// Check if worktrees feature is enabled
	if (!isWorktreesEnabled(projectRoot)) {
		throw new Error(
			'Worktrees are disabled. Enable in config with features.worktrees: true'
		);
	}

	const { mcpLog, force = false, confirm, removeBranch = false } = options;

	// Delegate to specialized function for worktree+branch removal
	if (removeBranch) {
		return await removeWorktreeAndBranch(projectRoot, worktreeTitle, {
			mcpLog,
			force // This will trigger the existing validation in removeWorktreeAndBranch
		});
	}
	const worktreePath = path.resolve(
		path.join(projectRoot, WORKTREES_DIR, worktreeTitle)
	);
	const branchName = worktreeTitle;

	// Logger helper
	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	// Sync registry with reality before removal (clean up stale entries)
	try {
		await syncWorktreeRegistry(projectRoot, { mcpLog });
	} catch (syncError) {
		// Don't fail the operation if sync fails, just log it
		report('warn', `Registry sync failed: ${syncError.message}`);
	}

	// CRITICAL SAFETY CHECK: Prevent removing worktree from inside it
	const currentDir = path.resolve(process.cwd()).toLowerCase();
	const normalizedWorktreePath = path.resolve(worktreePath).toLowerCase();
	if (currentDir.startsWith(normalizedWorktreePath)) {
		throw new Error(
			`Cannot remove worktree while inside it. You are currently in: ${currentDir}. Please navigate out first: cd ${projectRoot}`
		);
	}

	// Check if worktree exists with better error context
	if (!fs.existsSync(worktreePath)) {
		// Provide helpful context if user appears to be inside a worktree
		if (currentDir.includes('worktrees')) {
			throw new Error(
				`Cannot find worktree '${worktreeTitle}'. Note: you appear to be inside a worktree. Try running from the main project directory.`
			);
		}
		throw new Error(`${worktreeTitle} does not exist`);
	}

	try {
		report('info', `Removing ${worktreeTitle} at ${worktreePath}`);

		// First try normal removal
		let removeCommand = `git worktree remove ${worktreePath}`;

		try {
			const { stdout } = await execAsync(removeCommand, { cwd: projectRoot });
			// GIVEN the worktree exists AND the worktree has no uncommitted changes
			report('info', `✅ ${worktreeTitle} removed successfully`);
		} catch (initialError) {
			// Check if error is due to uncommitted changes
			if (
				initialError.message.includes('contains modified or untracked files')
			) {
				if (!force) {
					// GIVEN the worktree exists AND the worktree has uncommitted changes WHEN removeWorktree is called without the --force flag
					throw new Error(
						`${worktreeTitle} has uncommitted changes. Please commit or stash changes before removing or try again with --force`
					);
				}

				// GIVEN the worktree exists AND the worktree has uncommitted changes WHEN removeWorktree is called with the --force flag
				if (confirm && typeof confirm === 'function') {
					const shouldProceed = await confirm(
						`${worktreeTitle} contains uncommitted changes that will be PERMANENTLY LOST. Continue? (y/N)`
					);
					if (!shouldProceed) {
						return {
							success: false,
							worktreeTitle,
							worktreePath,
							branchName,
							cancelled: true
						};
					}
				}

				// Use force flag for removal
				removeCommand = `git worktree remove --force ${worktreePath}`;
				report('info', `Force removing worktree with uncommitted changes`);

				const { stdout } = await execAsync(removeCommand, { cwd: projectRoot });
				report('info', `✅ ${worktreeTitle} removed successfully`);
			} else {
				// Re-throw other types of errors
				throw initialError;
			}
		}

		// Remove from registry after successful Git operation
		try {
			removeFromRegistry(projectRoot, worktreeTitle);
			report('info', `Removed ${worktreeTitle} from registry`);
		} catch (registryError) {
			// Log registry error but don't fail the operation
			report(
				'warn',
				`Failed to remove worktree from registry: ${registryError.message}`
			);
		}

		// Note: Branch removal is handled by delegation to removeWorktreeAndBranch above

		return {
			success: true,
			worktreeTitle,
			worktreePath,
			branchName,
			branchRemoved: false // Only worktree removed, branch removal is handled by delegation
		};
	} catch (error) {
		report('error', `Failed to remove ${worktreeTitle}: ${error.message}`);
		throw error;
	}
}

/**
 * Remove a Git worktree and its branch (clean state only, optimized for happy path)
 * @param {string} projectRoot - Project root directory (required)
 * @param {string} worktreeTitle - Worktree title (e.g., 'task-6')
 * @param {Object} [options] - Options for the operation
 * @param {Function} [options.mcpLog] - MCP logger object (optional)
 * @param {boolean} [options.force] - Force flag (not supported, will throw error)
 * @returns {Promise<Object>} Worktree and branch removal result
 */
async function removeWorktreeAndBranch(
	projectRoot,
	worktreeTitle,
	options = {}
) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for removeWorktreeAndBranch');
	}
	if (!worktreeTitle) {
		throw new Error('worktreeTitle is required for removeWorktreeAndBranch');
	}

	// Check if worktrees feature is enabled
	if (!isWorktreesEnabled(projectRoot)) {
		throw new Error(
			'Worktrees are disabled. Enable in config with features.worktrees: true'
		);
	}

	const { mcpLog, force } = options;
	const worktreePath = path.resolve(
		path.join(projectRoot, WORKTREES_DIR, worktreeTitle)
	);
	const branchName = worktreeTitle;

	// Logger helper
	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	// GIVEN the worktree exists WHEN removeWorktreeAndBranch is called with the --force flag
	if (force) {
		throw new Error('--force not supported for removeWorktreeAndBranch');
	}

	// CRITICAL SAFETY CHECK: Prevent removing worktree from inside it
	const currentDir = path.resolve(process.cwd()).toLowerCase();
	const normalizedWorktreePath = path.resolve(worktreePath).toLowerCase();
	if (currentDir.startsWith(normalizedWorktreePath)) {
		throw new Error(
			`Cannot remove worktree while inside it. You are currently in: ${currentDir}. Please navigate out first: cd ${projectRoot}`
		);
	}

	// Check if worktree exists
	if (!fs.existsSync(worktreePath)) {
		throw new Error(`${worktreeTitle} does not exist`);
	}

	try {
		report('info', `Removing ${worktreeTitle} and branch ${branchName}`);

		// Check for uncommitted changes first (fail fast)
		try {
			const { stdout: statusOutput } = await execAsync(
				`git status --porcelain`,
				{ cwd: worktreePath }
			);
			if (statusOutput.trim().length > 0) {
				// GIVEN the worktree exists AND the worktree has uncommitted changes
				throw new Error(
					`${worktreeTitle} has uncommitted changes. Please commit or stash changes before removing`
				);
			}
		} catch (statusError) {
			if (statusError.message.includes('uncommitted changes')) {
				throw statusError;
			}
			// Git status failed for other reasons, continue
		}

		// Check for unmerged branch changes
		try {
			const { stdout: mergeBase } = await execAsync(
				`git merge-base ${branchName} main`,
				{ cwd: projectRoot }
			);
			const { stdout: branchCommit } = await execAsync(
				`git rev-parse ${branchName}`,
				{ cwd: projectRoot }
			);

			if (mergeBase.trim() !== branchCommit.trim()) {
				// GIVEN the worktree exists AND the branch has unmerged changes
				throw new Error(
					`Branch ${branchName} has unmerged changes. Please merge, rebase, or stash changes then try again`
				);
			}
		} catch (mergeError) {
			if (mergeError.message.includes('unmerged changes')) {
				throw mergeError;
			}
			// Branch checking failed for other reasons (e.g., branch doesn't exist), continue
		}

		// GIVEN the worktree exists AND the worktree has no uncommitted changes AND branch has no unmerged changes
		// Remove worktree (should be clean at this point)
		await execAsync(`git worktree remove ${worktreePath}`, {
			cwd: projectRoot
		});

		// Remove from registry
		try {
			removeFromRegistry(projectRoot, worktreeTitle);
			report('info', `Removed ${worktreeTitle} from registry`);
		} catch (registryError) {
			// Log registry error but don't fail the operation
			report(
				'warn',
				`Failed to remove worktree from registry: ${registryError.message}`
			);
		}

		// Delete branch
		await execAsync(`git branch -d ${branchName}`, { cwd: projectRoot });

		// THEN remove the worktree AND remove the branch AND confirm removal
		report('info', `✅ Worktree and branch ${branchName} removed successfully`);

		return {
			success: true,
			worktreeTitle,
			worktreePath,
			branchName,
			branchRemoved: true
		};
	} catch (error) {
		report(
			'error',
			`Failed to remove ${worktreeTitle} and branch: ${error.message}`
		);
		throw error;
	}
}

/**
 * List all Git worktrees in the repository
 * @param {string} projectRoot - Project root directory (required)
 * @param {Object} [options] - Options for the operation
 * @param {Function} [options.mcpLog] - MCP logger object (optional)
 * @returns {Promise<Array>} Array of worktree information objects
 */
async function listWorktrees(projectRoot, options = {}) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for listWorktrees');
	}

	// Check if worktrees feature is enabled
	if (!isWorktreesEnabled(projectRoot)) {
		throw new Error(
			'Worktrees are disabled. Enable in config with features.worktrees: true'
		);
	}

	const { mcpLog } = options;

	// Logger helper
	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	// Sync registry with reality before listing (clean up stale entries)
	try {
		await syncWorktreeRegistry(projectRoot, { mcpLog });
	} catch (syncError) {
		// Don't fail the operation if sync fails, just log it
		report('warn', `Registry sync failed: ${syncError.message}`);
	}

	try {
		const { stdout } = await execAsync('git worktree list --porcelain', {
			cwd: projectRoot
		});

		// Parse porcelain output into structured data
		const worktrees = [];
		const lines = stdout.trim().split('\n');

		let currentWorktree = {};
		for (const line of lines) {
			if (line.startsWith('worktree ')) {
				// Start of new worktree entry
				if (Object.keys(currentWorktree).length > 0) {
					worktrees.push(currentWorktree);
				}
				currentWorktree = {
					path: line.substring(9) // Remove 'worktree ' prefix
				};
			} else if (line.startsWith('HEAD ')) {
				currentWorktree.head = line.substring(5);
			} else if (line.startsWith('branch ')) {
				currentWorktree.branch = line.substring(7).replace('refs/heads/', '');
			} else if (line.startsWith('bare')) {
				currentWorktree.bare = true;
			}
		}

		// Add the last worktree if exists
		if (Object.keys(currentWorktree).length > 0) {
			worktrees.push(currentWorktree);
		}

		// Add task ID extraction for Task Master worktrees
		const result = worktrees.map((worktree) => {
			const pathParts = worktree.path.split(path.sep);
			const dirname = pathParts[pathParts.length - 1];

			// Extract task ID if this is a Task Master worktree
			const taskIdMatch = dirname.match(/^task-(\d+)$/);
			if (taskIdMatch) {
				worktree.taskId = taskIdMatch[1];
				worktree.isTaskMasterWorktree = true;
			} else {
				worktree.isTaskMasterWorktree = false;
			}

			return worktree;
		});

		const taskMasterWorktrees = result.filter((w) => w.isTaskMasterWorktree);
		if (taskMasterWorktrees.length > 0) {
			report(
				'info',
				`Found ${taskMasterWorktrees.length} Task Master worktree(s)`
			);
		}

		return result;
	} catch (error) {
		report('error', `Failed to list worktrees: ${error.message}`);
		throw new Error(`Failed to list worktrees: ${error.message}`);
	}
}

// Export functions
export {
	getWorktreeTitle,
	createWorktree,
	removeWorktree,
	removeWorktreeAndBranch,
	listWorktrees
};
