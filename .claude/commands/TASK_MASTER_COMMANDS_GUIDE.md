# Task Master Commands Guide for Claude Code

Complete guide to using Task Master through Claude Code's slash commands with the new object-action naming pattern.

## Overview

Task Master commands follow a semantic object-action pattern for clarity and scalability. All commands are available under `/task-master/` with intuitive naming that clearly indicates what object you're working with and what action you're performing.

## Quick Start

```bash
# Install Task Master
/task-master/setup-quick-install

# Initialize project
/task-master/project-initialize

# Parse requirements
/task-master/prd-parse requirements.md

# Start working
/task-master/task-next
```

## Command Structure

Commands follow the pattern: `/task-master/{object}-{property}-{action}`

- **Object**: What you're working with (task, project, prd, etc.)
- **Property** (optional): Specific aspect of the object (status, dependency, subtask)
- **Action**: What you want to do (add, remove, update, set, etc.)

Examples:
- `task-add` - Direct action on task object
- `task-status-set-done` - Set the status property of a task
- `task-subtask-add` - Add a subtask (property) to a task

## Complete Command Reference

### Help & Learning

- `/task-master/help` - Interactive command help
- `/task-master/guide` - Quick command reference
- `/task-master/learn` - Discover commands based on your needs

### Project Management

- `/task-master/project-initialize` - Initialize a new Task Master project
- `/task-master/project-setup` - Full project setup wizard
- `/task-master/project-analyze` - Analyze project structure and health
- `/task-master/setup-install` - Detailed installation guide
- `/task-master/setup-quick-install` - One-line installation### Task Management

**Core Task Operations:**
- `/task-master/task-add` - Add new task with AI-powered parsing
- `/task-master/task-show` - Display detailed task information
- `/task-master/task-update` - Update existing task details
- `/task-master/task-remove` - Remove a task from the project
- `/task-master/task-expand` - Expand task into subtasks
- `/task-master/task-next` - Get the next task to work on
- `/task-master/task-start` - Start working on a task
- `/task-master/task-complete` - Mark a task as complete

**Task Listing & Generation:**
- `/task-master/tasks-list` - List all tasks with filtering options
- `/task-master/tasks-generate` - Generate task markdown files

### Subtask Management

- `/task-master/task-subtask-add` - Add subtask to existing task
- `/task-master/task-subtask-remove` - Remove a specific subtask
- `/task-master/task-subtasks-clear` - Clear all subtasks from tasks

### Status Management

- `/task-master/task-status-view` - View task status
- `/task-master/task-status-set-pending` - Set task status to pending
- `/task-master/task-status-set-in-progress` - Set task status to in-progress
- `/task-master/task-status-set-review` - Set task status to review
- `/task-master/task-status-set-done` - Mark task as done
- `/task-master/task-status-set-deferred` - Defer task for later
- `/task-master/task-status-set-cancelled` - Cancel a task### Dependency Management

- `/task-master/task-dependency-add` - Add dependency between tasks
- `/task-master/task-dependency-remove` - Remove task dependency
- `/task-master/task-dependencies-validate` - Check for dependency issues
- `/task-master/task-dependencies-fix` - Auto-fix dependency problems

### PRD & Requirements

- `/task-master/prd-parse` - Parse PRD document into tasks
- `/task-master/workflow-create-prd` - Interactive PRD creation workflow

### Complexity Analysis

- `/task-master/task-complexity-analyze` - Analyze task complexity
- `/task-master/task-complexity-report` - View complexity analysis report

### AI Configuration

- `/task-master/ai-models-configure` - Configure AI models and providers

### Utilities

- `/task-master/readme-sync` - Sync README with project state

### Workflows

Pre-built workflows for common development patterns:

- `/task-master/workflow-quick-start` - Quick project setup
- `/task-master/workflow-pipeline` - Full development pipeline
- `/task-master/workflow-smart-flow` - Intelligent task flow
- `/task-master/workflow-auto-implement` - Auto-implementation workflow

## Command Examples

### Starting a New Project```bash
# Initialize project
/task-master/project-initialize

# Parse your requirements
/task-master/prd-parse docs/requirements.md

# View generated tasks
/task-master/tasks-list

# Start with the first task
/task-master/task-next
```

### Working with Tasks

```bash
# Add a new task
/task-master/task-add "Implement user authentication with JWT"

# Expand complex task into subtasks
/task-master/task-expand 15

# Update task status
/task-master/task-status-set-in-progress 15

# Complete a task
/task-master/task-status-set-done 15

# Get next task to work on
/task-master/task-next
```

### Managing Dependencies

```bash
# Add dependency (task 20 depends on task 15)
/task-master/task-dependency-add 20 15

# Validate all dependencies
/task-master/task-dependencies-validate

# Auto-fix dependency issues
/task-master/task-dependencies-fix
```

### Advanced Features

```bash
# Analyze project complexity
/task-master/task-complexity-analyze

# Configure AI models
/task-master/ai-models-configure

# Run smart workflow
/task-master/workflow-smart-flow
```

## Benefits of Object-Property-Action Pattern

1. **Clarity**: Immediately understand what the command does and what it operates on
2. **Hierarchy**: Reflects actual relationships (subtasks belong to tasks, status is a property)
3. **Scalability**: Easy to add new objects, properties, and actions
   - Future: `project-status-view`, `tag-list`, `report-burndown-generate`
4. **Consistency**: All commands follow the same semantic pattern
5. **Discoverability**: Commands group naturally by object and property
6. **Extensibility**: Properties can have multiple actions (set, get, clear, validate)

## Tips

- Commands are designed for natural language arguments
- AI parsing handles various input formats intelligently
- Use workflows for complex multi-step operations
- Check command files for detailed options and examples

## Troubleshooting

If commands don't appear in Claude Code:
1. Ensure you're using Claude Code v1.0.25 or later
2. Commands should be in `.claude/commands/task-master/`
3. File names must match the pattern: `{object}-{action}.md`
4. Restart Claude Code after adding new commands