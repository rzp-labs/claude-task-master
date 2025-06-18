# Worktree CLI Manual Testing Plan

## Overview
Comprehensive manual testing plan for Task Master worktree functionality. This document outlines all test cases needed to validate the worktree CLI commands and core functions.

## Functions Under Test

### CLI Commands
- `worktree-create --task <id> [--base-branch <branch>]`
- `worktree-list`
- `worktree-remove <worktreeTitle> [--force] [--remove-branch]`
- `worktree-status`

### Core Functions
- `createWorktree(projectRoot, taskId, baseBranch, options)`
- `removeWorktree(projectRoot, worktreeTitle, options)`
- `removeWorktreeAndBranch(projectRoot, worktreeTitle, options)`
- `listWorktrees(projectRoot, options)`
- `getWorktreeTitle(taskId)`

### Supporting Functions
- `isWorktree(projectRoot)`
- `getWorktreeInfo(projectRoot)`
- `validateGitVersion(projectRoot)`

## Test Cases

### 1. `worktree-list` Command

#### Test 1.1: Empty worktree list
- **Setup**: Remove all existing worktrees
- **Command**: `node scripts/dev.js worktree-list`
- **Expected**: Shows "No worktrees found" message
- **Status**: [ ] Not tested

#### Test 1.2: Single worktree exists
- **Setup**: Create one worktree
- **Command**: `node scripts/dev.js worktree-list`
- **Expected**: Shows single worktree with details (path, branch, task ID)
- **Status**: [ ] Not tested

#### Test 1.3: Multiple worktrees exist
- **Setup**: Create 2-3 worktrees
- **Command**: `node scripts/dev.js worktree-list`
- **Expected**: Shows all worktrees in table format with colors
- **Status**: [ ] Not tested

#### Test 1.4: Feature disabled
- **Setup**: Set `features.worktrees: false`
- **Command**: `node scripts/dev.js worktree-list`
- **Expected**: Shows feature disabled error
- **Status**: [ ] Not tested

#### Test 1.5: Git command fails
- **Setup**: Corrupt git repo or run outside git repo
- **Command**: `node scripts/dev.js worktree-list`
- **Expected**: Handles error gracefully
- **Status**: [ ] Not tested

#### Test 1.6: Run from subdirectory
- **Setup**: Run from project subdirectory
- **Command**: `node ../scripts/dev.js worktree-list`
- **Expected**: Should find project root and work
- **Status**: [ ] Not tested

### 2. `worktree-create` Command

#### Test 2.1: Valid new task ID
- **Command**: `node scripts/dev.js worktree-create --task 101`
- **Expected**: Creates worktree successfully with success message
- **Status**: [✅] Passed

#### Test 2.2: Task ID already has worktree
- **Setup**: Create worktree for task 102
- **Command**: `node scripts/dev.js worktree-create --task 102`
- **Expected**: Handles duplicate appropriately (error or reuse)
- **Status**: [ ] Not tested

#### Test 2.3: Invalid task ID (non-alphanumeric)
- **Command**: `node scripts/dev.js worktree-create --task "bad task"`
- **Expected**: Shows validation error
- **Status**: [ ] Not tested

#### Test 2.4: Missing task ID
- **Command**: `node scripts/dev.js worktree-create`
- **Expected**: Shows usage help/error
- **Status**: [ ] Not tested

#### Test 2.5: Feature disabled
- **Setup**: Set `features.worktrees: false`
- **Command**: `node scripts/dev.js worktree-create --task 103`
- **Expected**: Shows feature disabled error
- **Status**: [✅] Passed

#### Test 2.6: Git command fails
- **Setup**: Insufficient permissions or Git errors
- **Command**: `node scripts/dev.js worktree-create --task 104`
- **Expected**: Handles Git error gracefully
- **Status**: [ ] Not tested

#### Test 2.7: With base-branch flag
- **Command**: `node scripts/dev.js worktree-create --task 105 --base-branch develop`
- **Expected**: Creates worktree from specified branch
- **Status**: [ ] Not tested

#### Test 2.8: Insufficient permissions
- **Setup**: Make worktrees directory read-only
- **Command**: `node scripts/dev.js worktree-create --task 106`
- **Expected**: Handles filesystem error gracefully
- **Status**: [ ] Not tested

### 3. `worktree-remove` Command

#### Test 3.1: Clean worktree exists
- **Setup**: Create clean worktree
- **Command**: `node scripts/dev.js worktree-remove task-107`
- **Expected**: Removes successfully with confirmation message
- **Status**: [✅] Passed

#### Test 3.2: Uncommitted changes, no force
- **Setup**: Create worktree with uncommitted changes
- **Command**: `node scripts/dev.js worktree-remove task-108`
- **Expected**: Fails with clear message about uncommitted changes
- **Status**: [✅] Passed

#### Test 3.3: Uncommitted changes, with force
- **Setup**: Create worktree with uncommitted changes
- **Command**: `node scripts/dev.js worktree-remove task-109 --force`
- **Expected**: Prompts for confirmation
- **Status**: [ ] Not tested

#### Test 3.4: User confirms force removal
- **Setup**: Uncommitted changes, use --force
- **Action**: Type 'y' when prompted
- **Expected**: Proceeds with removal
- **Status**: [ ] Not tested

#### Test 3.5: User declines force removal
- **Setup**: Uncommitted changes, use --force
- **Action**: Type 'n' when prompted
- **Expected**: Aborts operation
- **Status**: [ ] Not tested

