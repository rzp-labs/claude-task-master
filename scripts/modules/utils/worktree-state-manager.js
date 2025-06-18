/**
 * worktree-state-manager.js
 * Manages worktree state persistence in state.json
 * Single responsibility: state operations for worktrees
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { readJSON, writeJSON } from '../utils.js';

const execAsync = promisify(exec);

/**
 * Get the path to the state file
 * @param {string} projectRoot - Project root directory
 * @returns {string} Path to state.json
 */
function getStatePath(projectRoot) {
	return path.join(projectRoot, '.taskmaster', 'state.json');
}

/**
 * Read worktree data from state.json
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Worktrees object
 */
function readWorktreeState(projectRoot) {
	const statePath = getStatePath(projectRoot);
	try {
		const state = readJSON(statePath, projectRoot);
		return state.worktrees || {};
	} catch (error) {
		// Return empty if file doesn't exist or has no worktrees
		return {};
	}
}

/**
 * Write worktree data to state.json
 * @param {string} projectRoot - Project root directory
 * @param {Object} worktrees - Worktrees data to write
 */
function writeWorktreeState(projectRoot, worktrees) {
	const statePath = getStatePath(projectRoot);
	try {
		const state = readJSON(statePath, projectRoot);
		state.worktrees = worktrees;
		writeJSON(statePath, state, projectRoot);
	} catch (error) {
		// Create new state if file doesn't exist
		const newState = { worktrees };
		writeJSON(statePath, newState, projectRoot);
	}
}

/**
 * Add worktree to state
 * @param {string} projectRoot - Project root directory
 * @param {Object} worktreeData - Worktree data to add
 */
function addWorktreeToState(
	projectRoot,
	{ worktreeTitle, taskId, branchName, worktreePath }
) {
	const worktrees = readWorktreeState(projectRoot);
	worktrees[worktreeTitle] = {
		taskId,
		branchName,
		worktreePath,
		createdAt: new Date().toISOString()
	};
	writeWorktreeState(projectRoot, worktrees);
}

/**
 * Remove worktree from state
 * @param {string} projectRoot - Project root directory
 * @param {string} worktreeTitle - Worktree title to remove
 */
function removeWorktreeFromState(projectRoot, worktreeTitle) {
	const worktrees = readWorktreeState(projectRoot);
	delete worktrees[worktreeTitle];
	writeWorktreeState(projectRoot, worktrees);
}

/**
 * Sync worktree state with actual Git worktrees (remove stale entries)
 * @param {string} projectRoot - Project root directory
 * @param {Object} [options] - Options for the operation
 * @param {Function} [options.mcpLog] - MCP logger object (optional)
 */
async function syncWorktreeState(projectRoot, options = {}) {
	const { mcpLog } = options;

	// Logger helper
	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	try {
		// Get current Git worktrees
		const { stdout } = await execAsync('git worktree list --porcelain', {
			cwd: projectRoot
		});

		const gitWorktreePaths = [];
		const lines = stdout.trim().split('\n');

		for (const line of lines) {
			if (line.startsWith('worktree ')) {
				gitWorktreePaths.push(line.substring(9));
			}
		}

		// Get current state
		const worktrees = readWorktreeState(projectRoot);

		// Check each registry entry against reality
		const staleEntries = [];
		for (const [worktreeId, entry] of Object.entries(worktrees)) {
			const entryPath = entry.worktreePath || entry.path; // Handle both old and new field names
			const pathExists = fs.existsSync(entryPath);
			const inGitWorktrees = gitWorktreePaths.includes(entryPath);

			if (!pathExists || !inGitWorktrees) {
				staleEntries.push(worktreeId);
				report('info', `Removing stale entry: ${worktreeId}`);
			}
		}

		// Remove stale entries
		if (staleEntries.length > 0) {
			for (const staleId of staleEntries) {
				delete worktrees[staleId];
			}
			writeWorktreeState(projectRoot, worktrees);
			report(
				'info',
				`Cleaned up ${staleEntries.length} stale worktree entries`
			);
		}
	} catch (error) {
		report('warn', `Worktree sync failed: ${error.message}`);
	}
}

// Export functions
export {
	readWorktreeState,
	writeWorktreeState,
	addWorktreeToState,
	removeWorktreeFromState,
	syncWorktreeState
};
