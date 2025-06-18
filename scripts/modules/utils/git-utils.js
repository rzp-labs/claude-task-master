/**
 * git-utils.js
 * Git integration utilities for Task Master
 * Uses raw git commands and gh CLI for operations
 * MCP-friendly: All functions require projectRoot parameter
 */

import { exec, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if the specified directory is inside a git repository
 * @param {string} projectRoot - Directory to check (required)
 * @returns {Promise<boolean>} True if inside a git repository
 */
async function isGitRepository(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for isGitRepository');
	}

	try {
		await execAsync('git rev-parse --git-dir', { cwd: projectRoot });
		return true;
	} catch (error) {
		return false;
	}
}

/**
 * Get the current git branch name
 * @param {string} projectRoot - Directory to check (required)
 * @returns {Promise<string|null>} Current branch name or null if not in git repo
 */
async function getCurrentBranch(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getCurrentBranch');
	}

	try {
		const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
			cwd: projectRoot
		});
		return stdout.trim();
	} catch (error) {
		return null;
	}
}

/**
 * Get list of all local git branches
 * @param {string} projectRoot - Directory to check (required)
 * @returns {Promise<string[]>} Array of branch names
 */
async function getLocalBranches(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getLocalBranches');
	}

	try {
		const { stdout } = await execAsync(
			'git branch --format="%(refname:short)"',
			{ cwd: projectRoot }
		);
		return stdout
			.trim()
			.split('\n')
			.filter((branch) => branch.length > 0)
			.map((branch) => branch.trim());
	} catch (error) {
		return [];
	}
}

/**
 * Get list of all remote branches
 * @param {string} projectRoot - Directory to check (required)
 * @returns {Promise<string[]>} Array of remote branch names (without remote prefix)
 */
async function getRemoteBranches(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getRemoteBranches');
	}

	try {
		const { stdout } = await execAsync(
			'git branch -r --format="%(refname:short)"',
			{ cwd: projectRoot }
		);
		return stdout
			.trim()
			.split('\n')
			.filter((branch) => branch.length > 0 && !branch.includes('HEAD'))
			.map((branch) => branch.replace(/^origin\//, '').trim());
	} catch (error) {
		return [];
	}
}

/**
 * Check if gh CLI is available and authenticated
 * @param {string} [projectRoot] - Directory context (optional for this check)
 * @returns {Promise<boolean>} True if gh CLI is available and authenticated
 */
async function isGhCliAvailable(projectRoot = null) {
	try {
		const options = projectRoot ? { cwd: projectRoot } : {};
		await execAsync('gh auth status', options);
		return true;
	} catch (error) {
		return false;
	}
}

/**
 * Get GitHub repository information using gh CLI
 * @param {string} projectRoot - Directory to check (required)
 * @returns {Promise<Object|null>} Repository info or null if not available
 */
async function getGitHubRepoInfo(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getGitHubRepoInfo');
	}

	try {
		const { stdout } = await execAsync(
			'gh repo view --json name,owner,defaultBranchRef',
			{ cwd: projectRoot }
		);
		return JSON.parse(stdout);
	} catch (error) {
		return null;
	}
}

/**
 * Sanitize branch name to be a valid tag name
 * @param {string} branchName - Git branch name
 * @returns {string} Sanitized tag name
 */
function sanitizeBranchNameForTag(branchName) {
	if (!branchName || typeof branchName !== 'string') {
		return 'unknown-branch';
	}

	// Replace invalid characters with hyphens and clean up
	return branchName
		.replace(/[^a-zA-Z0-9_-]/g, '-') // Replace invalid chars with hyphens
		.replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
		.replace(/-+/g, '-') // Collapse multiple hyphens
		.toLowerCase() // Convert to lowercase
		.substring(0, 50); // Limit length
}

/**
 * Check if a branch name would create a valid tag name
 * @param {string} branchName - Git branch name
 * @returns {boolean} True if branch name can be converted to valid tag
 */
function isValidBranchForTag(branchName) {
	if (!branchName || typeof branchName !== 'string') {
		return false;
	}

	// Check if it's a reserved branch name that shouldn't become tags
	const reservedBranches = ['main', 'master', 'develop', 'dev', 'HEAD'];
	if (reservedBranches.includes(branchName.toLowerCase())) {
		return false;
	}

	// Check if sanitized name would be meaningful
	const sanitized = sanitizeBranchNameForTag(branchName);
	return sanitized.length > 0 && sanitized !== 'unknown-branch';
}

