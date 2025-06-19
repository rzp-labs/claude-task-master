Help me understand what I was working on and continue the task.

## Task Context Recovery

I'll help you resume your work by analyzing the current state of your task. Let me gather information systematically.

### 1. Current Location & Branch

First, let me check where we are:

```bash
pwd
git branch --show-current
```

### 2. Worktree & Task Detection

Let me determine if we're in a worktree and identify the task:

```bash
# Check if in a worktree
git rev-parse --git-common-dir

# If the branch name contains 'task-', extract the task ID
```

### 3. Task Details

If we found a task ID, let me get the task information:

```bash
tm get-task <task-id>
```

### 4. Git Work Analysis

Now let me analyze what work has been done:

```bash
# Overview of changes
git status --short

# Statistics of changes
git diff --stat

# Recent commits on this branch
git log --oneline -10 --decorate

# All files changed since branching from main
git diff main...HEAD --name-only

# Uncommitted changes summary
git diff --cached --stat
```

### 5. Detailed Change Analysis

For each modified file, let me examine the changes:

```bash
# For each modified file from git status
git diff <filename>

# For staged changes
git diff --cached <filename>
```

### 6. Test & Build Status

Let me check if tests are passing:

```bash
# Check for test script in package.json or appropriate test command
npm test 2>&1 | tail -20

# Check for any build/lint issues
npm run lint 2>&1 | tail -20
```

### 7. Context Synthesis

Based on the gathered information, I'll:

1. **Summarize Current State**
   - What task you're working on
   - What has been completed
   - What files have been modified
   - Current implementation status

2. **Identify Work in Progress**
   - Uncommitted changes and their purpose
   - Any incomplete implementations
   - Failing tests or build issues

3. **Suggest Next Steps**
   - Immediate actions to continue the work
   - Files that likely need attention
   - Tests that should be written
   - Any cleanup or refactoring needed

### 8. Recovery Summary

After analyzing everything, I'll provide:

- **Task Status**: Current progress on the task
- **Recent Work**: What was accomplished in recent commits
- **Active Changes**: What you were in the middle of implementing
- **Recommended Action**: The most logical next step to continue

Would you like me to proceed with this analysis? This will help restore your context and get you back to productive work quickly.