/**
 * tools/update-tasks.js
 * Tool to update tasks based on new context/prompt
 */

import { z } from 'zod';
import { updateTasksDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';

/**
 * Register the update_tasks tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUpdateTasksTool(server) {
	server.addTool({
		name: 'update_tasks',
		description:
			"Update multiple upcoming tasks (with ID >= 'from' ID) based on new context or changes provided in the prompt. Use 'update_task' instead for a single specific task or 'update_subtask' for subtasks.",
		parameters: z.object({
			from: z
				.string()
				.describe(
					"Task ID from which to start updating (inclusive). IMPORTANT: This tool uses 'from', not 'id'"
				),
			prompt: z
				.string()
				.describe('Explanation of changes or new context to apply'),
			research: z
				.boolean()
				.optional()
				.describe('Use Perplexity AI for research-backed updates'),
			file: z
				.string()
				.optional()
				.describe('Path to the tasks file relative to project root'),
			projectRoot: z
				.string()
				.optional()
				.describe(
					'The directory of the project. (Optional, usually from session)'
				)
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const toolName = 'update_tasks';
			const { from, prompt, research, file, projectRoot } = args;

			try {
				log.info(
					`Executing ${toolName} tool with normalized root: ${projectRoot}`
				);

				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath({ projectRoot, file }, log);
					log.info(`${toolName}: Resolved tasks path: ${tasksJsonPath}`);
				} catch (error) {
					log.error(`${toolName}: Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json within project root '${projectRoot}': ${error.message}`
					);
				}

				const result = await updateTasksDirect(
					{
						tasksJsonPath: tasksJsonPath,
						from: from,
						prompt: prompt,
						research: research,
						projectRoot: projectRoot
					},
					log,
					{ session }
				);

				log.info(
					`${toolName}: Direct function result: success=${result.success}`
				);
				return handleApiResult(
					result,
					log,
					'Error updating tasks',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(
					`Critical error in ${toolName} tool execute: ${error.message}`
				);
				return createErrorResponse(
					`Internal tool error (${toolName}): ${error.message}`
				);
			}
		})
	});
}