/**
 * Get git repository root directory
 * @param {string} projectRoot - Directory to start search from (required)
 * @returns {Promise<string|null>} Git repository root path or null
 */
async function getGitRepositoryRoot(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getGitRepositoryRoot');
	}

	try {
		const { stdout } = await execAsync('git rev-parse --show-toplevel', {
			cwd: projectRoot
		});
		return stdout.trim();
	} catch (error) {
		return null;
	}
}

/**
 * Check if specified directory is the git repository root
 * @param {string} projectRoot - Directory to check (required)
 * @returns {Promise<boolean>} True if directory is git root
 */
async function isGitRepositoryRoot(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for isGitRepositoryRoot');
	}

	try {
		const gitRoot = await getGitRepositoryRoot(projectRoot);
		return gitRoot && path.resolve(gitRoot) === path.resolve(projectRoot);
	} catch (error) {
		return false;
	}
}

/**
 * Get the default branch name for the repository
 * @param {string} projectRoot - Directory to check (required)
 * @returns {Promise<string|null>} Default branch name or null
 */
async function getDefaultBranch(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getDefaultBranch');
	}

	try {
		// Try to get from GitHub first (if gh CLI is available)
		if (await isGhCliAvailable(projectRoot)) {
			const repoInfo = await getGitHubRepoInfo(projectRoot);
			if (repoInfo && repoInfo.defaultBranchRef) {
				return repoInfo.defaultBranchRef.name;
			}
		}

		// Fallback to git remote info
		const { stdout } = await execAsync(
			'git symbolic-ref refs/remotes/origin/HEAD',
			{ cwd: projectRoot }
		);
		return stdout.replace('refs/remotes/origin/', '').trim();
	} catch (error) {
		// Final fallback - common default branch names
		const commonDefaults = ['main', 'master'];
		const branches = await getLocalBranches(projectRoot);

		for (const defaultName of commonDefaults) {
			if (branches.includes(defaultName)) {
				return defaultName;
			}
		}

		return null;
	}
}

/**
 * Check if we're currently on the default branch
 * @param {string} projectRoot - Directory to check (required)
 * @returns {Promise<boolean>} True if on default branch
 */
async function isOnDefaultBranch(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for isOnDefaultBranch');
	}

	try {
		const currentBranch = await getCurrentBranch(projectRoot);
		const defaultBranch = await getDefaultBranch(projectRoot);
		return currentBranch && defaultBranch && currentBranch === defaultBranch;
	} catch (error) {
		return false;
	}
}

/**
 * Check and automatically switch tags based on git branch if enabled
 * This runs automatically during task operations, similar to migration
 * @param {string} projectRoot - Project root directory (required)
 * @param {string} tasksPath - Path to tasks.json file
 * @returns {Promise<void>}
 */
async function checkAndAutoSwitchGitTag(projectRoot, tasksPath) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for checkAndAutoSwitchGitTag');
	}

	// DISABLED: Automatic git workflow is too rigid and opinionated
	// Users should explicitly use git-tag commands if they want integration
	return;
}

/**
 * Synchronous version of git tag checking and switching
 * This runs during readJSON to ensure git integration happens BEFORE tag resolution
 * @param {string} projectRoot - Project root directory (required)
 * @param {string} tasksPath - Path to tasks.json file
 * @returns {void}
 */
function checkAndAutoSwitchGitTagSync(projectRoot, tasksPath) {
	if (!projectRoot) {
		return; // Can't proceed without project root
	}

	// DISABLED: Automatic git workflow is too rigid and opinionated
	// Users should explicitly use git-tag commands if they want integration
	return;
}

/**
 * Synchronous check if directory is in a git repository
 * @param {string} projectRoot - Directory to check (required)
 * @returns {boolean} True if inside a git repository
 */
function isGitRepositorySync(projectRoot) {
	if (!projectRoot) {
		return false;
	}

	try {
		execSync('git rev-parse --git-dir', {
			cwd: projectRoot,
			stdio: 'ignore' // Suppress output
		});
		return true;
	} catch (error) {
		return false;
	}
}

