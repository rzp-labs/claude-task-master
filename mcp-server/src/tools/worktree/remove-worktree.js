/**
 * tools/worktree/remove-worktree.js
 * Tool to remove a Git worktree
 */

import { z } from 'zod';
import { isWorktreesEnabled } from '../../../../scripts/modules/config-manager.js';
import { removeWorktree } from '../../../../scripts/modules/utils/worktree-manager.js';
import {
	createContentResponse,
	createErrorResponse,
	withNormalizedProjectRoot
} from '../utils.js';

/**
 * Register the removeWorktree tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerRemoveWorktreeTool(server) {
	server.addTool({
		name: 'remove_worktree',
		description: 'Remove a Git worktree',
		parameters: z.object({
			worktreeTitle: z
				.string()
				.describe('Worktree title to remove (e.g., "task-6")'),
			force: z
				.boolean()
				.optional()
				.default(false)
				.describe('Force removal even with uncommitted changes'),
			removeBranch: z
				.boolean()
				.optional()
				.default(false)
				.describe('Also remove the branch after removing worktree'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withNormalizedProjectRoot(async (args, { log }) => {
			try {
				log.info(`Starting remove-worktree with args: ${JSON.stringify(args)}`);

				// Check if worktrees feature is enabled
				if (!isWorktreesEnabled(args.projectRoot)) {
					log.error('Worktrees feature is disabled');
					return createErrorResponse(
						'Worktrees are disabled. Enable in config with features.worktrees: true'
					);
				}

				// Validate worktree title format
				if (
					!args.worktreeTitle ||
					!/^task-\d+(\.\d+)*$/.test(args.worktreeTitle)
				) {
					log.error(`Invalid worktree title format: ${args.worktreeTitle}`);
					return createErrorResponse(
						'Invalid worktree title format. Must be in format "task-X" (e.g., "task-6", "task-1.2")'
					);
				}

				// Call the worktree manager function
				const result = await removeWorktree(
					args.projectRoot,
					args.worktreeTitle,
					{
						mcpLog: log,
						force: args.force,
						removeBranch: args.removeBranch
					}
				);

				if (result.cancelled) {
					log.info(`Worktree removal cancelled by user`);
					return createContentResponse({
						message: 'Worktree removal cancelled',
						worktreeTitle: result.worktreeTitle,
						cancelled: true
					});
				}

				log.info(`Successfully removed worktree ${args.worktreeTitle}`);

				return createContentResponse({
					message: `Worktree ${args.worktreeTitle} removed successfully`,
					worktreeTitle: result.worktreeTitle,
					worktreePath: result.worktreePath,
					branchName: result.branchName,
					branchRemoved: result.branchRemoved
				});
			} catch (error) {
				log.error(`Error in remove-worktree tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
