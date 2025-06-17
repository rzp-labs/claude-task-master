# Task Master Command Reference

Comprehensive guide for Task Master commands in Claude Code.

## Command Pattern

Commands follow: `/task-master/{object}-{property}-{action}`

- **Object**: What you're working with (task, project, prd)
- **Property**: Specific aspect (status, subtask, dependency)
- **Action**: What to do (add, set, view, analyze)

## Complete Command List

### Project Commands
- `project-initialize` - Set up new Task Master project
- `project-analyze` - Analyze project health
- `project-setup` - Full setup wizard

### Task Commands
- `task-add` - Create new task
- `task-show` - View task details
- `task-update` - Modify task
- `task-remove` - Delete task
- `task-expand` - Create subtasks
- `task-next` - Get next task
- `task-start` - Begin work
- `task-complete` - Mark done

### Subtask Commands
- `task-subtask-add` - Add subtask
- `task-subtask-remove` - Remove subtask
- `task-subtasks-clear` - Clear all

### Status Commands
- `task-status-view` - Check status
- `task-status-set-*` - Change status
  - pending, in-progress, review
  - done, deferred, cancelled

### Dependency Commands
- `task-dependency-add` - Link tasks
- `task-dependency-remove` - Unlink
- `task-dependencies-validate` - Check
- `task-dependencies-fix` - Repair

### Analysis Commands
- `task-complexity-analyze` - Analyze
- `task-complexity-report` - View report

### PRD Commands
- `prd-parse` - Parse requirements

### Workflow Commands
- `workflow-quick-start` - Fast setup
- `workflow-pipeline` - Full pipeline
- `workflow-smart-flow` - AI-powered
- `workflow-auto-implement` - Auto mode

Type any command to see detailed help!