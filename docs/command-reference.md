# Task Master Command Reference

Here's a comprehensive reference of all available commands:

## Parse PRD

```bash
# Parse a PRD file and generate tasks
task-master parse-prd <prd-file.txt>

# Limit the number of tasks generated
task-master parse-prd <prd-file.txt> --num-tasks=10
```

## List Tasks

```bash
# List all tasks
task-master list

# List tasks with a specific status
task-master list --status=<status>

# List tasks with subtasks
task-master list --with-subtasks

# List tasks with a specific status and include subtasks
task-master list --status=<status> --with-subtasks
```

## Show Next Task

```bash
# Show the next task to work on based on dependencies and status
task-master next
```

## Show Specific Task

```bash
# Show details of a specific task
task-master show <id>
# or
task-master show --id=<id>

# View multiple tasks with comma-separated IDs
task-master show 1,3,5
task-master show 44,55

# View a specific subtask (e.g., subtask 2 of task 1)
task-master show 1.2
```

## Generate Task Files

```bash
# Generate individual task files from tasks.json
task-master generate
```

## Update Task Status

```bash
# Set the status of a task
task-master set-status --id=<id> --status=<status>

# Set the status of a task with a custom task file
task-master set-status --id=<id> --status=<status> --file=<tasks.json>

# Set the status of a subtask (e.g., subtask 2 of task 1)
task-master set-status --id=1.2 --status=done

# Set the status of multiple tasks (comma-separated)
task-master set-status --id=1,2,3 --status=done
```

## Update Tasks

```bash
# Update task descriptions for multiple tasks starting from a specific task ID
task-master update --from=<task_id> --prompt="<your changes>"

# Research-backed update using Perplexity for more informed updates
task-master update --from=<task_id> --prompt="<your changes>" --research

# Use a custom task file
task-master update --from=<task_id> --prompt="<your changes>" --file=<tasks.json>
```

Note: `update` affects all tasks from the specified ID onwards. Use `update-task` for single task updates.

## Update Single Task

```bash
# Update a single task based on new information
task-master update-task --id=<task_id> --prompt="<new information>"

# Research-backed update for a single task
task-master update-task --id=<task_id> --prompt="<new information>" --research

# Append timestamped information to task details (useful for tracking implementation progress)
task-master update-task --id=<task_id> --prompt="<progress notes>" --append
```

## Update Subtasks

```bash
# Append timestamped implementation notes to a specific subtask
task-master update-subtask --id=15.2 --prompt="Implemented the authentication check using JWT middleware"

# Research-backed update for complex implementation details
task-master update-subtask --id=15.3 --prompt="Need to optimize database queries" --research

# Track implementation issues and their resolutions
task-master update-subtask --id=20.1 --prompt="ISSUE: Memory leak in event handlers. RESOLVED: Added cleanup in useEffect"
```

Notes:

- Subtask IDs use the format `parentId.subtaskId` (e.g., `15.2` means subtask 2 of task 15)
- All updates are timestamped automatically
- Existing details are preserved - new information is appended
- Use this command to maintain implementation history and track progress

## Add New Task

```bash
# Add a new task with AI-generated details
task-master add-task --prompt="<task description>"

# Add a task using research for more informed task creation
task-master add-task --prompt="<task description>" --research

# Add a task with dependencies
task-master add-task --prompt="<task description>" --dependencies=1,2

# Manually specify all task details
task-master add-task --title="<title>" --description="<desc>" --details="<details>" --test-strategy="<strategy>" --priority=high
```

## Add Subtask

```bash
# Add a subtask to an existing task
task-master add-subtask --id=<parent_task_id> --title="<title>" --description="<description>"

# Add a subtask with full details
task-master add-subtask --id=<parent_task_id> --title="<title>" --description="<description>" --details="<details>" --status=pending

# Convert an existing task to a subtask of another task
task-master add-subtask --id=<parent_task_id> --task-id=<existing_task_id>
```

## Remove Task

```bash
# Remove a task by ID (with confirmation)
task-master remove --id=<id>

# Remove multiple tasks (comma-separated IDs)
task-master remove --id=1,2,3

# Skip confirmation prompt
task-master remove --id=<id> --yes
```

## Remove Subtask

```bash
# Remove a subtask from its parent task
task-master remove-subtask --id=15.2

# Convert subtask back to a standalone task instead of deleting
task-master remove-subtask --id=15.2 --convert
```

## Expand Task with Subtasks

```bash
# Expand a single task into subtasks using AI
task-master expand --id=<id>

# Expand with a specific number of subtasks
task-master expand --id=<id> --num=5

# Force expansion even if subtasks already exist
task-master expand --id=<id> --force

# Expand with research capabilities (using Perplexity for more context)
task-master expand --id=<id> --research

# Expand with additional context or specific requirements
task-master expand --id=<id> --prompt="Focus on testing and error handling"
```

