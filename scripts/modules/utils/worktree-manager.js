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
import { isWorktreesEnabled } from '../config-manager.js';
import { addToRegistry, removeFromRegistry } from './worktree-registry.js';

const execAsync = promisify(exec);

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
	const worktreePath = path.join(projectRoot, 'worktrees', `task-${taskId}`);
	const branchName = `task-${taskId}`;

	// Logger helper
	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	try {
		// Create worktrees directory if it doesn't exist
		const worktreesDir = path.join(projectRoot, 'worktrees');
		if (!fs.existsSync(worktreesDir)) {
			fs.mkdirSync(worktreesDir, { recursive: true });
			report('info', `Created worktrees directory: ${worktreesDir}`);
		}

		report(
			'info',
			`Creating worktree for task ${taskId} on branch ${branchName}`
		);

		// Create worktree with new branch
		const { stdout, stderr } = await execAsync(
			`git worktree add -b ${branchName} ${worktreePath} ${baseBranch}`,
			{ cwd: projectRoot }
		);

		report('info', `Successfully created worktree at ${worktreePath}`);

		// Add to registry after successful Git operation
		try {
			addToRegistry(projectRoot, {
				worktreeId: `task-${taskId}`,
				taskId,
				branch: branchName,
				path: worktreePath
			});
			report('info', `Added worktree to registry: task-${taskId}`);
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
		throw new Error(
			`Failed to create worktree for task ${taskId}: ${error.message}`
		);
	}
}

/**
 * Remove a Git worktree for a task
 * @param {string} projectRoot - Project root directory (required)
 * @param {string} taskId - Task ID of the worktree to remove
 * @param {Object} [options] - Options for the operation
 * @param {Function} [options.mcpLog] - MCP logger object (optional)
 * @returns {Promise<Object>} Worktree removal result
 */
async function removeWorktree(projectRoot, taskId, options = {}) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for removeWorktree');
	}
	if (!taskId) {
		throw new Error('taskId is required for removeWorktree');
	}

	// Check if worktrees feature is enabled
	if (!isWorktreesEnabled(projectRoot)) {
		throw new Error(
			'Worktrees are disabled. Enable in config with features.worktrees: true'
		);
	}

	const { mcpLog } = options;
	const worktreePath = path.join(projectRoot, 'worktrees', `task-${taskId}`);

	// Logger helper
	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	try {
		report('info', `Removing worktree for task ${taskId} at ${worktreePath}`);

		// Remove the worktree
		const { stdout, stderr } = await execAsync(
			`git worktree remove ${worktreePath}`,
			{ cwd: projectRoot }
		);

		report('info', `Successfully removed worktree for task ${taskId}`);

		// Remove from registry after successful Git operation
		try {
			removeFromRegistry(projectRoot, `task-${taskId}`);
			report('info', `Removed worktree from registry: task-${taskId}`);
		} catch (registryError) {
			// Log registry error but don't fail the operation
			report(
				'warn',
				`Failed to remove worktree from registry: ${registryError.message}`
			);
		}

		return {
			success: true,
			taskId,
			worktreePath,
			output: stdout
		};
	} catch (error) {
		report(
			'error',
			`Failed to remove worktree for task ${taskId}: ${error.message}`
		);
		throw new Error(
			`Failed to remove worktree for task ${taskId}: ${error.message}`
		);
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
export { createWorktree, removeWorktree, listWorktrees };
