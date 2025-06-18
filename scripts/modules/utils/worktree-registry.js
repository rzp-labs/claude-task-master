/**
 * worktree-registry.js
 * Simple JSON registry for tracking active worktrees
 * Follows Task Master's existing JSON patterns
 */

import fs from 'fs';
import path from 'path';

/**
 * Get the path to the worktree registry file
 * @param {string} projectRoot - Project root directory (required)
 * @returns {string} Path to registry file
 */
function getRegistryPath(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getRegistryPath');
	}
	return path.join(projectRoot, '.taskmaster', 'worktree-registry.json');
}

/**
 * Read the worktree registry from disk
 * @param {string} projectRoot - Project root directory (required)
 * @returns {Object} Registry data (empty object if file doesn't exist)
 */
function readRegistry(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for readRegistry');
	}

	const registryPath = getRegistryPath(projectRoot);

	try {
		if (!fs.existsSync(registryPath)) {
			// Return empty registry structure if file doesn't exist
			return {
				worktrees: {},
				metadata: {
					created: new Date().toISOString(),
					updated: new Date().toISOString(),
					version: '1.0'
				}
			};
		}

		const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
		return data;
	} catch (error) {
		throw new Error(`Failed to read worktree registry: ${error.message}`);
	}
}

/**
 * Write the worktree registry to disk
 * @param {string} projectRoot - Project root directory (required)
 * @param {Object} data - Registry data to write
 */
function writeRegistry(projectRoot, data) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for writeRegistry');
	}

	if (!data || typeof data !== 'object') {
		throw new Error('data is required and must be an object for writeRegistry');
	}

	const registryPath = getRegistryPath(projectRoot);

	try {
		// Ensure .taskmaster directory exists
		const taskmasterDir = path.dirname(registryPath);
		if (!fs.existsSync(taskmasterDir)) {
			fs.mkdirSync(taskmasterDir, { recursive: true });
		}

		// Update metadata
		const finalData = {
			...data,
			metadata: {
				...data.metadata,
				updated: new Date().toISOString()
			}
		};

		// Write with pretty formatting (2-space indentation like Task Master's other files)
		fs.writeFileSync(registryPath, JSON.stringify(finalData, null, 2), 'utf8');
	} catch (error) {
		throw new Error(`Failed to write worktree registry: ${error.message}`);
	}
}

/**
 * Add a new worktree entry to the registry
 * @param {string} projectRoot - Project root directory (required)
 * @param {Object} entry - Worktree entry to add
 * @param {string} entry.worktreeId - Unique worktree identifier (e.g., 'task-123')
 * @param {string} entry.taskId - Task ID associated with worktree
 * @param {string} entry.branch - Branch name for the worktree
 * @param {string} entry.path - Path to the worktree directory
 * @param {string} [entry.createdAt] - Creation timestamp (auto-generated if not provided)
 */
function addToRegistry(projectRoot, entry) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for addToRegistry');
	}

	if (!entry || typeof entry !== 'object') {
		throw new Error(
			'entry is required and must be an object for addToRegistry'
		);
	}

	if (!entry.worktreeId || !entry.taskId || !entry.branch || !entry.path) {
		throw new Error(
			'entry must have worktreeId, taskId, branch, and path properties'
		);
	}

	// Read current registry
	const registry = readRegistry(projectRoot);

	// Prepare entry with timestamp if not provided
	const finalEntry = {
		...entry,
		createdAt: entry.createdAt || new Date().toISOString()
	};

	// Add entry to registry
	registry.worktrees[entry.worktreeId] = finalEntry;

	// Write back to disk
	writeRegistry(projectRoot, registry);
}

/**
 * Remove a worktree entry from the registry
 * @param {string} projectRoot - Project root directory (required)
 * @param {string} worktreeId - Worktree ID to remove
 */
function removeFromRegistry(projectRoot, worktreeId) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for removeFromRegistry');
	}

	if (!worktreeId) {
		throw new Error('worktreeId is required for removeFromRegistry');
	}

	// Read current registry
	const registry = readRegistry(projectRoot);

	// Check if entry exists
	if (!registry.worktrees[worktreeId]) {
		throw new Error(`Worktree '${worktreeId}' not found in registry`);
	}

	// Remove entry
	delete registry.worktrees[worktreeId];

	// Write back to disk
	writeRegistry(projectRoot, registry);
}

/**
 * Find a worktree entry by task ID
 * @param {string} projectRoot - Project root directory (required)
 * @param {string} taskId - Task ID to search for
 * @returns {Object|null} Worktree entry object or null if not found
 */
function findByTaskId(projectRoot, taskId) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for findByTaskId');
	}

	if (!taskId) {
		throw new Error('taskId is required for findByTaskId');
	}

	// Read current registry
	const registry = readRegistry(projectRoot);

	// Search through worktrees for matching task ID
	for (const [worktreeId, entry] of Object.entries(registry.worktrees)) {
		if (entry.taskId === taskId) {
			return {
				worktreeId,
				...entry
			};
		}
	}

	return null;
}

// Export functions
export {
	readRegistry,
	writeRegistry,
	getRegistryPath,
	addToRegistry,
	removeFromRegistry,
	findByTaskId
};