## Expand All Tasks

```bash
# Expand all pending tasks with default subtasks
task-master expand --all

# Expand all tasks with a specific number of subtasks each
task-master expand --all --num=3

# Force expansion even for tasks that already have subtasks
task-master expand --all --force

# Use research-backed expansion for all tasks
task-master expand --all --research

# Provide additional context for all expansions
task-master expand --all --prompt="Emphasize performance optimization"
```

## Clear Subtasks

```bash
# Clear subtasks from a specific task
task-master clear-subtasks --id=3

# Clear subtasks from multiple tasks
task-master clear-subtasks --id=1,2,3

# Clear subtasks from all tasks
task-master clear-subtasks --all
```

## Move Tasks

```bash
# Move a single task to a new position in the sequence
task-master move --from=5 --to=2

# Move multiple tasks to new positions (must match count)
task-master move --from=5,6,7 --to=1,2,3

# Move a subtask to a different position within its parent
task-master move --from=15.3 --to=15.1

# Move a subtask to become a subtask of a different parent
task-master move --from=15.3 --to=20.1
```

## Manage Dependencies

```bash
# Add a dependency to a task
task-master add-dependency --id=5 --depends-on=3

# Remove a dependency from a task
task-master remove-dependency --id=5 --depends-on=3

# Validate all dependencies (check for circular references, missing tasks)
task-master validate-dependencies

# Automatically fix invalid dependencies
task-master fix-dependencies
```

## Analyze Task Complexity

```bash
# Analyze complexity of all tasks
task-master analyze-complexity

# Analyze specific task IDs
task-master analyze-complexity --ids=1,3,5

# Analyze a range of tasks
task-master analyze-complexity --from=5 --to=10

# Use research for more informed analysis
task-master analyze-complexity --research

# Set custom expansion threshold (1-10, default 5)
task-master analyze-complexity --threshold=7

# Save report to custom location
task-master analyze-complexity --output=my-analysis.json
```

## View Complexity Report

```bash
# Display the complexity analysis report
task-master complexity-report

# View a custom report file
task-master complexity-report --file=my-analysis.json
```

## Tag Management

```bash
# List all available tags with task counts
task-master tags

# Show tags with full metadata
task-master tags --show-metadata

# Create a new tag
task-master add-tag <name>

# Create tag with description
task-master add-tag <name> --description="Feature branch for auth"

# Create tag and copy tasks from current tag
task-master add-tag <name> --copy-from-current

# Create tag from current git branch name
task-master add-tag --from-branch

# Switch to a different tag context
task-master use-tag <name>

# Rename an existing tag
task-master rename-tag <old-name> <new-name>

# Copy a tag to create a new one
task-master copy-tag <source> <target>

# Delete a tag and all its tasks
task-master delete-tag <name>
```

## Initialize a Project

```bash
# Initialize a new project with Task Master structure
task-master init
```

## Configure AI Models

```bash
# View current AI model configuration and API key status
task-master models

# Set the primary model for generation/updates (provider inferred if known)
task-master models --set-main=claude-3-opus-20240229

# Set the research model
task-master models --set-research=sonar-pro

# Set the fallback model
task-master models --set-fallback=claude-3-haiku-20240307

# Set a custom Ollama model for the main role
task-master models --set-main=my-local-llama --ollama

# Set a custom OpenRouter model for the research role
task-master models --set-research=google/gemini-pro --openrouter

# Run interactive setup to configure models, including custom ones
task-master models --setup
```

Configuration is stored in `.taskmaster/config.json` in your project root (legacy `.taskmasterconfig` files are automatically migrated). API keys are still managed via `.env` or MCP configuration. Use `task-master models` without flags to see available built-in models. Use `--setup` for a guided experience.

State is stored in `.taskmaster/state.json` in your project root. It maintains important information like the current tag. Do not manually edit this file.

## Research Fresh Information

```bash
# Perform AI-powered research with fresh, up-to-date information
task-master research "What are the latest best practices for JWT authentication in Node.js?"

# Research with specific task context
task-master research "How to implement OAuth 2.0?" --id=15,16

# Research with file context for code-aware suggestions
task-master research "How can I optimize this API implementation?" --files=src/api.js,src/auth.js

# Research with custom context and project tree
task-master research "Best practices for error handling" --context="We're using Express.js" --tree

# Research with different detail levels
task-master research "React Query v5 migration guide" --detail=high

# Disable interactive follow-up questions (useful for scripting, is the default for MCP)
# Use a custom tasks file location
task-master research "How to implement this feature?" --file=custom-tasks.json

# Research within a specific tag context
task-master research "Database optimization strategies" --tag=feature-branch

# Save research conversation to .taskmaster/docs/research/ directory (for later reference)
task-master research "Database optimization techniques" --save-file

# Save key findings directly to a task or subtask (recommended for actionable insights)
task-master research "How to implement OAuth?" --save-to=15
task-master research "API optimization strategies" --save-to=15.2

# Combine context gathering with automatic saving of findings
task-master research "Best practices for this implementation" --id=15,16 --files=src/auth.js --save-to=15.3
```