/**
 * Synchronous get current git branch name
 * @param {string} projectRoot - Directory to check (required)
 * @returns {string|null} Current branch name or null if not in git repo
 */
function getCurrentBranchSync(projectRoot) {
	if (!projectRoot) {
		return null;
	}

	try {
		const stdout = execSync('git rev-parse --abbrev-ref HEAD', {
			cwd: projectRoot,
			encoding: 'utf8'
		});
		return stdout.trim();
	} catch (error) {
		return null;
	}
}

/**
 * Check if the current directory is a Git worktree
 * @param {string} projectRoot - Directory to check (required)
 * @returns {Promise<boolean>} True if directory is a worktree, false otherwise
 */
async function isWorktree(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for isWorktree');
	}

	try {
		const gitPath = path.join(projectRoot, '.git');

		// Check if .git exists
		if (!fs.existsSync(gitPath)) {
			return false;
		}

		// Check if .git is a file (worktree) vs directory (main repo)
		const stats = fs.statSync(gitPath);
		return stats.isFile();
	} catch (error) {
		return false;
	}
}

/**
 * Get basic information about the current worktree
 * @param {string} projectRoot - Directory to check (required)
 * @returns {Promise<Object|null>} Worktree info object or null if not in a worktree
 */
async function getWorktreeInfo(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getWorktreeInfo');
	}

	try {
		// First check if we're in a worktree
		const inWorktree = await isWorktree(projectRoot);
		if (!inWorktree) {
			return null;
		}

		// Get current branch name
		const currentBranch = await getCurrentBranch(projectRoot);

		// Get main worktree path using git rev-parse --git-common-dir
		const { stdout } = await execAsync('git rev-parse --git-common-dir', {
			cwd: projectRoot
		});
		const commonDir = stdout.trim();

		// The main worktree is the parent of the common git directory
		const mainWorktreePath = path.dirname(commonDir);

		return {
			branch: currentBranch,
			mainWorktreePath: path.resolve(mainWorktreePath),
			currentPath: path.resolve(projectRoot)
		};
	} catch (error) {
		return null;
	}
}

/**
 * Validate that Git version meets minimum requirement for worktrees (2.5+)
 * @param {string} [projectRoot] - Directory context (optional for this check)
 * @returns {Promise<void>} Throws error if version is too old
 */
async function validateGitVersion(projectRoot = null) {
	try {
		const options = projectRoot ? { cwd: projectRoot } : {};
		const { stdout } = await execAsync('git --version', options);

		// Parse version from output like "git version 2.39.5"
		const versionMatch = stdout.match(/git version (\d+)\.(\d+)\.(\d+)/);
		if (!versionMatch) {
			throw new Error(
				'Could not parse Git version from output: ' + stdout.trim()
			);
		}

		const major = parseInt(versionMatch[1], 10);
		const minor = parseInt(versionMatch[2], 10);
		const patch = parseInt(versionMatch[3], 10);

		// Check if version is 2.5.0 or higher
		if (major < 2 || (major === 2 && minor < 5)) {
			throw new Error(
				`Git version ${major}.${minor}.${patch} is too old. ` +
					'Git worktrees require Git 2.5.0 or higher. ' +
					'Please upgrade your Git installation.'
			);
		}

		// Version is acceptable
		return;
	} catch (error) {
		if (
			error.message.includes('Git version') ||
			error.message.includes('Could not parse')
		) {
			// Re-throw our custom error messages
			throw error;
		}
		// Handle case where git command fails
		throw new Error(
			'Git is not available or not installed. Git 2.5.0+ is required for worktree functionality.'
		);
	}
}

// Export all functions
export {
	isGitRepository,
	getCurrentBranch,
	getLocalBranches,
	getRemoteBranches,
	isGhCliAvailable,
	getGitHubRepoInfo,
	sanitizeBranchNameForTag,
	isValidBranchForTag,
	getGitRepositoryRoot,
	isGitRepositoryRoot,
	getDefaultBranch,
	isOnDefaultBranch,
	checkAndAutoSwitchGitTag,
	checkAndAutoSwitchGitTagSync,
	isGitRepositorySync,
	getCurrentBranchSync,
	isWorktree,
	getWorktreeInfo,
	validateGitVersion
};
