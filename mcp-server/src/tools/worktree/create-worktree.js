/**
 * tools/worktree/create-worktree.js
 * Tool to create a new Git worktree for a task
 */

import { z } from 'zod';
import { isWorktreesEnabled } from '../../../../scripts/modules/config-manager.js';
import { createWorktree } from '../../../../scripts/modules/utils/worktree-manager.js';
import {
	createContentResponse,
	createErrorResponse,
	withNormalizedProjectRoot
} from '../utils.js';

/**
 * Register the createWorktree tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerCreateWorktreeTool(server) {
	server.addTool({
		name: 'create_worktree',
		description: 'Create a new Git worktree for a task',
		parameters: z.object({
			taskId: z.string().describe('Task ID for the worktree (required)'),
			baseBranch: z
				.string()
				.optional()
				.default('main')
				.describe('Base branch to create task branch from (default: main)'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withNormalizedProjectRoot(async (args, { log }) => {
			try {
				log.info(`Starting create-worktree with args: ${JSON.stringify(args)}`);

				// Check if worktrees feature is enabled
				if (!isWorktreesEnabled(args.projectRoot)) {
					log.error('Worktrees feature is disabled');
					return createErrorResponse(
						'Worktrees are disabled. Enable in config with features.worktrees: true'
					);
				}

				// Validate task ID format
				if (!args.taskId || !/^\d+(\.\d+)*$/.test(args.taskId)) {
					log.error(`Invalid task ID format: ${args.taskId}`);
					return createErrorResponse(
						'Invalid task ID format. Must be numeric (e.g., "1", "1.2")'
					);
				}

				// Call the worktree manager function
				const result = await createWorktree(
					args.projectRoot,
					args.taskId,
					args.baseBranch,
					{ mcpLog: log }
				);

				log.info(`Successfully created worktree for task ${args.taskId}`);

				return createContentResponse({
					message: `Worktree created successfully for task ${args.taskId}`,
					taskId: result.taskId,
					worktreePath: result.worktreePath,
					branchName: result.branchName,
					baseBranch: result.baseBranch
				});
			} catch (error) {
				log.error(`Error in create-worktree tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