**The research command is a powerful exploration tool that provides:**

- **Fresh information beyond AI knowledge cutoffs**
- **Project-aware context** from your tasks and files
- **Automatic task discovery** using fuzzy search
- **Multiple detail levels** (low, medium, high)
- **Token counting and cost tracking**
- **Interactive follow-up questions** for deep exploration
- **Flexible save options** (commit findings to tasks or preserve conversations)
- **Iterative discovery** through continuous questioning and refinement

**Use research frequently to:**

- Get current best practices before implementing features
- Research new technologies and libraries
- Find solutions to complex problems
- Validate your implementation approaches
- Stay updated with latest security recommendations

**Interactive Features (CLI):**

- **Follow-up questions** that maintain conversation context and allow deep exploration
- **Save menu** during or after research with flexible options:
  - **Save to task/subtask**: Commit key findings and actionable insights (recommended)
  - **Save to file**: Preserve entire conversation for later reference if needed
  - **Continue exploring**: Ask more follow-up questions to dig deeper
- **Automatic file naming** with timestamps and query-based slugs when saving conversations

## Git Worktree Commands

Task Master includes experimental support for Git worktrees, allowing you to work on multiple tasks in parallel. These commands require Git 2.5+ and the worktree feature to be enabled in your configuration.

### Enable Worktree Support

Before using worktree commands, add this to your `.taskmaster/config.json`:

```json
{
  "features": {
    "worktrees": true
  }
}
```

### Create Worktree

```bash
# Create a worktree for a specific task
task-master worktree-create --task 123

# Create worktree with a custom base branch (default: main)
task-master worktree-create --task 123 --base-branch develop

# Examples:
task-master worktree-create --task 45              # Creates worktree at ./worktrees/task-45
task-master worktree-create --task auth-feature    # Creates worktree at ./worktrees/task-auth-feature
```

**What happens:**

- Creates a new branch named `task-{id}` from the specified base branch
- Creates a worktree at `./worktrees/task-{id}/`
- Registers the worktree in Task Master's state management
- You can then navigate to the worktree directory to work on the task

### List Worktrees

```bash
# List all Git worktrees with Task Master metadata
task-master worktree-list
```

**Output includes:**

- Branch name and path for each worktree
- Task ID for Task Master-created worktrees
- Visual indicators for main repository vs worktrees

### Remove Worktree

```bash
# Remove a worktree (keeps the branch)
task-master worktree-remove task-123

# Force removal even with uncommitted changes
task-master worktree-remove task-123 --force

# Remove worktree AND delete the branch
task-master worktree-remove task-123 --remove-branch
```

**Safety features:**

- Cannot remove a worktree while your terminal is inside it
- Requires `--force` flag to remove worktrees with uncommitted changes
- Separate `--remove-branch` flag required to delete branches
- Shows confirmation prompts for destructive operations

### Check Worktree Status

```bash
# Show current worktree status
task-master worktree-status
```

**Shows:**

- Whether you're in a worktree or main repository
- Current branch name
- Path to main repository (if in worktree)
- Task ID (if applicable)

### Worktree Workflow Example

```bash
# 1. Enable worktrees in config
# Add "features": { "worktrees": true } to .taskmaster/config.json

# 2. Create a worktree for task 123
task-master worktree-create --task 123

# 3. Navigate to the worktree
cd worktrees/task-123

# 4. Work on your task (all Git operations work normally)
git add .
git commit -m "Implement task 123"

# 5. When done, go back to main repo and remove worktree
cd ../..
task-master worktree-remove task-123 --remove-branch
```

### Best Practices

- **One Task, One Worktree**: Create dedicated worktrees for tasks you're actively working on
- **Clean Up**: Remove worktrees after merging to keep your workspace organized
- **Commit First**: Always commit or stash changes before removing worktrees
- **Stay Organized**: The `worktrees/` directory contains all your task-specific worktrees

### Troubleshooting

**"Cannot remove worktree while inside it"**

- Solution: Navigate to your main repository first with `cd ../..` or the path shown in the error

**"Worktree has uncommitted changes"**

- Solution: Either commit/stash your changes or use `--force` flag (loses changes)

**"Worktrees are disabled"**

- Solution: Enable the feature in `.taskmaster/config.json` as shown above
