# Git Worktree Feature Documentation

## Overview

Task Master includes experimental support for Git worktrees, enabling parallel development workflows where you can work on multiple tasks simultaneously in isolated environments.

## Requirements

- Git version 2.5 or later
- Worktree feature enabled in configuration (see Configuration section)

## Configuration

To enable worktree support, add the following to your `.taskmaster/config.json` file:

```json
{
  "features": {
    "worktrees": true
  }
}
```

By default, worktrees are disabled (`"worktrees": false`).

## Available Commands

All worktree functionality is currently available through CLI commands only. There are no MCP tools for worktree operations at this time.

### CLI Commands

1. **worktree-create** - Create a new worktree for a task
2. **worktree-list** - List all worktrees with Task Master metadata
3. **worktree-remove** - Remove a worktree (with safety features)
4. **worktree-status** - Check current worktree status

See the [Command Reference](command-reference.md#git-worktree-commands) for detailed usage examples.

## How It Works

### Architecture

1. **Worktree Directory**: All worktrees are created in a `./worktrees/` directory at your project root
2. **Branch Naming**: Task worktrees use the pattern `task-{id}` for branch names
3. **State Management**: Worktree information is tracked in `.taskmaster/state.json`
4. **Registry**: The worktree-state-manager maintains a registry of active worktrees

### File Structure

```
your-project/
├── .taskmaster/
│   ├── config.json         # Feature flag configuration
│   └── state.json          # Worktree registry
├── worktrees/              # Contains all worktrees
│   ├── task-123/           # Worktree for task 123
│   └── task-456/           # Worktree for task 456
└── ... (your project files)
```

### Implementation Details

The worktree feature consists of several key modules:

1. **worktree-manager.js**: Core worktree operations

   - `createWorktree()`: Creates worktree and branch
   - `removeWorktree()`: Safely removes worktrees
   - `removeWorktreeAndBranch()`: Removes both worktree and branch
   - `listWorktrees()`: Lists all worktrees with metadata

2. **worktree-state-manager.js**: State persistence

   - Maintains registry of Task Master worktrees
   - Syncs state with actual Git worktrees
   - Tracks task-to-worktree mappings

3. **git-utils.js**: Git integration helpers
   - `isWorktree()`: Checks if current directory is a worktree
   - `getWorktreeInfo()`: Gets worktree metadata

## Safety Features

1. **Self-Deletion Prevention**: Cannot remove a worktree while your terminal is inside it
2. **Uncommitted Changes Protection**: Requires `--force` flag to remove worktrees with uncommitted changes
3. **Branch Protection**: Separate `--remove-branch` flag required to delete branches
4. **Feature Flag Enforcement**: All commands check if worktrees are enabled before executing

## Event System

The worktree manager emits events for integration opportunities:

- `worktree.created`: Fired when a worktree is successfully created
- `worktree.removed`: Fired when a worktree is removed

These events include metadata about the operation (task ID, paths, branch names).

## Best Practices

1. **One Task, One Worktree**: Create a dedicated worktree for each active task
2. **Regular Cleanup**: Remove worktrees after merging to prevent clutter
3. **Commit Before Removing**: Always commit or stash changes before removal
4. **Use Appropriate Base Branches**: Specify the correct base branch for feature work

## Limitations

1. **CLI Only**: No MCP tool support currently
2. **Local Only**: Worktrees are not synced across machines
3. **Manual Cleanup**: Worktrees must be manually removed after task completion
4. **No Auto-Discovery**: Task Master doesn't automatically detect manually created worktrees

## Future Enhancements

Potential improvements for the worktree feature:

1. MCP tool integration for editor-based worktree management
2. Automatic cleanup of merged worktrees
3. Worktree templates with pre-configured settings
4. Integration with task status changes
5. Visual worktree status in task listings

## Troubleshooting

### Common Issues

**"Worktrees are disabled"**

- Solution: Enable the feature in `.taskmaster/config.json`

**"Cannot remove worktree while inside it"**

- Solution: Navigate to main repository first (`cd ../..`)

**"fatal: not a git repository"**

- Solution: Ensure you're running commands from a Git repository

**"Worktree has uncommitted changes"**

- Solution: Commit/stash changes or use `--force` flag

### Debug Information

To troubleshoot worktree issues:

1. Check worktree state: `cat .taskmaster/state.json`
2. List Git worktrees: `git worktree list`
3. Verify feature flag: Check `features.worktrees` in config
4. Check Git version: `git --version` (must be 2.5+)
