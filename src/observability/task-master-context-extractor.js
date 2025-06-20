import fs from 'fs';
import path from 'path';
import { getCurrentTag } from '../../scripts/modules/utils.js';

/**
 * TaskMasterContextExtractor - Safely extracts Task Master context for tracing
 *
 * This utility safely extracts Task Master specific metadata including:
 * - Task ID from various sources (command args, git branch, state files)
 * - Current tag using existing getCurrentTag() utility
 * - Command name from process args or MCP context
 * - Role information passed from ai-services-unified.js
 */

/**
 * Extract current task ID from available sources
 * Tries multiple strategies and returns first successful result
 */
export function extractTaskId(
	projectRoot,
	processArgs = null,
	mcpContext = null
) {
	try {
		// Strategy 1: Look for task ID in command arguments
		if (processArgs) {
			const taskIdFromArgs = _extractTaskIdFromArgs(processArgs);
			if (taskIdFromArgs) return taskIdFromArgs;
		}

		// Strategy 2: Look for task ID in MCP context/parameters
		if (mcpContext && mcpContext.taskId) {
			return String(mcpContext.taskId);
		}
		if (mcpContext && mcpContext.id) {
			return String(mcpContext.id);
		}

		// Strategy 3: Extract from git branch name (task-N pattern)
		const taskIdFromBranch = _extractTaskIdFromGitBranch(projectRoot);
		if (taskIdFromBranch) return taskIdFromBranch;

		// Strategy 4: Check worktree state for current task
		const taskIdFromState = _extractTaskIdFromState(projectRoot);
		if (taskIdFromState) return taskIdFromState;

		return null;
	} catch (error) {
		// Silently fail - context extraction should never break AI operations
		return null;
	}
}

/**
 * Extract current tag using existing getCurrentTag utility
 */
export function extractCurrentTag(projectRoot) {
	try {
		return getCurrentTag(projectRoot);
	} catch (error) {
		return null;
	}
}

/**
 * Extract command name from process arguments or MCP context
 */
export function extractCommand(processArgs = null, mcpContext = null) {
	try {
		// For MCP operations, use the tool name if available
		if (mcpContext && mcpContext.toolName) {
			return mcpContext.toolName;
		}

		// For CLI operations, extract from process arguments
		if (processArgs && Array.isArray(processArgs) && processArgs.length > 2) {
			// Skip 'node' and script name, get the actual command
			return processArgs[2];
		}

		return null;
	} catch (error) {
		return null;
	}
}

/**
 * Main context extraction function - orchestrates all extraction methods
 */
export function extractContext(options = {}) {
	const {
		projectRoot = null,
		role = null,
		commandName = null,
		processArgs = process.argv,
		mcpContext = null
	} = options;

	try {
		const context = {
			taskId: extractTaskId(projectRoot, processArgs, mcpContext),
			tag: projectRoot ? extractCurrentTag(projectRoot) : null,
			command: commandName || extractCommand(processArgs, mcpContext),
			role: role,
			projectRoot: projectRoot
		};

		return context;
	} catch (error) {
		// Return empty context on any error - never break AI operations
		return {
			taskId: null,
			tag: null,
			command: null,
			role: null,
			projectRoot: null
		};
	}
}

// Private helper functions

/**
 * Extract task ID from command line arguments
 */
function _extractTaskIdFromArgs(args) {
	try {
		// Look for --id, --task-id, or task ID in various argument patterns
		for (let i = 0; i < args.length - 1; i++) {
			const arg = args[i];
			const nextArg = args[i + 1];

			if ((arg === '--id' || arg === '--task-id') && nextArg) {
				return nextArg;
			}

			// Look for patterns like "task-start 4", "set-status 4.1", "update-task 4.2"
			const taskCommands = [
				'task',
				'status',
				'update',
				'expand',
				'add',
				'remove',
				'move'
			];
			const hasTaskCommand = taskCommands.some((cmd) => arg.includes(cmd));
			if (hasTaskCommand && nextArg && /^\d+(\.\d+)*$/.test(nextArg)) {
				return nextArg;
			}
		}

		return null;
	} catch (error) {
		return null;
	}
}

/**
 * Extract task ID from git branch name (task-N pattern)
 */
function _extractTaskIdFromGitBranch(projectRoot) {
	try {
		if (!projectRoot) return null;

		let gitDir = path.join(projectRoot, '.git');

		// Handle worktree case where .git is a file pointing to actual git dir
		if (fs.existsSync(gitDir)) {
			const gitStat = fs.statSync(gitDir);
			if (gitStat.isFile()) {
				const gitContent = fs.readFileSync(gitDir, 'utf8').trim();
				const gitDirMatch = gitContent.match(/gitdir: (.+)/);
				if (gitDirMatch) {
					gitDir = gitDirMatch[1];
				}
			}
		}

		// Read current branch from HEAD file
		const gitHeadPath = path.join(gitDir, 'HEAD');
		if (!fs.existsSync(gitHeadPath)) return null;

		const headContent = fs.readFileSync(gitHeadPath, 'utf8').trim();

		// Extract branch name from "ref: refs/heads/branch-name"
		const branchMatch = headContent.match(/ref: refs\/heads\/(.+)/);
		if (!branchMatch) return null;

		const branchName = branchMatch[1];

		// Look for task-N pattern
		const taskMatch = branchName.match(/^task-(\d+)$/);
		if (taskMatch) {
			return taskMatch[1];
		}

		return null;
	} catch (error) {
		return null;
	}
}

/**
 * Extract task ID from worktree state files
 */
function _extractTaskIdFromState(projectRoot) {
	try {
		if (!projectRoot) return null;

		// Check .taskmaster/state.json for worktree information
		const statePath = path.join(projectRoot, '.taskmaster', 'state.json');
		if (!fs.existsSync(statePath)) return null;

		const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

		// Look in worktrees for current path
		if (state.worktrees) {
			for (const [key, worktree] of Object.entries(state.worktrees)) {
				if (worktree.worktreePath === projectRoot && worktree.taskId) {
					return worktree.taskId;
				}
			}
		}

		return null;
	} catch (error) {
		return null;
	}
}

// Export an object for backward compatibility
export const TaskMasterContextExtractor = {
	extractTaskId,
	extractCurrentTag,
	extractCommand,
	extractContext
};

export default TaskMasterContextExtractor;