#### Test 3.6: Worktree doesn't exist
- **Command**: `node scripts/dev.js worktree-remove task-999`
- **Expected**: Shows "not found" error
- **Status**: [✅] Passed

#### Test 3.7: With remove-branch flag
- **Command**: `node scripts/dev.js worktree-remove task-110 --remove-branch`
- **Expected**: Removes both worktree and branch
- **Status**: [ ] Not tested

#### Test 3.8: Feature disabled
- **Setup**: Set `features.worktrees: false`
- **Command**: `node scripts/dev.js worktree-remove task-111`
- **Expected**: Shows feature disabled error
- **Status**: [ ] Not tested

#### Test 3.9: **CRITICAL SAFETY** - Attempt to delete while inside worktree
- **Setup**: Create worktree and navigate into it: `cd worktrees/task-112`
- **Command**: `../../scripts/dev.js worktree-remove task-112`
- **Expected**: Shows error preventing deletion, suggests navigating out first
- **Status**: [✅] Critical bug identified and fixed
- **Fix**: Added safety check to prevent terminal session corruption

### 4. `worktree-status` Command

#### Test 4.1: In main repository
- **Setup**: Run from main project directory
- **Command**: `node scripts/dev.js worktree-status`
- **Expected**: Shows "not in worktree" message
- **Status**: [✅] Passed

#### Test 4.2: In Task Master worktree
- **Setup**: Run from inside task-X worktree
- **Command**: `node ../../scripts/dev.js worktree-status`
- **Expected**: Shows worktree info + task ID
- **Status**: [✅] Passed

#### Test 4.3: In non-Task Master worktree
- **Setup**: Create worktree with non-task branch name
- **Command**: `node ../../scripts/dev.js worktree-status`
- **Expected**: Shows worktree info, no task ID
- **Status**: [ ] Not tested

#### Test 4.4: In non-Git directory
- **Setup**: Run from directory outside Git repo
- **Command**: `node /path/to/scripts/dev.js worktree-status`
- **Expected**: Handles gracefully
- **Status**: [ ] Not tested

#### Test 4.5: Git command fails
- **Setup**: Corrupted .git file or permissions issue
- **Command**: `node scripts/dev.js worktree-status`
- **Expected**: Handles error gracefully
- **Status**: [ ] Not tested

### 5. Feature Flag Integration

#### Test 5.1: Enable feature
- **Setup**: Set `features.worktrees: true`
- **Action**: Test all commands
- **Expected**: All commands should work
- **Status**: [✅] Passed

#### Test 5.2: Disable feature
- **Setup**: Set `features.worktrees: false`
- **Action**: Test create/remove commands
- **Expected**: Commands should be blocked
- **Status**: [✅] Passed

#### Test 5.3: Missing config file
- **Setup**: Rename/delete config.json
- **Action**: Test commands
- **Expected**: Should handle gracefully (default behavior)
- **Status**: [ ] Not tested

### 6. Supporting Functions

#### Test 6.1: isWorktree() from main repo
- **Setup**: Run from main repository
- **Expected**: Returns false
- **Status**: [✅] Passed (via worktree-status)

#### Test 6.2: isWorktree() from worktree
- **Setup**: Run from worktree directory
- **Expected**: Returns true
- **Status**: [✅] Passed (via worktree-status)

#### Test 6.3: getWorktreeInfo() from main repo
- **Setup**: Run from main repository
- **Expected**: Returns null
- **Status**: [✅] Passed (via worktree-status)

#### Test 6.4: getWorktreeInfo() from worktree
- **Setup**: Run from worktree directory
- **Expected**: Returns correct info object
- **Status**: [✅] Passed (via worktree-status)

## Edge Cases & Error Scenarios

### 7. Advanced Scenarios

#### Test 7.1: Registry file missing
- **Setup**: Delete .taskmaster/worktree-registry.json
- **Action**: Create/remove worktrees
- **Expected**: Creates new registry file
- **Status**: [ ] Not tested

#### Test 7.2: Registry file corrupted
- **Setup**: Write invalid JSON to registry
- **Action**: Create/remove worktrees
- **Expected**: Handles gracefully, logs warning
- **Status**: [ ] Not tested

#### Test 7.3: Permission issues writing registry
- **Setup**: Make registry file read-only
- **Action**: Create/remove worktrees
- **Expected**: Logs error but doesn't fail main operation
- **Status**: [ ] Not tested

#### Test 7.4: Multiple worktrees don't affect each other
- **Setup**: Create multiple worktrees
- **Action**: Remove one
- **Expected**: Others remain unaffected
- **Status**: [ ] Not tested

#### Test 7.5: Branch conflicts
- **Setup**: Try to create worktree with branch that exists
- **Action**: Create worktree
- **Expected**: Handles appropriately (reuse or error)
- **Status**: [ ] Not tested

## Test Execution Tracking

### Summary
- **Total Tests**: 34
- **Passed**: 7
- **Failed**: 0
- **Not Tested**: 27
- **Blocked**: 0

### Known Issues
1. **worktree-list CLI command**: Registration issue - action function not executing
2. **Command recognition**: Intermittent issues in some contexts

### Next Steps
1. Fix worktree-list command registration
2. Complete all untested scenarios
3. Fix any failing tests
4. Document final results

## Test Environment
- **Git Version**: 2.39.5 (Apple Git-154)
- **Node.js Version**: [To be filled]
- **OS**: macOS (Darwin 24.5.0)
- **Project**: Task Master AI