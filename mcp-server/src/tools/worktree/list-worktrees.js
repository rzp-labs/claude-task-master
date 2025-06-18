/**
 * tools/worktree/list-worktrees.js
 * Tool to list all Git worktrees in the repository
 */

import { z } from 'zod';
import { isWorktreesEnabled } from '../../../../scripts/modules/config-manager.js';
import { listWorktrees } from '../../../../scripts/modules/utils/worktree-manager.js';
import {
	createContentResponse,
	createErrorResponse,
	withNormalizedProjectRoot
} from '../utils.js';

/**
 * Register the listWorktrees tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerListWorktreesTool(server) {
	server.addTool({
		name: 'list_worktrees',
		description: 'List all Git worktrees in the repository',
		parameters: z.object({
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withNormalizedProjectRoot(async (args, { log }) => {
			try {
				log.info(`Starting list-worktrees with args: ${JSON.stringify(args)}`);

				// Check if worktrees feature is enabled
				if (!isWorktreesEnabled(args.projectRoot)) {
					log.error('Worktrees feature is disabled');
					return createErrorResponse(
						'Worktrees are disabled. Enable in config with features.worktrees: true'
					);
				}

				// Call the worktree manager function
				const worktrees = await listWorktrees(args.projectRoot, {
					mcpLog: log
				});

				log.info(`Successfully listed ${worktrees.length} worktrees`);

				// Structure the response to include task associations and useful metadata
				const structuredWorktrees = worktrees.map((worktree) => ({
					path: worktree.path,
					branch: worktree.branch,
					head: worktree.head,
					taskId: worktree.taskId || null,
					isTaskMasterWorktree: worktree.isTaskMasterWorktree,
					isBare: worktree.bare || false
				}));

				const taskMasterWorktrees = structuredWorktrees.filter(
					(w) => w.isTaskMasterWorktree
				);
				const otherWorktrees = structuredWorktrees.filter(
					(w) => !w.isTaskMasterWorktree
				);

				return createContentResponse({
					message: `Found ${worktrees.length} worktrees (${taskMasterWorktrees.length} Task Master, ${otherWorktrees.length} other)`,
					total: worktrees.length,
					taskMasterWorktrees,
					otherWorktrees,
					allWorktrees: structuredWorktrees
				});
			} catch (error) {
				log.error(`Error in list-worktrees tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
