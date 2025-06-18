/**
 * tools/index.js
 * Export all Task Master CLI tools for MCP server
 */

import logger from '../logger.js';
import { registerAddDependencyTool } from './add-dependency.js';
import { registerAddSubtaskTool } from './add-subtask.js';
import { registerAddTagTool } from './add-tag.js';
import { registerAddTaskTool } from './add-task.js';
import { registerAnalyzeProjectComplexityTool } from './analyze.js';
import { registerClearSubtasksTool } from './clear-subtasks.js';
import { registerComplexityReportTool } from './complexity-report.js';
import { registerCopyTagTool } from './copy-tag.js';
import { registerDeleteTagTool } from './delete-tag.js';
import { registerExpandAllTool } from './expand-all.js';
import { registerExpandTaskTool } from './expand-task.js';
import { registerFixDependenciesTool } from './fix-dependencies.js';
import { registerGenerateTool } from './generate.js';
import { registerShowTaskTool } from './get-task.js';
import { registerListTasksTool } from './get-tasks.js';
import { registerInitializeProjectTool } from './initialize-project.js';
import { registerListTagsTool } from './list-tags.js';
import { registerModelsTool } from './models.js';
import { registerMoveTaskTool } from './move-task.js';
import { registerNextTaskTool } from './next-task.js';
import { registerParsePRDTool } from './parse-prd.js';
import { registerRemoveDependencyTool } from './remove-dependency.js';
import { registerRemoveSubtaskTool } from './remove-subtask.js';
import { registerRemoveTaskTool } from './remove-task.js';
import { registerRenameTagTool } from './rename-tag.js';
import { registerResearchTool } from './research.js';
import { registerSetTaskStatusTool } from './set-task-status.js';
import { registerUpdateSubtaskTool } from './update-subtask.js';
import { registerUpdateTaskTool } from './update-task.js';
import { registerUpdateTool } from './update.js';
import { registerUseTagTool } from './use-tag.js';
import { registerValidateDependenciesTool } from './validate-dependencies.js';

// Worktree tools
import { registerCreateWorktreeTool } from './worktree/create-worktree.js';
import { registerListWorktreesTool } from './worktree/list-worktrees.js';
import { registerRemoveWorktreeTool } from './worktree/remove-worktree.js';

/**
 * Register all Task Master tools with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerTaskMasterTools(server) {
	try {
		// Register each tool in a logical workflow order

		// Group 1: Initialization & Setup
		registerInitializeProjectTool(server);
		registerModelsTool(server);
		registerParsePRDTool(server);

		// Group 2: Task Analysis & Expansion
		registerAnalyzeProjectComplexityTool(server);
		registerExpandTaskTool(server);
		registerExpandAllTool(server);

		// Group 3: Task Listing & Viewing
		registerListTasksTool(server);
		registerShowTaskTool(server);
		registerNextTaskTool(server);
		registerComplexityReportTool(server);

		// Group 4: Task Status & Management
		registerSetTaskStatusTool(server);
		registerGenerateTool(server);

		// Group 5: Task Creation & Modification
		registerAddTaskTool(server);
		registerAddSubtaskTool(server);
		registerUpdateTool(server);
		registerUpdateTaskTool(server);
		registerUpdateSubtaskTool(server);
		registerRemoveTaskTool(server);
		registerRemoveSubtaskTool(server);
		registerClearSubtasksTool(server);
		registerMoveTaskTool(server);

		// Group 6: Dependency Management
		registerAddDependencyTool(server);
		registerRemoveDependencyTool(server);
		registerValidateDependenciesTool(server);
		registerFixDependenciesTool(server);

		// Group 7: Tag Management
		registerListTagsTool(server);
		registerAddTagTool(server);
		registerDeleteTagTool(server);
		registerUseTagTool(server);
		registerRenameTagTool(server);
		registerCopyTagTool(server);

		// Group 8: Research Features
		registerResearchTool(server);

		// Group 9: Worktree Management (conditional based on feature flag)
		registerCreateWorktreeTool(server);
		registerRemoveWorktreeTool(server);
		registerListWorktreesTool(server);
	} catch (error) {
		logger.error(`Error registering Task Master tools: ${error.message}`);
		throw error;
	}
}

export default {
	registerTaskMasterTools
};
